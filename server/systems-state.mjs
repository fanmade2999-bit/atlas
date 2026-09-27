/** Development-only in-memory player state. Persistence is deliberately not
 * introduced until the database branch is implemented. */
import { normalizeCoordinates } from './root/climate.mjs';
import { movePosition, inspectPosition } from './root/move.mjs';

const players = new Map();

function keyFor(playerId = 'local-player') {
  return String(playerId || 'local-player');
}

export function getPlayerState({ playerId = 'local-player', seed = 'atlas-root', x = 0, y = 10001500 } = {}) {
  const key = keyFor(playerId);
  if (!players.has(key)) {
    players.set(key, { id: key, seed, position: normalizeCoordinates(x, y), tick: 0, lastAction: null, lastInspection: null });
  }
  const player = players.get(key);
  if (player.seed !== seed) player.seed = seed;
  return player;
}

export function movePlayer({ playerId, seed, x, y, direction }) {
  const player = getPlayerState({ playerId, seed, x, y });
  const result = movePosition(player.position.x, player.position.y, direction);
  if (result.ok) {
    player.position = result.to;
    player.tick += 1;
    player.lastAction = { type: 'move', direction, from: result.from, to: result.to, tick: player.tick };
  }
  return { player, result };
}

export function inspectPlayer({ playerId, seed, x, y }) {
  const player = getPlayerState({ playerId, seed, x, y });
  player.lastInspection = inspectPosition(player.position.x, player.position.y);
  player.lastAction = { type: 'inspect', tick: player.tick };
  return { player, inspection: player.lastInspection };
}
