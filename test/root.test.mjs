import test from 'node:test';
import assert from 'node:assert/strict';
import { sampleClimate, sampleTemperature, WORLD_HEIGHT, WORLD_WIDTH, rootSelfTest, classifyTerrain, terrainSelfTest, classifyHydrology } from '../server/root/climate.mjs';
import { getLocationNames, namingSelfTest } from '../server/root/naming.mjs';

test('root functions are deterministic', () => {
  const a = sampleClimate('test-seed', 12345, 67890);
  const b = sampleClimate('test-seed', 12345, 67890);
  assert.deepEqual(a, b);
});

test('root x coordinate wraps', () => {
  assert.deepEqual(sampleClimate('test-seed', 0, 123456), sampleClimate('test-seed', WORLD_WIDTH, 123456));
});

test('root y coordinate caps instead of wrapping', () => {
  const north = sampleClimate('test-seed', 0, 0);
  const northAgain = sampleClimate('test-seed', 0, -500);
  assert.deepEqual(north, northAgain);
  const south = sampleClimate('test-seed', 0, WORLD_HEIGHT - 1);
  const southAgain = sampleClimate('test-seed', 0, WORLD_HEIGHT + 500);
  assert.deepEqual(south, southAgain);
});

test('temperature is colder toward both poles than at the equator', () => {
  const equator = sampleTemperature('test-seed', 0, Math.floor(WORLD_HEIGHT / 2));
  const north = sampleTemperature('test-seed', 0, 0);
  const south = sampleTemperature('test-seed', 0, WORLD_HEIGHT - 1);
  assert.ok(equator > north);
  assert.ok(equator > south);
});

test('all root outputs are normalized', () => {
  for (const [x, y] of [[0, 0], [12345, 67890], [WORLD_WIDTH - 1, WORLD_HEIGHT - 1]]) {
    const sample = sampleClimate('test-seed', x, y);
    assert.ok(sample.elevation >= 0 && sample.elevation <= 1);
    assert.ok(sample.temperature >= 0 && sample.temperature <= 1);
    assert.ok(sample.moisture >= 0 && sample.moisture <= 1);
  }
});

test('root self test passes', () => {
  assert.equal(rootSelfTest('test-seed').passed, true);
});

test('terrain transform resolves biome, landform, and waterform deterministically', () => {
  const a = classifyTerrain('test-seed', 12345, 67890);
  const b = classifyTerrain('test-seed', 12345, 67890);
  assert.deepEqual(a, b);
  assert.ok(['Ocean','Coast','Plains','Hills','Valley','Plateau','Mountain','Peak'].includes(a.landform));
  assert.ok(['None','Ocean','Shallows','Lake','River','Swamp'].includes(a.waterform));
});

test('hydrology returns a deterministic drainage identity', () => {
  const a = classifyHydrology('test-seed', 12345, 67890);
  const b = classifyHydrology('test-seed', 12345, 67890);
  assert.deepEqual(a, b);
  assert.equal(typeof a.watershedId, 'string');
});

test('terrain self test passes', () => assert.equal(terrainSelfTest('test-seed').passed, true));

test('Layer 3 naming is deterministic and physical', () => {
  const a = getLocationNames('test-seed', 12345, 67890);
  const b = getLocationNames('test-seed', 12345, 67890);
  assert.deepEqual(a, b);
  assert.equal(a.chunk.name, undefined);
  assert.equal(a.tile.name, undefined);
  if (a.continent.active) {
    assert.ok(a.territory.name);
    assert.ok(a.region.name);
    assert.ok(a.tract.name);
    assert.ok(a.area.name);
    assert.equal(a.territory.sizeCapKm, 2000);
    assert.equal(a.region.sizeCapKm, 400);
    assert.equal(a.tract.sizeCapKm, 80);
    assert.equal(a.area.sizeCapKm, 8);
    assert.notEqual(a.territory.physicalType, '???');
  } else {
    assert.equal(a.territory.name, '???');
  }
});

test('Layer 3 naming self test passes', () => {
  assert.equal(namingSelfTest('test-seed').passed, true);
});
