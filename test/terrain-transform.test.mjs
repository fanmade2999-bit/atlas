import test from 'node:test';
import assert from 'node:assert/strict';
import {
  TERRAIN_TRANSFORMS,
  createTransformStore,
  getTransformDefinition,
  canTransform,
  applyTransform,
  getEffectiveTile,
  getActiveTransform,
  isRecoveryDue,
  recoverTransform,
  terrainTransformSelfTest
} from '../server/root/terrain-transform.mjs';

test('Layer 4 transform table contains the specified construction and destruction shapes', () => {
  assert.ok(getTransformDefinition('fire-grass-scorch'));
  assert.ok(getTransformDefinition('ice-water'));
  assert.ok(getTransformDefinition('rock-ground-dirt-wall'));
  assert.ok(getTransformDefinition('water-dirt-pond'));
  assert.ok(getTransformDefinition('grass-dirt-berry-tree'));
  assert.equal(TERRAIN_TRANSFORMS.length, 5);
});

test('transform lookup rejects mismatched targets', () => {
  const result = canTransform({
    tile: { surface: 'grass', waterform: 'None' },
    moveType: 'water'
  });
  assert.equal(result.ok, false);
});

test('applying a transform does not mutate the deterministic baseline tile', () => {
  const store = createTransformStore();
  const baseline = { x: 10, y: 20, surface: 'grass', waterform: 'None' };

  const result = applyTransform({
    store,
    seed: 'test-seed',
    x: 10,
    y: 20,
    tile: baseline,
    moveType: 'fire',
    at: 1000,
    recovery: { type: 'timer', durationMs: 100 }
  });

  assert.equal(result.ok, true);
  assert.equal(baseline.surface, 'grass');

  const effective = getEffectiveTile(store, 'test-seed', 10, 20, baseline);
  assert.equal(effective.surface, 'scorched-dirt');
  assert.equal(effective.transform.id, 'fire-grass-scorch');
});

test('timer recovery removes only the active transform', () => {
  const store = createTransformStore();
  const baseline = { x: 1, y: 2, surface: 'grass', waterform: 'None' };

  applyTransform({
    store,
    seed: 'timer-test',
    x: 1,
    y: 2,
    tile: baseline,
    moveType: 'fire',
    at: 1000,
    recovery: { type: 'timer', durationMs: 250 }
  });

  assert.equal(isRecoveryDue(getActiveTransform(store, 'timer-test', 1, 2), { tile: baseline, now: 1249 }), false);
  assert.equal(isRecoveryDue(getActiveTransform(store, 'timer-test', 1, 2), { tile: baseline, now: 1250 }), true);

  const result = recoverTransform(store, 'timer-test', 1, 2, { tile: baseline, now: 1250 });
  assert.equal(result.recovered, true);
  assert.equal(getActiveTransform(store, 'timer-test', 1, 2), null);
});

test('conditional recovery stays pending until the environmental condition is met', () => {
  const store = createTransformStore();
  const baseline = { x: 5, y: 6, surface: 'grass', waterform: 'None', temperature: 0.4 };

  applyTransform({
    store,
    seed: 'conditional-test',
    x: 5,
    y: 6,
    tile: { ...baseline, waterform: 'Lake' },
    moveType: 'ice',
    at: 1000,
    recovery: {
      type: 'conditional',
      condition: { field: 'temperature', op: 'above', value: 0.5 }
    }
  });

  const record = getActiveTransform(store, 'conditional-test', 5, 6);
  assert.equal(isRecoveryDue(record, { tile: baseline, now: 2000 }), false);
  assert.equal(isRecoveryDue(record, { tile: { ...baseline, temperature: 0.6 }, now: 2000 }), true);
});

test('permanent transforms never self-recover', () => {
  const store = createTransformStore();
  const baseline = { x: 7, y: 8, surface: 'dirt', waterform: 'None' };

  const result = applyTransform({
    store,
    seed: 'permanent-test',
    x: 7,
    y: 8,
    tile: baseline,
    moveType: 'rock-ground',
    at: 1000
  });

  assert.equal(result.ok, true);
  assert.equal(isRecoveryDue(result.record, { tile: baseline, now: Number.MAX_SAFE_INTEGER }), false);
});

test('Layer 4 self-test passes', () => {
  assert.equal(terrainTransformSelfTest('test-seed').passed, true);
});
