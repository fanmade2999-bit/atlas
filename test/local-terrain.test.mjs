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


test('local habitat zones are deterministic at multiple scales',()=>{
  const samples=[[0,0],[1,0],[0,1],[7,7],[8,8],[15,15],[16,16],[31,31],[32,32]];
  for(const [x,y] of samples){
    const a=getLocalTerrain('habitat-test',x,y),b=getLocalTerrain('habitat-test',x,y);
    assert.deepEqual(a,b);
    assert.ok(a.zoneId.includes(','));
    assert.ok(['clearing','meadow','open','scrub','grove','dense'].includes(a.zone));
  }
});

test('local terrain never changes the coordinate contract',()=>{
  const a=getLocalTerrain('contract-test',-1,-2);
  const b=getLocalTerrain('contract-test',40075000-1,0);
  assert.equal(typeof a.relief,'number');
  assert.equal(typeof b.relief,'number');
});
