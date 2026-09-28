import test from 'node:test';
import assert from 'node:assert/strict';
import { getLocalTerrain, localTerrainSelfTest } from '../server/root/local-terrain.mjs';

test('local terrain is deterministic',()=>{
  const a=getLocalTerrain('local-test',12345,67890),b=getLocalTerrain('local-test',12345,67890);
  assert.deepEqual(a,b);
});

test('local terrain self-test passes',()=>{
  assert.equal(localTerrainSelfTest('local-test').passed,true);
});
