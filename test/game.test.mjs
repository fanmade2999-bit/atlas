import test from 'node:test';
import assert from 'node:assert/strict';
import { makeGameSnapshot } from '../server/observer/snapshot.mjs';
import { WORLD_HEIGHT, WORLD_WIDTH } from '../server/root/climate.mjs';

test('game viewport reads deterministic root tiles', () => {
  const a = makeGameSnapshot({ seed: 'game-test', x: 10, y: 20 });
  const b = makeGameSnapshot({ seed: 'game-test', x: 10, y: 20 });
  assert.deepEqual(a, b);
  assert.equal(a.tiles.length, 99);
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
});

test('game snapshot exposes persistent player state', () => {
  const a = makeGameSnapshot({ seed: 'state-test', x: 7, y: 8, playerId: 'state-player' });
  assert.deepEqual(a.player.position, { x: 7, y: 8 });
  assert.equal(a.player.tick, 0);
});
