import { sampleClimate, sampleGrid, rootSelfTest, WORLD_HEIGHT, WORLD_WIDTH } from '../root/climate.mjs';
import { makePlaceholderSlots } from './manifest.mjs';
import { CHUNK_SIZE, getChunk, getTile, rootTileSelfTest } from '../root/tile.mjs';
import { getPlayerState } from '../systems-state.mjs';
import { getLocationNames } from '../root/naming.mjs';

export function makeObserverSnapshot({ seed = 'atlas-root', x = 0, y = Math.floor(WORLD_HEIGHT / 2), playerId = 'local-player' } = {}) {
  const player = getPlayerState({ playerId, seed, x, y });
  const climate = sampleClimate(seed, player.position.x, player.position.y);
  const grid = sampleGrid(seed, climate.x, climate.y, 4);
  const root = rootSelfTest(seed);
  const tileRoot = rootTileSelfTest(seed);
  const chunkX = Math.floor(climate.x / CHUNK_SIZE);
  const chunkY = Math.floor(climate.y / CHUNK_SIZE);
  const chunk = getChunk(seed, chunkX, chunkY);
  const location = getLocationNames(seed, climate.x, climate.y);
  const slots = makePlaceholderSlots({
    'world.seed': seed, 'world.tick': player.tick, 'world.time': '???',
    'player.position': `${player.position.x}, ${player.position.y}, z???`,
    'climate.elevation': climate.elevation, 'climate.temperature': climate.temperature, 'climate.moisture': climate.moisture,
    'system.socket': 'not plugged', 'system.database': 'not plugged', 'system.tickRate': '???',
    'interaction.lastAction': player.lastAction ? player.lastAction.type : '???',
    'location.continent': location.continent.name,
    'location.territory': location.territory.name,
    'location.region': location.region.name,
    'location.tract': location.tract.name,
    'location.area': location.area.name
  });
  return {
    observer: { version: '0.1.0', mode: 'development', shell: 'Atlas Observer', philosophy: 'sites-inside-browser-shell' },
    world: { width: WORLD_WIDTH, height: WORLD_HEIGHT, xWraps: true, yWraps: false },
    player: { id: player.id, position: player.position, tick: player.tick, lastAction: player.lastAction, lastInspection: player.lastInspection },
    focus: climate, grid, slots, location,
    tile: { layer: 2, chunkSize: CHUNK_SIZE, chunkX, chunkY, origin: chunk.origin, tileCount: chunk.tiles.length, source: chunk.tiles[0]?.source || '???', status: tileRoot.passed ? 'PASS' : 'FAIL', checks: tileRoot.checks },
    root: { layer: 1, name: 'Root Climate', status: root.passed ? 'PASS' : 'FAIL', checks: root.checks, samples: root.samples },
    branches: [
      { layer: 2, name: 'Tile & chunk generation', status: 'PASS' },
      { layer: 3, name: 'Naming hierarchy', status: 'PASS' },
      { layer: 4, name: 'Terrain transform table', status: 'UNPLUGGED' },
      { layer: 5, name: 'Interaction & Move system', status: 'PASS' },
      { layer: 6, name: 'Pokémon ECS', status: 'UNPLUGGED' },
      { layer: 7, name: 'Spawning & population', status: 'UNPLUGGED' },
      { layer: 8, name: 'Trust / Follow / Riding / Teleport', status: 'UNPLUGGED' },
      { layer: 9, name: 'Growth & Evolution', status: 'UNPLUGGED' },
      { layer: 10, name: 'Reproduction', status: 'UNPLUGGED' },
      { layer: 11, name: 'Incidents / Death / World Events', status: 'UNPLUGGED' },
      { layer: 12, name: 'Player systems', status: 'UNPLUGGED' }
    ]
  };
}

export function makeGameSnapshot({ seed = 'atlas-root', x = 0, y = Math.floor(WORLD_HEIGHT / 2), radiusX = 7, radiusY = 5, playerId = 'local-player' } = {}) {
  const player = getPlayerState({ playerId, seed, x, y });
  const center = sampleClimate(seed, player.position.x, player.position.y);
  const tiles = [];
  for (let dy = -radiusY; dy <= radiusY; dy += 1) {
    for (let dx = -radiusX; dx <= radiusX; dx += 1) tiles.push({ ...getTile(seed, center.x + dx, center.y + dy), dx, dy });
  }
  return { seed, center: { x: center.x, y: center.y }, player: { id: player.id, position: player.position, tick: player.tick, lastAction: player.lastAction }, radiusX, radiusY, width: radiusX * 2 + 1, height: radiusY * 2 + 1, tiles };
}
