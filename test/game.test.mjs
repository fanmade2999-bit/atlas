import test from 'node:test';
import assert from 'node:assert/strict';
import { makeGameSnapshot } from '../server/observer/snapshot.mjs';
import { WORLD_HEIGHT, WORLD_WIDTH } from '../server/root/climate.mjs';

test('game viewport reads deterministic root tiles', () => {
  const a = makeGameSnapshot({ seed: 'game-stream-regression', x: 10, y: 20 });
  const b = makeGameSnapshot({ seed: 'game-stream-regression', x: 10, y: 20 });
  assert.deepEqual(a.tiles, b.tiles);
  assert.deepEqual(a.center, b.center);
  assert.notDeepEqual(a.stream, b.stream);
  assert.deepEqual(a.stream.generated, ['0,0', '1,0', '0,1', '1,1']);
  assert.deepEqual(a.stream.reused, []);
  assert.deepEqual(b.stream.generated, []);
  assert.deepEqual(b.stream.reused, ['0,0', '1,0', '0,1', '1,1']);
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
  assert.equal(typeof result.tile.passable, 'boolean');
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
import { applyTileTransform, recoverTileTransform } from '../server/root/tile.mjs';

test('teleport is explicit and normalizes destination coordinates', () => {
  const result = teleportPlayer({ playerId: 'teleport-test', seed: 'game-test', x: WORLD_WIDTH, y: WORLD_HEIGHT + 99 });
  assert.equal(result.result.ok, true);
  assert.deepEqual(result.player.position, { x: 0, y: WORLD_HEIGHT - 1 });
  assert.equal(result.player.lastAction.type, 'teleport');
});


test('game and map use the same deterministic world vocabulary', () => {
  const a = makeGameSnapshot({ seed: 'linked-test', x: 1234, y: 5678, playerId: 'linked-world' });
  assert.equal(typeof a.center.x, 'number');
  assert.equal(typeof a.center.y, 'number');
  assert.ok(a.tiles.some(t => t.biome === a.focus.biome));
});


test('game snapshot carries an active Layer 4 transform to the graphical renderer', () => {
  const seed = 'l4-graphics-link';
  const base = makeGameSnapshot({ seed, x: 0, y: 17430000, playerId: 'l4-graphics' });
  const target = base.tiles.find(tile => tile.dx === 0 && tile.dy === 0);
  assert.equal(target?.surface, 'grass');

  const applied = applyTileTransform({
    seed,
    x: target.x,
    y: target.y,
    moveType: 'fire',
    sourceEntityId: 'l4-graphics',
    recovery: { type: 'timer', durationMs: 10000 }
  });
  assert.equal(applied.ok, true);

  const next = makeGameSnapshot({ seed, x: 0, y: 17430000, playerId: 'l4-graphics' });
  const transformed = next.tiles.find(tile => tile.x === target.x && tile.y === target.y);
  assert.equal(transformed?.surface, 'scorched-dirt');
  assert.equal(transformed?.transform?.id, 'fire-grass-scorch');

  recoverTileTransform(seed, target.x, target.y, { tile: transformed, now: Date.now() + 10001 });
});


test('game snapshot exposes isolated Layer 4 test fixtures separately from natural terrain', () => {
  const snapshot = makeGameSnapshot({ seed: 'l4-fixture-view', x: 100, y: 200, playerId: 'fixture-view' });
  assert.ok(Array.isArray(snapshot.testFixtures));
  assert.equal(snapshot.testFixtures.length, 5);
  assert.ok(snapshot.testFixtures.every(fixture => fixture.testOnly === true && fixture.natural === false));
  assert.ok(snapshot.testFixtures.every(fixture => fixture.naturalTarget === fixture.available));
  assert.ok(snapshot.tiles.every(tile => tile.source !== 'test-fixture'));
});


test('Layer 4 test yard finds compatible natural targets without modifying terrain', () => {
  const snapshot = makeGameSnapshot({ seed: 'l4-test-yard', x: 0, y: 10001500, playerId: 'test-yard' });
  assert.ok(Array.isArray(snapshot.testFixtures));
  assert.equal(snapshot.testFixtures.length, 5);
  assert.ok(snapshot.testFixtures.every(fixture => fixture.testOnly === true));
  assert.ok(snapshot.testFixtures.every(fixture => fixture.available === true || fixture.available === false));
});


test('changing a player world seed resets to the requested starting coordinates', () => {
  const a = makeGameSnapshot({ seed: 'seed-a', x: 111, y: 222, playerId: 'seed-switch' });
  const b = makeGameSnapshot({ seed: 'seed-b', x: 333, y: 444, playerId: 'seed-switch' });
  assert.deepEqual(a.center, { x: 111, y: 222 });
  assert.deepEqual(b.center, { x: 333, y: 444 });
});


test('game snapshot preview can target a non-persistent destination position', () => {
  const snapshot = makeGameSnapshot({
    seed: 'map-preview',
    x: 10,
    y: 20,
    playerId: 'map-preview-player',
    positionOverride: { x: 300, y: 400 }
  });
  assert.deepEqual(snapshot.center, { x: 300, y: 400 });
  assert.deepEqual(snapshot.player.position, { x: 300, y: 400 });
});
