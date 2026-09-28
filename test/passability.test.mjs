import test from 'node:test';
import assert from 'node:assert/strict';
import { isTilePassable } from '../server/root/passability.mjs';
import { getTile } from '../server/root/tile.mjs';
import { WORLD_HEIGHT, WORLD_WIDTH, sampleElevation } from '../server/root/climate.mjs';
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

function findBoundaryPair(seed) {
  const steps = 48;
  const xStep = WORLD_WIDTH / steps;
  const yStep = (WORLD_HEIGHT - 1) / steps;
  for (let gy = 0; gy < steps; gy += 1) {
    for (let gx = 0; gx < steps; gx += 1) {
      const x = Math.floor(gx * xStep), y = Math.floor(gy * yStep);
      const here = sampleElevation(seed, x, y);
      for (const axis of ['x', 'y']) {
        const nx = axis === 'x' ? Math.min(WORLD_WIDTH - 1, Math.floor((gx + 1) * xStep)) : x;
        const ny = axis === 'y' ? Math.min(WORLD_HEIGHT - 1, Math.floor((gy + 1) * yStep)) : y;
        const there = sampleElevation(seed, nx, ny);
        if ((here - 0.30) * (there - 0.30) <= 0 && Math.abs(here - there) > 0.000001) {
          const distance = axis === 'x' ? Math.abs(nx - x) : Math.abs(ny - y);
          let lo = 0, hi = distance, a = { x, y };
          for (let i = 0; i < 26 && hi - lo > 2; i += 1) {
            const mid = Math.floor((lo + hi) / 2);
            const px = axis === 'x' ? Math.min(WORLD_WIDTH - 1, x + Math.sign(nx - x) * mid) : x;
            const py = axis === 'y' ? Math.min(WORLD_HEIGHT - 1, y + Math.sign(ny - y) * mid) : y;
            const em = sampleElevation(seed, px, py);
            if ((here - 0.30) * (em - 0.30) <= 0) { hi = mid; } else { lo = mid; a = { x: px, y: py }; }
          }
          const cx = a.x, cy = a.y;
          for (let oy = -2; oy <= 2; oy += 1) {
            for (let ox = -2; ox <= 2; ox += 1) {
              const px = Math.max(0, Math.min(WORLD_WIDTH - 1, cx + ox));
              const py = Math.max(0, Math.min(WORLD_HEIGHT - 1, cy + oy));
              const candidates = [
                { x: px, y: py, direction: 'right' },
                { x: px, y: py, direction: 'down' }
              ];
              for (const candidate of candidates) {
                const dx = candidate.direction === 'right' ? 1 : 0;
                const dy = candidate.direction === 'down' ? 1 : 0;
                const origin = getTile(seed, candidate.x, candidate.y);
                const destination = getTile(seed, candidate.x + dx, candidate.y + dy);
                if (origin.passable && !destination.passable) return { ...candidate, destination };
              }
            }
          }
        }
      }
    }
  }
  throw new Error('could not find a deterministic passable-to-blocked adjacent terrain pair');
}

function findOpenPair(seed) {
  const steps = 48;
  const xStep = WORLD_WIDTH / steps;
  const yStep = (WORLD_HEIGHT - 1) / steps;
  for (let gy = 0; gy < steps; gy += 1) {
    for (let gx = 0; gx < steps; gx += 1) {
      const x = Math.floor(gx * xStep), y = Math.floor(gy * yStep);
      const e = sampleElevation(seed, x, y);
      if (e < 0.40 || e > 0.62) continue;
      const origin = getTile(seed, x, y);
      if (!origin.passable) continue;
      for (const direction of ['right', 'down']) {
        const dx = direction === 'right' ? 1 : 0;
        const dy = direction === 'down' ? 1 : 0;
        const destination = getTile(seed, x + dx, y + dy);
        if (destination.passable) return { seed, x, y, direction };
      }
    }
  }
  throw new Error('expected a deterministic pair of adjacent passable tiles');
}

test('server movement refuses a non-passable destination', () => {
  const pair = findBoundaryPair('movement-passability');
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
