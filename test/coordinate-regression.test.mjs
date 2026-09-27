import test from 'node:test';
import assert from 'node:assert/strict';
import { movePosition } from '../server/root/move.mjs';

test('movement advances exactly one world tile at large coordinates',()=>{
  const result=movePosition(2000000,10001500,'right');
  assert.deepEqual(result.from,{x:2000000,y:10001500});
  assert.deepEqual(result.to,{x:2000001,y:10001500});
});
