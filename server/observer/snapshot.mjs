import { sampleClimate, sampleGrid, rootSelfTest, WORLD_HEIGHT, WORLD_WIDTH, normalizeCoordinates, classifyTerrain, terrainTransformSignature, terrainSelfTest } from '../root/climate.mjs';
import { makePlaceholderSlots } from './manifest.mjs';
import { CHUNK_SIZE, getCachedChunk, getTile, rootTileSelfTest, worldCacheStats } from '../root/tile.mjs';
import { getPlayerState } from '../systems-state.mjs';
import { getLocationNames, namingSelfTest, namingSignature } from '../root/naming.mjs';
import { ecsSelfTest, ecsStats } from '../root/ecs.mjs';

export function makeObserverSnapshot({ seed = 'atlas-root', x = 0, y = Math.floor(WORLD_HEIGHT / 2), playerId = 'local-player' } = {}) {
  const player = getPlayerState({ playerId, seed, x, y });
  const ecs = ecsSelfTest();
  const climate = sampleClimate(seed, player.position.x, player.position.y);
  const grid = sampleGrid(seed, climate.x, climate.y, 4);
  const root = rootSelfTest(seed);
  const tileRoot = rootTileSelfTest(seed);
  const terrainRoot = terrainSelfTest(seed);
  const namingRoot = namingSelfTest(seed);
  const chunkX = Math.floor(climate.x / CHUNK_SIZE);
  const chunkY = Math.floor(climate.y / CHUNK_SIZE);
  const chunk = getCachedChunk(seed, chunkX, chunkY).chunk;
  const location = getLocationNames(seed, climate.x, climate.y);
  const terrain = classifyTerrain(seed, climate.x, climate.y);
  const slots = makePlaceholderSlots({
    'world.seed': seed, 'world.tick': player.tick, 'world.time': player.simulationTime,
    'player.position': `${player.position.x}, ${player.position.y}, z???`, 'player.area': location.area.name,
    'climate.elevation': climate.elevation, 'climate.temperature': climate.temperature, 'climate.moisture': climate.moisture, 'terrain.biome': climate.biome, 'terrain.landform': terrain.landform, 'terrain.waterform': terrain.waterform,
    'system.socket': 'not plugged', 'system.database': 'not plugged', 'system.tickRate': player.tickRate, 'system.ecs': 'online',
    'interaction.lastAction': player.lastAction ? player.lastAction.type : '???',
    'location.continent': location.continent.name,
    'location.territory': location.territory.name,
    'location.region': location.region.name,
    'location.tract': location.tract.name,
    'location.area': location.area.name
  });
  return {
    observer: { version: '0.1.0', mode: 'development', shell: 'Atlas Observer', philosophy: 'sites-inside-browser-shell' },
    ecs: { layer: 6, status: ecs.passed ? 'PASS' : 'FAIL', stats: ecsStats(), checks: ecs.checks },
    world: { width: WORLD_WIDTH, height: WORLD_HEIGHT, xWraps: true, yWraps: false },
    player: { id: player.id, position: player.position, tick: player.tick, simulationTime: player.simulationTime, tickRate: player.tickRate, lastAction: player.lastAction, lastInspection: player.lastInspection },
    focus: { ...climate, terrain }, grid, slots, location,
    tile: { layer: 2, chunkSize: CHUNK_SIZE, chunkX, chunkY, origin: chunk.origin, tileCount: chunk.tiles.length, source: chunk.tiles[0]?.source || '???', status: tileRoot.passed ? 'PASS' : 'FAIL', checks: tileRoot.checks },
    root: { layer: 1, name: 'Root Climate', status: root.passed ? 'PASS' : 'FAIL', checks: root.checks, samples: root.samples },
    naming: { layer: 3, status: namingRoot.passed ? 'PASS' : 'FAIL', signature: namingSignature(seed, climate.x, climate.y), checks: namingRoot.checks },
    terrain: { layer: 4, status: terrainRoot.passed ? 'PASS' : 'FAIL', signature: terrainTransformSignature(seed, climate.x, climate.y), checks: terrainRoot.checks },
    cache: worldCacheStats(),
    branches: [
      { layer: 2, name: 'Tile & chunk generation', status: 'PASS' },
      { layer: 3, name: 'Naming hierarchy', status: namingRoot.passed ? 'PASS' : 'FAIL' },
      { layer: 4, name: 'Terrain transform + hydrology', status: terrainRoot.passed ? 'PASS' : 'FAIL' },
      { layer: 5, name: 'Interaction & Move system', status: 'PASS' },
      { layer: 6, name: 'Pokémon ECS', status: 'PASS' },
      { layer: 7, name: 'Spawning & population', status: 'UNPLUGGED' },
      { layer: 8, name: 'Trust / Follow / Riding / Teleport', status: 'UNPLUGGED' },
      { layer: 9, name: 'Growth & Evolution', status: 'UNPLUGGED' },
      { layer: 10, name: 'Reproduction', status: 'UNPLUGGED' },
      { layer: 11, name: 'Incidents / Death / World Events', status: 'UNPLUGGED' },
      { layer: 12, name: 'Player systems', status: 'UNPLUGGED' }
    ]
  };
}

