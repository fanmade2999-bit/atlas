import test from 'node:test';
import assert from 'node:assert/strict';
import { isTilePassable } from '../server/root/passability.mjs';
import { getTile } from '../server/root/tile.mjs';
import { movePlayer } from '../server/systems-state.mjs';

test('passability rules distinguish normal ground from blocking terrain', () => {
  assert.equal(isTilePassable({ surface: 'grass', waterform: 'None' }), true);
  assert.equal(isTilePassable({ surface: 'forest-floor', waterform: 'None' }), true);
  assert.equal(isTilePassable({ surface: 'water-deep', waterform: 'Ocean' }), false);
  assert.equal(isTilePassable({ surface: 'water-lake', waterform: 'Lake' }), false);
  assert.equal(isTilePassable({ surface: 'stone-wall', waterform: 'None' }), false);
  assert.equal(isTilePassable({ surface: 'ice', waterform: 'Ice' }), true);
});

test('generated tiles expose a deterministic passable flag', () => {
  const a = getTile('passability-payload', 123, 456);
  const b = getTile('passability-payload', 123, 456);
  assert.equal(typeof a.passable, 'boolean');
  assert.equal(a.passable, b.passable);
});

function findAdjacentPair() {
  const seed = 'movement-passability';
  for (let y = 0; y <= 4096; y += 128) {
    for (let x = 0; x <= 4096; x += 128) {
      const origin = getTile(seed, x, y);
      for (const direction of ['right', 'down']) {
        const dx = direction === 'right' ? 1 : 0;
        const dy = direction === 'down' ? 1 : 0;
        const destination = getTile(seed, x + dx, y + dy);
        if (origin.passable && !destination.passable) return { seed, x, y, direction, destination };
      }
    }
  }
  throw new Error('could not find a deterministic passable-to-blocked adjacent terrain pair');
}

test('server movement refuses a non-passable destination', () => {
  const pair = findAdjacentPair();
  const before = getTile(pair.seed, pair.x, pair.y);
  assert.equal(before.passable, true);

  const result = movePlayer({
    playerId: 'passability-blocked',
    seed: pair.seed,
    x: pair.x,
    y: pair.y,
    direction: pair.direction
  });

  assert.equal(result.result.ok, false);
  assert.equal(result.result.reason, 'blocked-tile');
  assert.deepEqual(result.player.position, { x: pair.x, y: pair.y });
  assert.equal(result.result.passable, false);
});

test('server movement crosses a passable adjacent destination', () => {
  const seed = 'movement-passability-open';
  let pair = null;
  for (let y = 0; y <= 4096 && !pair; y += 17) {
    for (let x = 0; x <= 4096 && !pair; x += 17) {
      const origin = getTile(seed, x, y);
      for (const direction of ['right', 'down']) {
        const dx = direction === 'right' ? 1 : 0;
        const dy = direction === 'down' ? 1 : 0;
        const destination = getTile(seed, x + dx, y + dy);
        if (origin.passable && destination.passable) pair = { seed, x, y, direction };
      }
    }
  }
  assert.ok(pair, 'expected a deterministic pair of adjacent passable tiles');
  const result = movePlayer({
    playerId: 'passability-open',
    seed: pair.seed,
    x: pair.x,
    y: pair.y,
    direction: pair.direction
  });
  assert.equal(result.result.ok, true);
  assert.notDeepEqual(result.player.position, { x: pair.x, y: pair.y });
});
