/**
 * Project Atlas — Root Tile & Chunk Generation
 * Layer 1 after climate: deterministic baseline tiles and 16x16 chunks.
 *
 * getTile() is deliberately an override gate. A future persistence layer can
 * supply a modified tile without changing the baseline generation contract.
 */
import { normalizeCoordinates, sampleClimate, classifyTerrain, WORLD_HEIGHT, WORLD_WIDTH } from './climate.mjs';
import { getTileDetail } from './detail.mjs';
import { createTransformStore, applyTransform, recoverTransform, getEffectiveTile, getActiveTransform, terrainTransformSelfTest } from './terrain-transform.mjs';

export const CHUNK_SIZE = 16;

// Active Layer 4 mutations. Baseline generation remains deterministic; this
// store contains only explicit world changes and is replaceable by persistence.
export const terrainTransformStore = createTransformStore();

export function tileKey(x, y) {
  const p = normalizeCoordinates(x, y);
  return `${p.x},${p.y}`;
}

function getBaselineTile(seed, x, y, overrides = null) {
  const position = normalizeCoordinates(x, y);
  const key = tileKey(position.x, position.y);
  const override = overrides?.[key];
  if (override) return { ...position, ...override, source: 'override' };
  const climate = sampleClimate(seed, position.x, position.y);
  const terrain = classifyTerrain(seed, position.x, position.y);
  const detail = getTileDetail(seed, position.x, position.y);
  return {
    ...position,
    ...climate,
    landform: terrain.landform,
    waterform: terrain.waterform,
    surface: detail.surface,
    hydrology: terrain.hydrology,
    detail,
    source: 'baseline'
  };
}

export function getTile(seed, x, y, overrides = null) {
  const position = normalizeCoordinates(x, y);
  const baseline = getBaselineTile(seed, position.x, position.y, overrides);
  return getEffectiveTile(
    terrainTransformStore,
    seed,
    position.x,
    position.y,
    baseline
  );
}

export function applyTileTransform({
  seed = 'atlas-root',
  x = 0,
  y = 0,
  moveType,
  transformId = null,
  sourceEntityId = null,
  at = Date.now(),
  recovery = null,
  overrides = null
} = {}) {
  const position = normalizeCoordinates(x, y);
  const baseline = getBaselineTile(seed, position.x, position.y, overrides);
  const result = applyTransform({
    store: terrainTransformStore,
    seed,
    x: position.x,
    y: position.y,
    tile: baseline,
    moveType,
    transformId,
    sourceEntityId,
    at,
    recovery
  });
  if (result.ok) invalidateChunkForTile(seed, position.x, position.y);
  return result;
}

export function recoverTileTransform(seed, x, y, context = {}) {
  const position = normalizeCoordinates(x, y);
  const result = recoverTransform(terrainTransformStore, seed, position.x, position.y, context);
  if (result.recovered) invalidateChunkForTile(seed, position.x, position.y);
  return result;
}

export function getTileTransform(seed, x, y) {
  return getActiveTransform(terrainTransformStore, seed, x, y);
}

export function terrainTransformState(seed = 'atlas-root', x = 0, y = 0) {
  return {
    active: getTileTransform(seed, x, y),
    selfTest: terrainTransformSelfTest(seed)
  };
}

export function chunkOrigin(chunkX, chunkY) {
  return {
    x: ((Math.trunc(chunkX) * CHUNK_SIZE) % WORLD_WIDTH + WORLD_WIDTH) % WORLD_WIDTH,
    y: Math.max(0, Math.min(WORLD_HEIGHT - 1, Math.trunc(chunkY) * CHUNK_SIZE))
  };
}

export function getChunk(seed, chunkX, chunkY, overrides = null) {
  const origin = chunkOrigin(chunkX, chunkY);
  const tiles = [];
  for (let localY = 0; localY < CHUNK_SIZE; localY += 1) {
    for (let localX = 0; localX < CHUNK_SIZE; localX += 1) tiles.push(getTile(seed, origin.x + localX, origin.y + localY, overrides));
  }
  return { chunkX: Math.trunc(chunkX), chunkY: Math.trunc(chunkY), origin, size: CHUNK_SIZE, tiles };
}

export function rootTileSelfTest(seed = 'atlas-root') {
  const cached = tileSelfTestCache.get(seed);
  if (cached) return cached;
  const a = getTile(seed, 12345, 67890);
  const b = getTile(seed, 12345, 67890);
  const northEast = getChunk(seed, 0, 0);
  const northWest = getChunk(seed, -1, 0);
  const eastEdge = northEast.tiles[CHUNK_SIZE - 1];
  const westEdge = northWest.tiles[CHUNK_SIZE * CHUNK_SIZE - 1];
  const seam = getTile(seed, 0, 7);
  const wrapped = getTile(seed, WORLD_WIDTH, 7);
  const checks = [
    { id: 'tile-determinism', ok: JSON.stringify(a) === JSON.stringify(b), note: 'same tile request returns identical output' },
    { id: 'chunk-determinism', ok: JSON.stringify(northEast) === JSON.stringify(getChunk(seed, 0, 0)), note: 'same chunk request returns identical output' },
    { id: 'neighbor-seam', ok: eastEdge.x === 15 && westEdge.x === 40_074_999, note: 'adjacent chunks preserve global coordinates' },
    { id: 'x-wrap', ok: JSON.stringify(seam) === JSON.stringify(wrapped), note: 'tile generation respects the root X wrap' }
  ];
  const result={ passed: checks.every((check) => check.ok), checks };
  tileSelfTestCache.set(seed,result);
  return result;
}


const CHUNK_CACHE_LIMIT = 128;
const chunkCache = new Map();
const tileSelfTestCache = new Map();

function invalidateChunkForTile(seed, x, y) {
  const p = normalizeCoordinates(x, y);
  const chunkX = Math.floor(p.x / CHUNK_SIZE);
  const chunkY = Math.floor(p.y / CHUNK_SIZE);
  chunkCache.delete(chunkCacheKey(seed, chunkX, chunkY));
}

function chunkCacheKey(seed, chunkX, chunkY) {
  return String(seed) + '|' + String(chunkX) + '|' + String(chunkY);
}

export function getCachedChunk(seed, chunkX, chunkY) {
  const key = chunkCacheKey(seed, chunkX, chunkY);
  const hit = chunkCache.get(key);
  if (hit) {
    chunkCache.delete(key);
    chunkCache.set(key, hit);
    return { chunk: hit, cacheHit: true };
  }
  const chunk = getChunk(seed, chunkX, chunkY);
  chunkCache.set(key, chunk);
  while (chunkCache.size > CHUNK_CACHE_LIMIT) chunkCache.delete(chunkCache.keys().next().value);
  return { chunk, cacheHit: false };
}

export function worldCacheStats() {
  return { chunks: chunkCache.size, capacity: CHUNK_CACHE_LIMIT };
}

export function prefetchChunks(seed, centerChunkX, centerChunkY, radius=1) {
  for(let dy=-radius;dy<=radius;dy+=1) for(let dx=-radius;dx<=radius;dx+=1) getCachedChunk(seed,centerChunkX+dx,centerChunkY+dy);
}
