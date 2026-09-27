const entities=new Map();
let nextId=1;
export function createEntity(components={}){const id='entity-'+nextId++;const entity={id,components:{...components}};entities.set(id,entity);return entity;}
export function getEntity(id){return entities.get(String(id))||null;}
export function destroyEntity(id){return entities.delete(String(id));}
export function setComponent(id,name,value){const e=getEntity(id);if(!e)return null;e.components[String(name)]=value;return e;}
export function getComponent(id,name){return getEntity(id)?.components?.[String(name)]??null;}
export function queryEntities(...names){return [...entities.values()].filter(e=>names.every(n=>Object.prototype.hasOwnProperty.call(e.components,n)));}
export function ecsStats(){const components=new Set();for(const e of entities.values())for(const n of Object.keys(e.components))components.add(n);return {entities:entities.size,components:[...components].sort()};}
export function ecsSelfTest(){const before=entities.size;const e=createEntity({identity:{kind:'test'},transform:{x:1,y:2}});const ok=getComponent(e.id,'transform')?.x===1&&queryEntities('identity','transform').some(x=>x.id===e.id);destroyEntity(e.id);return {passed:ok&&entities.size===before,checks:[{id:'entity-lifecycle',ok:entities.size===before,note:'create and destroy restore ECS state'},{id:'component-query',ok,note:'component composition is queryable'}]};}
