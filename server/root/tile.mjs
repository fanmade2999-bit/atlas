/**
 * Project Atlas — Root Tile & Chunk Generation
 * Layer 1 after climate: deterministic baseline tiles and 16x16 chunks.
 *
 * getTile() is deliberately an override gate. A future persistence layer can
 * supply a modified tile without changing the baseline generation contract.
 */
import { normalizeCoordinates, sampleClimate, WORLD_HEIGHT, WORLD_WIDTH } from './climate.mjs';

export const CHUNK_SIZE = 16;

export function tileKey(x, y) {
  const p = normalizeCoordinates(x, y);
  return `${p.x},${p.y}`;
}

export function getTile(seed, x, y, overrides = null) {
  const position = normalizeCoordinates(x, y);
  const key = tileKey(position.x, position.y);
  const override = overrides?.[key];
  if (override) return { ...position, ...override, source: 'override' };
  const climate=sampleClimate(seed, position.x, position.y); return { ...position, ...climate, source: 'baseline' };
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
  return { passed: checks.every((check) => check.ok), checks };
}


const CHUNK_CACHE_LIMIT = 128;
const chunkCache = new Map();

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
