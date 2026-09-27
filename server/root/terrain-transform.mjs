/**
 * Project Atlas — Layer 4 Terrain Transform foundation.
 *
 * Baseline terrain remains deterministic and immutable. This module stores
 * only active mutations and derives an effective tile from:
 *
 *   deterministic baseline + active transform
 *
 * Persistence is intentionally abstracted behind a small in-memory store for
 * this milestone. SQLite can replace the store later without changing the
 * transform contract.
 */

import { normalizeCoordinates } from './climate.mjs';

export const TRANSFORM_RECOVERY_TYPES = Object.freeze([
  'timer',
  'conditional',
  'none'
]);

function freezeTransform(definition) {
  return Object.freeze({
    ...definition,
    target: Object.freeze({ ...(definition.target || {}) }),
    result: Object.freeze({ ...(definition.result || {}) }),
    recovery: Object.freeze({ ...(definition.recovery || {}) })
  });
}

/**
 * Layer 4 examples taken directly from the Atlas terrain design.
 * Exact balance values are intentionally left configurable.
 */
export const TERRAIN_TRANSFORMS = Object.freeze([
  freezeTransform({
    id: 'fire-grass-scorch',
    moveType: 'fire',
    target: { surface: 'grass' },
    result: { surface: 'scorched-dirt' },
    recovery: { type: 'timer', durationMs: null }
  }),
  freezeTransform({
    id: 'ice-water',
    moveType: 'ice',
    target: { waterform: ['Ocean', 'Shallows', 'Lake', 'River'] },
    result: { surface: 'ice', waterform: 'Ice' },
    recovery: {
      type: 'conditional',
      condition: { field: 'temperature', op: 'above', value: null }
    }
  }),
  freezeTransform({
    id: 'rock-ground-dirt-wall',
    moveType: 'rock-ground',
    target: { surface: 'dirt' },
    result: { surface: 'stone-wall' },
    recovery: { type: 'none' }
  }),
  freezeTransform({
    id: 'water-dirt-pond',
    moveType: 'water',
    target: { surface: 'dirt' },
    result: { surface: 'water-pond' },
    recovery: { type: 'none' }
  }),
  freezeTransform({
    id: 'grass-dirt-berry-tree',
    moveType: 'grass',
    target: { surface: 'dirt' },
    result: { object: { type: 'BerryTree' } },
    recovery: { type: 'none' }
  })
]);

function keyFor(seed, x, y) {
  const p = normalizeCoordinates(x, y);
  return String(seed) + '|' + p.x + '|' + p.y;
}

function clone(value) {
  if (value == null || typeof value !== 'object') return value;
  return structuredClone(value);
}

export function createTransformStore() {
  return new Map();
}

export function getTransformDefinition(transformId) {
  return TERRAIN_TRANSFORMS.find(transform => transform.id === transformId) || null;
}

function matchesExpected(actual, expected) {
  if (Array.isArray(expected)) return expected.includes(actual);
  return actual === expected;
}

export function matchesTransformTarget(tile, target = {}) {
  return Object.entries(target).every(([field, expected]) => matchesExpected(tile?.[field], expected));
}

export function canTransform({ tile, moveType, transformId = null } = {}) {
  const transform = transformId
    ? getTransformDefinition(transformId)
    : TERRAIN_TRANSFORMS.find(def => def.moveType === moveType && matchesTransformTarget(tile, def.target));
  if (!transform) return { ok: false, reason: 'no-matching-transform' };
  if (transform.moveType !== moveType) return { ok: false, reason: 'move-type-mismatch', transform };
  if (!matchesTransformTarget(tile, transform.target)) return { ok: false, reason: 'target-mismatch', transform };
  return { ok: true, transform };
}

export function getActiveTransform(store, seed, x, y) {
  if (!store) return null;
  return store.get(keyFor(seed, x, y)) || null;
}

function effectiveResult(tile, transform) {
  if (!transform) return { ...tile };
  const out = { ...tile };
  for (const [field, value] of Object.entries(transform.result || {})) out[field] = clone(value);
  out.transform = {
    id: transform.transformId,
    appliedAt: transform.appliedAt,
    sourceEntityId: transform.sourceEntityId ?? null,
    recovery: clone(transform.recovery)
  };
  return out;
}

export function getEffectiveTile(store, seed, x, y, baselineTile) {
  if (!baselineTile) throw new TypeError('baselineTile is required');
  return effectiveResult(baselineTile, getActiveTransform(store, seed, x, y));
}

