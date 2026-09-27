import test from 'node:test';
import assert from 'node:assert/strict';
import { makeGameSnapshot } from '../server/observer/snapshot.mjs';
import { WORLD_HEIGHT, WORLD_WIDTH } from '../server/root/climate.mjs';

test('game viewport reads deterministic root tiles', () => {
  const a = makeGameSnapshot({ seed: 'game-test', x: 10, y: 20 });
  const b = makeGameSnapshot({ seed: 'game-test', x: 10, y: 20 });
  assert.deepEqual(a.tiles, b.tiles);
  assert.deepEqual(a.center, b.center);
  assert.deepEqual(a.stream, b.stream);
  assert.equal(a.tiles.length, 225);
  assert.equal(a.center.x, 10);
  assert.equal(a.center.y, 20);
});

test('game viewport respects X wrapping and Y cap', () => {
  const wrapped = makeGameSnapshot({ seed: 'game-test', x: WORLD_WIDTH, y: WORLD_HEIGHT, playerId: 'boundary-test' });
  assert.equal(wrapped.center.x, 0);
  assert.equal(wrapped.center.y, WORLD_HEIGHT - 1);
});

import { movePosition, inspectPosition } from '../server/root/move.mjs';

test('move system advances exactly one normalized tile', () => {
  assert.deepEqual(movePosition(10, 20, 'right').to, { x: 11, y: 20 });
  assert.deepEqual(movePosition(10, 20, 'up').to, { x: 10, y: 19 });
});

test('move system uses root X wrap and Y cap', () => {
  assert.equal(movePosition(WORLD_WIDTH - 1, 20, 'right').to.x, 0);
  assert.equal(movePosition(20, 0, 'up').to.y, 0);
  assert.equal(movePosition(20, WORLD_HEIGHT - 1, 'down').to.y, WORLD_HEIGHT - 1);
});

test('inspect system reports normalized position without inventing terrain', () => {
  const result = inspectPosition(WORLD_WIDTH, WORLD_HEIGHT + 5);
  assert.deepEqual(result.position, { x: 0, y: WORLD_HEIGHT - 1 });
  assert.ok(result.terrain);
  assert.equal(typeof result.terrain.landform, 'string');
  assert.equal(typeof result.terrain.waterform, 'string');
});

test('game snapshot exposes persistent player state', () => {
  const a = makeGameSnapshot({ seed: 'state-test', x: 7, y: 8, playerId: 'state-player' });
  assert.deepEqual(a.player.position, { x: 7, y: 8 });
  assert.equal(typeof a.player.tick, 'number');
  assert.ok(a.player.tick >= 0);
  assert.ok(a.stream);
  assert.ok(Array.isArray(a.stream.generated));
  assert.ok(Array.isArray(a.stream.reused));
});


import { teleportPlayer } from '../server/systems-state.mjs';

test('teleport is explicit and normalizes destination coordinates', () => {
  const result = teleportPlayer({ playerId: 'teleport-test', seed: 'game-test', x: WORLD_WIDTH, y: WORLD_HEIGHT + 99 });
  assert.equal(result.result.ok, true);
  assert.deepEqual(result.player.position, { x: 0, y: WORLD_HEIGHT - 1 });
  assert.equal(result.player.lastAction.type, 'teleport');
});


test('game and map use the same deterministic world vocabulary', () => {
  const a = makeGameSnapshot({ seed: 'linked-test', x: 1234, y: 5678 });
  assert.equal(typeof a.center.x, 'number');
  assert.equal(typeof a.center.y, 'number');
  assert.ok(a.tiles.some(t => t.biome === a.center.biome));
});
