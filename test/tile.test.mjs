import test from 'node:test';
import assert from 'node:assert/strict';
import { CHUNK_SIZE, getChunk, getTile, rootTileSelfTest, applyTileTransform, recoverTileTransform, getTileTransform } from '../server/root/tile.mjs';
import { WORLD_WIDTH } from '../server/root/climate.mjs';

test('tile generation is deterministic', () => {
  assert.deepEqual(getTile('test-seed', 12345, 67890), getTile('test-seed', 12345, 67890));
});

test('chunk generation is deterministic', () => {
  assert.deepEqual(getChunk('test-seed', 7, 8), getChunk('test-seed', 7, 8));
});

test('chunks contain exactly 16x16 tiles', () => {
  const chunk = getChunk('test-seed', 7, 8);
  assert.equal(chunk.size, CHUNK_SIZE);
  assert.equal(chunk.tiles.length, CHUNK_SIZE * CHUNK_SIZE);
});

test('neighboring chunks preserve coordinate continuity', () => {
  const left = getChunk('test-seed', 0, 0);
  const right = getChunk('test-seed', 1, 0);
  assert.equal(left.tiles[15].x + 1, right.tiles[0].x);
  assert.equal(left.tiles[15].y, right.tiles[0].y);
});

test('chunk handles the non-divisible X world boundary by wrapping inside the final chunk', () => {
  const last = getChunk('test-seed', Math.floor(WORLD_WIDTH / CHUNK_SIZE), 0);
  assert.equal(last.tiles[7].x, WORLD_WIDTH - 1);
  assert.equal(last.tiles[8].x, 0);
  assert.ok(Math.abs(last.tiles[7].elevation - getTile('test-seed', WORLD_WIDTH - 1, 7).elevation) < 1e-9);
  assert.ok(Math.abs(last.tiles[8].elevation - getTile('test-seed', 0, 8).elevation) < 1e-9);
});

test('override gate replaces baseline without changing tile identity', () => {
  const base = getTile('test-seed', 5, 6);
  const overridden = getTile('test-seed', 5, 6, { '5,6': { elevation: 0.99, marker: 'DB' } });
  assert.equal(overridden.x, base.x);
  assert.equal(overridden.y, base.y);
  assert.equal(overridden.elevation, 0.99);
  assert.equal(overridden.source, 'override');
});

test('tile root self test passes', () => {
  assert.equal(rootTileSelfTest('test-seed').passed, true);
});


test('Layer 4 transform is resolved by getTile without mutating the baseline contract', () => {
  const seed = 'l4-tile-integration';
  const x = 101;
  const y = 202;
  const baseline = getTile(seed, x, y);
  const applied = applyTileTransform({
    seed,
    x,
    y,
    moveType: 'fire',
    recovery: { type: 'timer', durationMs: 1000 }
  });

  // The test coordinate must be grass for the transform to be applicable.
  // If the deterministic terrain is not grass, the transform engine correctly
  // rejects the action and the baseline remains untouched.
  if (baseline.surface === 'grass') {
    assert.equal(applied.ok, true);
    assert.equal(getTileTransform(seed, x, y)?.transformId, 'fire-grass-scorch');
    assert.equal(getTile(seed, x, y).surface, 'scorched-dirt');
    assert.equal(baseline.surface, 'grass');

    const recovered = recoverTileTransform(seed, x, y, {
      tile: getTile(seed, x, y),
      now: Date.now() + 1001
    });
    assert.equal(recovered.recovered, true);
    assert.equal(getTile(seed, x, y).surface, 'grass');
  } else {
    assert.equal(applied.ok, false);
    assert.equal(getTile(seed, x, y).surface, baseline.surface);
  }
});

test('Layer 4 transformed chunk tiles remain addressable by coordinate', () => {
  const seed = 'l4-chunk-integration';
  const x = 17;
  const y = 16;
  const baseline = getTile(seed, x, y);
  const applied = applyTileTransform({
    seed,
    x,
    y,
    moveType: 'fire',
    recovery: { type: 'timer', durationMs: 1000 }
  });

  if (baseline.surface === 'grass') {
    assert.equal(applied.ok, true);
    const chunk = getChunk(seed, 1, 1);
    const tile = chunk.tiles.find(item => item.x === x && item.y === y);
    assert.equal(tile?.surface, 'scorched-dirt');
    recoverTileTransform(seed, x, y, { tile, now: Date.now() + 1001 });
  } else {
    assert.equal(applied.ok, false);
  }
});


test('Layer 4 invalidates a cached chunk after a terrain transform', () => {
  const seed = 'l4-cache-invalidation';
  const x = 33;
  const y = 34;
  const baselineChunk = getChunk(seed, 2, 2);
  const baseline = getTile(seed, x, y);
  const applied = applyTileTransform({
    seed,
    x,
    y,
    moveType: 'fire',
    recovery: { type: 'timer', durationMs: 1000 }
  });

  if (baseline.surface === 'grass') {
    assert.equal(applied.ok, true);
    const refreshed = getChunk(seed, 2, 2);
    const tile = refreshed.tiles.find(item => item.x === x && item.y === y);
    assert.equal(tile?.surface, 'scorched-dirt');
    recoverTileTransform(seed, x, y, { tile, now: Date.now() + 1001 });
    const restored = getChunk(seed, 2, 2).tiles.find(item => item.x === x && item.y === y);
    assert.equal(restored?.surface, 'grass');
  } else {
    assert.equal(applied.ok, false);
    assert.deepEqual(getChunk(seed, 2, 2), baselineChunk);
  }
});
