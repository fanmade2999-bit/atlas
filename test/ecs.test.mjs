import test from 'node:test';
import assert from 'node:assert/strict';
import { createEntity, getComponent, queryEntities, destroyEntity, ecsSelfTest } from '../server/root/ecs.mjs';

test('ECS lifecycle and component queries work',()=>{
  const entity=createEntity({identity:{kind:'test'},transform:{x:4,y:9}});
  assert.deepEqual(getComponent(entity.id,'transform'),{x:4,y:9});
  assert.ok(queryEntities('identity','transform').some(item=>item.id===entity.id));
  assert.equal(destroyEntity(entity.id),true);
});

test('ECS self-test passes',()=>assert.equal(ecsSelfTest().passed,true));