export function applyTransform({
  store,
  seed = 'atlas-root',
  x = 0,
  y = 0,
  tile,
  moveType,
  transformId = null,
  sourceEntityId = null,
  at = Date.now(),
  recovery = null
} = {}) {
  if (!store) throw new TypeError('transform store is required');
  if (!tile) throw new TypeError('tile is required');

  const normalized = normalizeCoordinates(x, y);
  const effectiveTile = getEffectiveTile(store, seed, normalized.x, normalized.y, tile);
  const allowed = canTransform({ tile: effectiveTile, moveType, transformId });
  if (!allowed.ok) return { ok: false, reason: allowed.reason, transform: allowed.transform || null };

  const definition = allowed.transform;
  const existing = getActiveTransform(store, seed, normalized.x, normalized.y);
  if (existing) return { ok: false, reason: 'active-transform-exists', transform: definition, active: existing };
  const selectedRecovery = recovery || definition.recovery;
  if (!TRANSFORM_RECOVERY_TYPES.includes(selectedRecovery.type)) {
    throw new TypeError('unknown recovery type: ' + selectedRecovery.type);
  }

  const record = Object.freeze({
    key: keyFor(seed, normalized.x, normalized.y),
    seed: String(seed),
    position: normalized,
    transformId: definition.id,
    appliedAt,
    sourceEntityId: sourceEntityId == null ? null : String(sourceEntityId),
    recovery: clone(selectedRecovery)
  });

  store.set(record.key, record);
  return {
    ok: true,
    transform: definition,
    record,
    tile: getEffectiveTile(store, seed, normalized.x, normalized.y, tile)
  };
}

function compareCondition(actual, op, expected) {
  if (expected == null) return false;
  switch (op) {
    case 'above': return actual > expected;
    case 'at-or-above': return actual >= expected;
    case 'below': return actual < expected;
    case 'at-or-below': return actual <= expected;
    case 'equals': return actual === expected;
    default: return false;
  }
}

export function isRecoveryDue(record, { tile, now = Date.now() } = {}) {
  if (!record) return false;
  const recovery = record.recovery || { type: 'none' };
  if (recovery.type === 'none') return false;
  if (recovery.type === 'timer') {
    if (!Number.isFinite(recovery.durationMs)) return false;
    return now >= record.appliedAt + Math.max(0, recovery.durationMs);
  }
  if (recovery.type === 'conditional') {
    const condition = recovery.condition;
    if (!condition || tile == null) return false;
    return compareCondition(tile[condition.field], condition.op, condition.value);
  }
  return false;
}

export function listActiveTransforms(store, seed = null) {
  if (!store) return [];
  const prefix = seed == null ? null : String(seed) + '|';
  return [...store.values()].filter(record => prefix == null || record.key.startsWith(prefix));
}

export function transformStoreStats(store, seed = null) {
  return { active: listActiveTransforms(store, seed).length };
}

export function recoverTransform(store, seed, x, y, context = {}) {
  if (!store) throw new TypeError('transform store is required');
  const record = getActiveTransform(store, seed, x, y);
  if (!record) return { ok: false, recovered: false, reason: 'no-active-transform' };
  if (!isRecoveryDue(record, context)) return { ok: true, recovered: false, record };
  store.delete(record.key);
  return { ok: true, recovered: true, record, position: record.position };
}

export function terrainTransformSelfTest(seed = 'atlas-root') {
  const store = createTransformStore();
  const grass = { x: 10, y: 20, surface: 'grass', waterform: 'None' };
  const applied = applyTransform({
    store, seed, x: grass.x, y: grass.y, tile: grass, moveType: 'fire',
    sourceEntityId: 'self-test', at: 1000,
    recovery: { type: 'timer', durationMs: 500 }
  });
  const transformed = getEffectiveTile(store, seed, grass.x, grass.y, grass);
  const notDue = recoverTransform(store, seed, grass.x, grass.y, { tile: transformed, now: 1499 });
  const due = recoverTransform(store, seed, grass.x, grass.y, { tile: transformed, now: 1500 });
  const restored = getActiveTransform(store, seed, grass.x, grass.y);
  const checks = [
    { id: 'transform-match', ok: applied.ok, note: 'matching move and target resolve a transform definition' },
    { id: 'baseline-preserved', ok: grass.surface === 'grass', note: 'baseline input remains unchanged after application' },
    { id: 'effective-result', ok: transformed.surface === 'scorched-dirt', note: 'effective tile exposes the transformed surface' },
    { id: 'timer-not-due', ok: notDue.ok && notDue.recovered === false, note: 'timer recovery waits until its due time' },
    { id: 'timer-due', ok: due.ok && due.recovered === true, note: 'expired timer recovery removes the active transform' },
    { id: 'restored-baseline-state', ok: restored === null, note: 'recovery leaves no active mutation record' }
  ];
  return { passed: checks.every(check => check.ok), checks };
}
