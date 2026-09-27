/**
 * Project Atlas — Root Climate Functions
 * Pure, deterministic functions of (seed, x, y).
 *
 * Current root contract:
 *   elevation    -> 0..1
 *   temperature  -> 0..1 (poles cold, equator warm, local variance)
 *   moisture     -> 0..1
 *
 * X wraps; Y is capped.
 */

export const WORLD_WIDTH = 40_075_000;
export const WORLD_HEIGHT = 20_003_000;

function clamp01(value) {
  return Math.max(0, Math.min(1, value));
}

function fade(t) {
  return t * t * (3 - 2 * t);
}

function hashString(text) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function hash2(seedValue, ix, iy, salt = '') {
  let h = hashString(`${seedValue}|${salt}`);
  h ^= Math.imul((ix | 0), 0x45d9f3b);
  h = Math.imul(h ^ (h >>> 16), 0x45d9f3b);
  h ^= Math.imul((iy | 0), 0x119de1f3);
  h = Math.imul(h ^ (h >>> 16), 0x119de1f3);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967295;
}

function periodicValueNoise(seed, x, y, xCycles, yCells, salt) {
  const u = ((x % WORLD_WIDTH) + WORLD_WIDTH) % WORLD_WIDTH / WORLD_WIDTH;
  const v = clamp01(y / (WORLD_HEIGHT - 1));
  const gx = u * xCycles;
  const gy = v * yCells;
  const x0 = Math.floor(gx);
  const x1 = (x0 + 1) % xCycles;
  const y0 = Math.floor(gy);
  const y1 = Math.min(y0 + 1, yCells);
  const tx = fade(gx - x0);
  const ty = fade(gy - y0);
  const n00 = hash2(seed, x0, y0, salt);
  const n10 = hash2(seed, x1, y0, salt);
  const n01 = hash2(seed, x0, y1, salt);
  const n11 = hash2(seed, x1, y1, salt);
  const nx0 = n00 + (n10 - n00) * tx;
  const nx1 = n01 + (n11 - n01) * tx;
  return nx0 + (nx1 - nx0) * ty;
}

function fractalNoise(seed, x, y, { baseXCells, baseYCells, octaves = 4, salt }) {
  let amplitude = 1;
  let frequency = 1;
  let sum = 0;
  let weight = 0;
  for (let octave = 0; octave < octaves; octave += 1) {
    sum += periodicValueNoise(seed, x, y,
      Math.max(1, Math.round(baseXCells * frequency)),
      Math.max(1, Math.round(baseYCells * frequency)),
      `${salt}:${octave}`) * amplitude;
    weight += amplitude;
    amplitude *= 0.5;
    frequency *= 2;
  }
  return sum / weight;
}

function latitudeHeat(y) {
  const clampedY = Math.max(0, Math.min(WORLD_HEIGHT - 1, y));
  const normalized = clampedY / (WORLD_HEIGHT - 1);
  const distanceFromEquator = Math.abs(normalized * 2 - 1);
  return 1 - distanceFromEquator * distanceFromEquator;
}

export function normalizeCoordinates(x, y) {
  const wrappedX = ((Math.trunc(x) % WORLD_WIDTH) + WORLD_WIDTH) % WORLD_WIDTH;
  const cappedY = Math.max(0, Math.min(WORLD_HEIGHT - 1, Math.trunc(y)));
  return { x: wrappedX, y: cappedY };
}

export function sampleElevation(seed, x, y) {
  ({ x, y } = normalizeCoordinates(x, y));
  return fractalNoise(seed, x, y, { baseXCells: 48, baseYCells: 24, octaves: 5, salt: 'elevation' });
}

export function sampleMoisture(seed, x, y) {
  ({ x, y } = normalizeCoordinates(x, y));
  return fractalNoise(seed, x, y, { baseXCells: 64, baseYCells: 32, octaves: 5, salt: 'moisture' });
}

export function sampleTemperature(seed, x, y) {
  ({ x, y } = normalizeCoordinates(x, y));
  const latitude = latitudeHeat(y);
  const localNoise = fractalNoise(seed, x, y, { baseXCells: 96, baseYCells: 48, octaves: 4, salt: 'temperature' });
  return clamp01(latitude * 0.78 + localNoise * 0.22);
}

export function classifyBiome(elevation, temperature, moisture) {
  if (elevation < 0.22) return 'Ocean';
  if (elevation > 0.82) return temperature < 0.35 ? 'Alpine' : 'Highlands';
  if (temperature < 0.24) return moisture > 0.58 ? 'Tundra' : 'Cold Steppe';
  if (temperature > 0.76 && moisture < 0.28) return 'Desert';
  if (temperature > 0.68 && moisture > 0.68) return 'Tropical Forest';
  if (moisture > 0.70) return 'Wetland';
  if (moisture < 0.24) return 'Grassland';
  return 'Temperate Forest';
}

export function sampleClimate(seed, x, y) {
  const normalized = normalizeCoordinates(x, y);
  const elevation = sampleElevation(seed, normalized.x, normalized.y);
  const temperature = sampleTemperature(seed, normalized.x, normalized.y);
  const moisture = sampleMoisture(seed, normalized.x, normalized.y);
  return {
    ...normalized,
    elevation,
    temperature,
    moisture,
    biome: classifyBiome(elevation, temperature, moisture)
  };
}

export function sampleGrid(seed, centerX, centerY, radius = 4) {
  const size = radius * 2 + 1;
  const cells = [];
  for (let dy = -radius; dy <= radius; dy += 1) {
    for (let dx = -radius; dx <= radius; dx += 1) cells.push(sampleClimate(seed, centerX + dx, centerY + dy));
  }
  return { size, cells };
}

export function rootSelfTest(seed = 'atlas-root') {
  const equator = sampleTemperature(seed, Math.floor(WORLD_WIDTH / 2), Math.floor(WORLD_HEIGHT / 2));
  const northPole = sampleTemperature(seed, 0, 0);
  const southPole = sampleTemperature(seed, 0, WORLD_HEIGHT - 1);
  const seamA = sampleClimate(seed, 0, Math.floor(WORLD_HEIGHT / 2));
  const seamB = sampleClimate(seed, WORLD_WIDTH, Math.floor(WORLD_HEIGHT / 2));
  const checks = [
    { id: 'determinism', ok: JSON.stringify(sampleClimate(seed, 12345, 67890)) === JSON.stringify(sampleClimate(seed, 12345, 67890)), note: 'same inputs produce same outputs' },
    { id: 'latitude', ok: equator > northPole && equator > southPole, note: `equator ${equator.toFixed(3)} > poles ${northPole.toFixed(3)}, ${southPole.toFixed(3)}` },
    { id: 'x-wrap', ok: JSON.stringify(seamA) === JSON.stringify(seamB), note: 'x=0 matches x=W at the wrap seam' }
  ];
  return { passed: checks.every((check) => check.ok), checks, samples: { equator, northPole, southPole } };
}


export const TERRAIN_TRANSFORMS = Object.freeze([{landform:'Ocean',min:0,max:0.30,waterform:'Ocean'},{landform:'Coast',min:0.30,max:0.38,waterform:'Shallows'},{landform:'Plains',min:0.38,max:0.55,waterform:'None'},{landform:'Hills',min:0.55,max:0.65,waterform:'None'},{landform:'Valley/Plateau',min:0.65,max:0.80,waterform:'None'},{landform:'Mountain',min:0.80,max:0.92,waterform:'None'},{landform:'Peak',min:0.92,max:1.01,waterform:'None'}]);
