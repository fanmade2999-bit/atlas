/**
 * Observer contract: stable slots can exist before their backing systems exist.
 * Unknown/unplugged slots intentionally return null, rendered by the client as ???.
 */
export const OBSERVER_SLOTS = [
  ['world.seed', 'Seed', 'world'], ['world.tick', 'Tick', 'world'], ['world.time', 'Time', 'world'],
  ['player.position', 'Position', 'player'], ['player.area', 'Area', 'player'],
  ['climate.elevation', 'Elevation', 'climate'], ['climate.temperature', 'Temperature', 'climate'], ['climate.moisture', 'Moisture', 'climate'],
  ['terrain.biome', 'Biome', 'terrain'], ['terrain.landform', 'Landform', 'terrain'], ['terrain.waterform', 'Waterform', 'terrain'],
  ['location.continent', 'Continent', 'location'], ['location.territory', 'Territory', 'location'], ['location.region', 'Region', 'location'], ['location.tract', 'Tract', 'location'], ['location.area', 'Area', 'location'],
  ['population.total', 'Pokémon', 'population'], ['population.active', 'Active', 'population'], ['population.dormant', 'Dormant', 'population'],
  ['system.socket', 'Socket', 'system'], ['system.database', 'Database', 'system'], ['system.tickRate', 'Tick rate', 'system']
];

export function makePlaceholderSlots(overrides = {}) {
  return Object.fromEntries(OBSERVER_SLOTS.map(([id, label, group]) => [
    id, { id, label, group, value: overrides[id] ?? null, plugged: id in overrides }
  ]));
}
