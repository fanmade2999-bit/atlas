/**
 * Project Atlas — Interaction & Move root branch.
 *
 * Movement is intentionally small and data-first: one input produces one tile
 * transition. Coordinate normalization remains owned by Root Climate.
 */
import { normalizeCoordinates, WORLD_HEIGHT, WORLD_WIDTH } from './climate.mjs';

export const MOVE_ACTIONS = Object.freeze({
  up: [0, -1],
  down: [0, 1],
  left: [-1, 0],
  right: [1, 0]
});

export function movePosition(x, y, direction) {
  const delta = MOVE_ACTIONS[direction];
  if (!delta) return { ok: false, reason: 'unknown-direction', position: normalizeCoordinates(x, y) };
  const from = normalizeCoordinates(x, y);
  const to = normalizeCoordinates(from.x + delta[0], from.y + delta[1]);
  return { ok: true, direction, from, to, delta: { x: delta[0], y: delta[1] },
    wrappedX: delta[0] !== 0 && to.x !== from.x + delta[0],
    cappedY: delta[1] !== 0 && to.y !== from.y + delta[1] };
}

export function inspectPosition(x, y) {
  const position = normalizeCoordinates(x, y);
  return { position, world: { width: WORLD_WIDTH, height: WORLD_HEIGHT, xWraps: true, yWraps: false } };
}
