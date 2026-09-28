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
  const fine=latticeNoise(seed,p.x,p.y,2,'local-fine');
  const relief=broad*.45+patch*.35+fine*.20;
  const roughness=Math.abs(patch-fine);
  const clearing=Math.max(0,1-broad*1.30);
  const coverage=Math.min(1,broad*.58+patch*.42);

  const zoneNoise=latticeNoise(seed,p.x,p.y,16,'habitat-zone');
  const zoneId=Math.floor(p.x/16)+','+Math.floor(p.y/16);
  let zone='open',zoneDensity=0.5;
  if(zoneNoise<0.16){zone='clearing';zoneDensity=0.12;}
  else if(zoneNoise<0.34){zone='meadow';zoneDensity=0.28;}
  else if(zoneNoise<0.54){zone='open';zoneDensity=0.46;}
  else if(zoneNoise<0.72){zone='scrub';zoneDensity=0.68;}
  else if(zoneNoise<0.88){zone='grove';zoneDensity=0.86;}
  else {zone='dense';zoneDensity=1;}

  const feature=hash2(seed,Math.floor(p.x/16),Math.floor(p.y/16),'habitat-feature');
  const rockyPatch=roughness>0.10 && feature>0.48;
  const wetPatch=patch>0.72 && fine>0.55;
  const pathBias=latticeNoise(seed,p.x,p.y,64,'trail-field');
  return Object.freeze({
    relief:Number(relief.toFixed(4)),
    roughness:Number(roughness.toFixed(4)),
    clearing:Number(clearing.toFixed(4)),
    coverage:Number(coverage.toFixed(4)),
    zone,
    zoneId,
    zoneDensity:Number(zoneDensity.toFixed(3)),
    rockyPatch,
    wetPatch,
    trailField:Number(pathBias.toFixed(4))
  });
}
export function localTerrainSignature(seed='atlas-root',x=0,y=0){return JSON.stringify(getLocalTerrain(seed,x,y))}
export function localTerrainSelfTest(seed='atlas-root'){
  const a=getLocalTerrain(seed,12345,67890),b=getLocalTerrain(seed,12345,67890),c=getLocalTerrain(seed,12346,67890);
  const checks=[
    {id:'local-determinism',ok:JSON.stringify(a)===JSON.stringify(b),note:'same local coordinate field repeats exactly'},
    {id:'bounded',ok:[a.relief,a.roughness,a.clearing,a.coverage].every(v=>v>=0&&v<=1),note:'local terrain channels stay normalized'},
    {id:'spatial-variation',ok:JSON.stringify(a)!==JSON.stringify(c),note:'adjacent tiles can carry distinct local terrain values'},
    {id:'habitat-zone',ok:['clearing','meadow','open','scrub','grove','dense'].includes(a.zone),note:'each tile belongs to a deterministic local habitat zone'}

  ];
  return {passed:checks.every(c=>c.ok),checks};
}
