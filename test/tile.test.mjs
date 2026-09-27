import test from 'node:test';
import assert from 'node:assert/strict';
import { CHUNK_SIZE, getChunk, getTile, rootTileSelfTest } from '../server/root/tile.mjs';
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
