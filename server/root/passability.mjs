/**
 * Atlas traversal rules.
 *
 * Passability is derived from the effective tile, so Layer 4 transforms
 * automatically participate in movement rules without duplicating terrain
 * logic inside the movement system.
 */

const PASSABLE_SURFACES = new Set([
  'forest-floor','meadow','grass','cold-grass','wet-ground',
  'sand','tundra','rocky-grass','snow','scorched-dirt'
]);

const NON_PASSABLE_SURFACES = new Set([
  'water-deep','water-shallow','water-lake','water-river',
  'swamp','water-pond','stone-wall'
]);

export function isTilePassable(tile, { mode = 'walk' } = {}) {
  if (!tile) return false;

  // Traversal abilities are intentionally limited for this milestone.
  // Future modes can opt into swimming, climbing, surfacing, etc.
  if (mode !== 'walk') return false;

  if (NON_PASSABLE_SURFACES.has(tile.surface)) return false;
  if (tile.surface === 'ice') return true;

  const waterform = tile.waterform || tile.hydrology?.waterform || 'None';
  if (waterform !== 'None') return false;

  const landform = tile.landform || '';
  if (landform === 'Mountain' || landform === 'Peak') return false;

  return PASSABLE_SURFACES.has(tile.surface);
}

export function getTilePassability(tile, options = {}) {
  return {
    passable: isTilePassable(tile, options),
    mode: options.mode || 'walk'
  };
}