export function makeRealtimeSnapshot({ seed='atlas-root', playerId='local-player', x=0, y=Math.floor(WORLD_HEIGHT/2) }={}) {
  const player=getPlayerState({playerId,seed,x,y});
  const focus=sampleClimate(seed,player.position.x,player.position.y);
  const terrain=classifyTerrain(seed,focus.x,focus.y);
  const location=getLocationNames(seed,focus.x,focus.y);
  const grid=sampleGrid(seed,focus.x,focus.y,4);
  const chunkX=Math.floor(focus.x/CHUNK_SIZE),chunkY=Math.floor(focus.y/CHUNK_SIZE);
  const chunk=getCachedChunk(seed,chunkX,chunkY).chunk;
  const tileRoot=rootTileSelfTest(seed);
  const slots=makePlaceholderSlots({
    'world.seed':seed,'world.tick':player.tick,'world.time':player.simulationTime,
    'player.position':player.position.x+', '+player.position.y+', z???','player.area':location.area.name,
    'climate.elevation':focus.elevation,'climate.temperature':focus.temperature,'climate.moisture':focus.moisture,
    'terrain.biome':focus.biome,'terrain.landform':terrain.landform,'terrain.waterform':terrain.waterform,
    'system.socket':'not plugged','system.database':'not plugged','system.tickRate':player.tickRate,'system.ecs':'online',
    'interaction.lastAction':player.lastAction?player.lastAction.type:'???',
    'location.continent':location.continent.name,'location.territory':location.territory.name,
    'location.region':location.region.name,'location.tract':location.tract.name,'location.area':location.area.name
  });
  return {serverTime:Date.now(),world:{width:WORLD_WIDTH,height:WORLD_HEIGHT,xWraps:true,yWraps:false},player:{id:player.id,position:player.position,tick:player.tick,simulationTime:player.simulationTime,tickRate:player.tickRate,lastAction:player.lastAction,lastInspection:player.lastInspection},focus:{...focus,terrain},grid,slots,location,tile:{layer:2,chunkSize:CHUNK_SIZE,chunkX,chunkY,origin:chunk.origin,tileCount:chunk.tiles.length,source:chunk.tiles[0]?.source||'???',status:tileRoot.passed?'PASS':'FAIL'},cache:worldCacheStats()};
}

export function makeGameSnapshot({ seed = 'atlas-root', x = 0, y = Math.floor(WORLD_HEIGHT / 2), radiusX = 7, radiusY = 5, playerId = 'local-player' } = {}) {
  const player = getPlayerState({ playerId, seed, x, y });
  const center = sampleClimate(seed, player.position.x, player.position.y);
  const tiles = [];
  const generated = new Set();
  const reused = new Set();
  for (let dy = -radiusY; dy <= radiusY; dy += 1) {
    for (let dx = -radiusX; dx <= radiusX; dx += 1) {
      const p = normalizeCoordinates(center.x + dx, center.y + dy);
      const cx = Math.floor(p.x / CHUNK_SIZE);
      const cy = Math.floor(p.y / CHUNK_SIZE);
      const cached = getCachedChunk(seed, cx, cy);
      const key = cx + ',' + cy;
      (cached.cacheHit ? reused : generated).add(key);
      const localX = p.x - cached.chunk.origin.x;
      const localY = p.y - cached.chunk.origin.y;
      const tile = cached.chunk.tiles[localY * CHUNK_SIZE + localX] || getTile(seed, p.x, p.y);
      tiles.push({ ...tile, dx, dy });
    }
  }
  return { seed, center: { x: center.x, y: center.y }, player: { id: player.id, position: player.position, tick: player.tick, lastAction: player.lastAction }, radiusX, radiusY, width: radiusX * 2 + 1, height: radiusY * 2 + 1, tiles, stream: { generated: [...generated], reused: [...reused] } };
}
