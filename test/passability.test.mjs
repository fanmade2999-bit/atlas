import test from 'node:test';
import assert from 'node:assert/strict';
import { isTilePassable } from '../server/root/passability.mjs';
import { getTile } from '../server/root/tile.mjs';
import { resolveMove } from '../server/root/move.mjs';

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

test('movement rejects a blocked destination and preserves the position', () => {
  const result = resolveMove(
    10,
    20,
    'right',
    'movement-passability',
    () => ({ x: 11, y: 20, surface: 'water-lake', waterform: 'Lake', passable: false })
  );
  assert.equal(result.ok, false);
  assert.equal(result.reason, 'blocked-tile');
  assert.equal(result.passable, false);
  assert.deepEqual(result.from, { x: 10, y: 20 });
  assert.deepEqual(result.to, { x: 11, y: 20 });
});

test('movement accepts a passable destination', () => {
  const result = resolveMove(
    10,
    20,
    'right',
    'movement-passability-open',
    () => ({ x: 11, y: 20, surface: 'grass', waterform: 'None', passable: true })
  );
  assert.equal(result.ok, true);
  assert.equal(result.passable, true);
  assert.deepEqual(result.to, { x: 11, y: 20 });
});

test('generated transformed ground can remain passable', () => {
  assert.equal(isTilePassable({ surface: 'scorched-dirt', waterform: 'None' }), true);
  assert.equal(isTilePassable({ surface: 'water-pond', waterform: 'Lake' }), false);
  assert.equal(isTilePassable({ surface: 'stone-wall', waterform: 'None' }), false);
});
