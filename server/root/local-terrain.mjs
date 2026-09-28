/**
 * Local terrain field.
 *
 * This sits below climate/landform and above individual object placement.
 * It adds coherent variation at the scale a player can actually see:
 * small clearings, rough patches, clustered ground cover and local relief.
 * It never changes the planet-scale biome or hydrology contract.
 */
import { normalizeCoordinates, WORLD_HEIGHT, WORLD_WIDTH } from './climate.mjs';

function hash2(seed,x,y,salt='local'){
  let h=2166136261>>>0;
  const s=String(seed)+'|'+salt;
  for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619);}
  h^=Math.imul((Math.trunc(x)|0),0x45d9f3b);h=Math.imul(h^(h>>>16),0x45d9f3b);
  h^=Math.imul((Math.trunc(y)|0),0x119de1f3);h=Math.imul(h^(h>>>16),0x119de1f3);
  h^=h>>>16;
  return (h>>>0)/4294967295;
}
const fade=t=>t*t*(3-2*t);
function latticeNoise(seed,x,y,cellSize,salt){
  const p=normalizeCoordinates(x,y);
  const gx=((p.x/cellSize)% (WORLD_WIDTH/cellSize)+(WORLD_WIDTH/cellSize))%(WORLD_WIDTH/cellSize);
  const gy=p.y/cellSize;
  const x0=Math.floor(gx),y0=Math.floor(gy),x1=x0+1,y1=Math.min(Math.floor(WORLD_HEIGHT/cellSize),y0+1);
  const tx=fade(gx-x0),ty=fade(gy-y0);
  const n00=hash2(seed,x0,y0,salt),n10=hash2(seed,x1,y0,salt),n01=hash2(seed,x0,y1,salt),n11=hash2(seed,x1,y1,salt);
  const a=n00+(n10-n00)*tx,b=n01+(n11-n01)*tx;
  return a+(b-a)*ty;
}
export function getLocalTerrain(seed='atlas-root',x=0,y=0){
  const p=normalizeCoordinates(x,y);
  const broad=latticeNoise(seed,p.x,p.y,32,'local-broad');
  const patch=latticeNoise(seed,p.x,p.y,8,'local-patch');
  const micro=latticeNoise(seed,p.x,p.y,2,'local-micro');
  const relief=broad*.50+patch*.35+micro*.15;
  const roughness=Math.abs(patch-micro);
  const clearing=Math.max(0,1-broad*1.35);
  const coverage=Math.min(1,broad*.60+patch*.40);
  return Object.freeze({
    relief:Number(relief.toFixed(4)),
    roughness:Number(roughness.toFixed(4)),
    clearing:Number(clearing.toFixed(4)),
    coverage:Number(coverage.toFixed(4))
  });
}
export function localTerrainSignature(seed='atlas-root',x=0,y=0){return JSON.stringify(getLocalTerrain(seed,x,y))}
export function localTerrainSelfTest(seed='atlas-root'){
  const a=getLocalTerrain(seed,12345,67890),b=getLocalTerrain(seed,12345,67890),c=getLocalTerrain(seed,12346,67890);
  const checks=[
    {id:'local-determinism',ok:JSON.stringify(a)===JSON.stringify(b),note:'same local coordinate field repeats exactly'},
    {id:'bounded',ok:[a.relief,a.roughness,a.clearing,a.coverage].every(v=>v>=0&&v<=1),note:'local terrain channels stay normalized'},
    {id:'spatial-variation',ok:JSON.stringify(a)!==JSON.stringify(c),note:'adjacent tiles can carry distinct local terrain values'}
  ];
  return {passed:checks.every(c=>c.ok),checks};
}
