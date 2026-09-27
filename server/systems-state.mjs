/** Development-only in-memory player state. Persistence is deliberately not
 * introduced until the database branch is implemented. */
import { normalizeCoordinates } from './root/climate.mjs';
import { movePosition, inspectPosition } from './root/move.mjs';
import { applyTileTransform, getTile, getTileTransform, recoverTileTransform } from './root/tile.mjs';

const players = new Map();
export const TICK_RATE = 20;
const TICK_MS = 1000 / TICK_RATE;

function keyFor(playerId = 'local-player') {
  return String(playerId || 'local-player');
}

export function getPlayerState({ playerId = 'local-player', seed = 'atlas-root', x = 0, y = 10001500 } = {}) {
  const key = keyFor(playerId);
  if (!players.has(key)) {
    players.set(key, { id: key, seed, position: normalizeCoordinates(x, y), startedAt: Date.now(), tick: 0, lastAction: null, lastInspection: null });
  }
  const player = players.get(key);
  if (player.seed !== seed) player.seed = seed;
  player.tick = Math.floor((Date.now() - player.startedAt) / TICK_MS);
  player.simulationTime = (Date.now() - player.startedAt) / 1000;
  player.tickRate = TICK_RATE;
  return player;
}

export function movePlayer({ playerId, seed, x, y, direction }) {
  const player = getPlayerState({ playerId, seed, x, y });
  const result = movePosition(player.position.x, player.position.y, direction);
  if (result.ok) {
    player.position = result.to;
    player.tick = Math.floor((Date.now() - player.startedAt) / TICK_MS);
    player.lastAction = { type: 'move', direction, from: result.from, to: result.to, tick: player.tick };
  }
  return { player, result };
}

export function teleportPlayer({ playerId, seed, x, y }) {
  const player = getPlayerState({ playerId, seed });
  const from = player.position;
  const to = normalizeCoordinates(x, y);
  player.position = to;
  player.tick = Math.floor((Date.now() - player.startedAt) / TICK_MS);
  player.lastAction = { type: 'teleport', from, to, tick: player.tick };
  player.lastInspection = null;
  return { player, result: { ok: true, type: 'teleport', from, to } };
}

export function transformTile({ playerId, seed, x, y, moveType, transformId = null, recovery = null } = {}) {
  const player = getPlayerState({ playerId, seed, x, y });
  const result = applyTileTransform({
    seed,
    x,
    y,
    moveType,
    transformId,
    sourceEntityId: player.id,
    recovery
  });
  if (result.ok) {
    player.lastAction = {
      type: 'terrain-transform',
      transformId: result.record.transformId,
      position: result.record.position,
      tick: player.tick
    };
  }
  return { player, result };
}

export function getTileState({ seed, x, y } = {}) {
  const tile = getTile(seed, x, y);
  return {
    tile,
    transform: getTileTransform(seed, x, y)
  };
}

export function recoverTile({ seed, x, y, now = Date.now() } = {}) {
  const tile = getTile(seed, x, y);
  return recoverTileTransform(seed, x, y, { tile, now });
}

export function inspectPlayer({ playerId, seed, x, y }) {
  const player = getPlayerState({ playerId, seed, x, y });
  player.lastInspection = inspectPosition(player.position.x, player.position.y, seed);
  player.lastAction = { type: 'inspect', tick: player.tick };
  return { player, inspection: player.lastInspection };
}
