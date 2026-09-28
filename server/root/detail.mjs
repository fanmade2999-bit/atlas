import { normalizeCoordinates, sampleClimate, classifyTerrain } from './climate.mjs';
import { getLocalTerrain } from './local-terrain.mjs';

function hash(seed,x,y,salt='detail'){
  let h=2166136261>>>0;
  const s=String(seed)+'|'+x+'|'+y+'|'+salt;
  for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619);}
  h^=h>>>13; h=Math.imul(h,0x5bd1e995); h^=h>>>15;
  return (h>>>0)/4294967295;
}
const pick=n=>Math.floor(n);
const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,v));

export function getTileDetail(seed='atlas-root',x=0,y=0){
  const p=normalizeCoordinates(x,y),c=sampleClimate(seed,p.x,p.y),t=classifyTerrain(seed,p.x,p.y);
  const n=salt=>hash(seed,p.x,p.y,salt),land=t.landform,water=t.waterform;
  const local=getLocalTerrain(seed,p.x,p.y);
  const surface=water==='Ocean'?'water-deep':water==='Shallows'?'water-shallow':water==='Lake'?'water-lake':water==='River'?'water-river':water==='Swamp'?'swamp':c.biome==='Desert'?'sand':c.biome==='Alpine'||land==='Peak'?'snow':c.biome==='Tundra'?'tundra':c.biome==='Cold Steppe'?'cold-grass':c.biome==='Wetland'?'wet-ground':c.biome==='Grassland'?'grass':land==='Mountain'?'rocky-grass':land==='Hills'?'meadow':'forest-floor';
  const landTile=water==='None', forest=landTile&&(c.biome==='Temperate Forest'||c.biome==='Tropical Forest'), wet=landTile&&c.biome==='Wetland';
  const forestDensity=forest?clamp(0.28+c.moisture*0.30+local.coverage*0.24-local.clearing*0.20):0;
  const treeBase=forest?forestDensity:0;
  const treeCount=forest&&n('tree-density')<treeBase?1+pick(n('tree-count')*4):0;
  const details=[];
  for(let i=0;i<treeCount;i++)details.push({type:'tree',variant:pick(n('tree-'+i)*3),x:0.16+n('tree-x-'+i)*0.68,y:0.12+n('tree-y-'+i)*0.70,size:0.62+n('tree-size-'+i)*0.28});
  const shrubChance=landTile&&(forest||wet?0.18+c.moisture*0.28+local.coverage*0.18:c.biome==='Grassland'?0.10+local.coverage*0.10:0.03);
  const grassChance=landTile&&['forest-floor','meadow','grass','cold-grass','wet-ground'].includes(surface)?0.26+c.moisture*0.28+local.coverage*0.20:0;
  const rockChance=landTile?(land==='Mountain'||land==='Peak'?0.30+local.roughness*0.25:land==='Hills'?0.12+local.roughness*0.20:0.025+local.roughness*0.08):0;
  const flowerChance=landTile&&['Temperate Forest','Grassland','Wetland'].includes(c.biome)?0.07+c.moisture*0.10+local.coverage*0.08:0;
  if(n('shrub')<shrubChance)details.push({type:'shrub',variant:pick(n('shrub-v')*3),x:0.12+n('shrub-x')*0.76,y:0.48+n('shrub-y')*0.42,size:0.30+n('shrub-size')*0.25});
  const grassCount=landTile&&grassChance>n('grass-density')?1+pick((local.coverage+local.relief)*1.8):0;
  for(let i=0;i<grassCount;i++)details.push({type:'grass',variant:pick(n('grass-v-'+i)*4),x:0.06+n('grass-x-'+i)*0.88,y:0.15+n('grass-y-'+i)*0.76,size:0.18+n('grass-size-'+i)*0.22});
  const rockCount=landTile&&rockChance>n('rock-density')?1+pick(local.roughness*2):0;
  for(let i=0;i<rockCount;i++)details.push({type:'rock',variant:pick(n('rock-v-'+i)*4),x:0.10+n('rock-x-'+i)*0.80,y:0.12+n('rock-y-'+i)*0.76,size:0.22+n('rock-size-'+i)*0.24});
  const flowerCount=landTile&&flowerChance>n('flower-density')?1+pick(local.coverage*1.5):0;
  for(let i=0;i<flowerCount;i++)details.push({type:'flower',variant:pick(n('flower-v-'+i)*4),x:0.12+n('flower-x-'+i)*0.76,y:0.18+n('flower-y-'+i)*0.70,size:0.16+n('flower-size-'+i)*0.14});
  if(water==='River'||water==='Shallows')details.push({type:'shore',variant:0,x:0.5,y:0.92,size:0.9});
  if(water==='Lake')details.push({type:'shore',variant:1,x:0.5,y:0.88,size:0.9});
  if(surface==='sand'&&n('dune')<0.35)details.push({type:'dune',variant:pick(n('dune-v')*2),x:0.5,y:0.55,size:0.8});
  if(land==='Peak'&&n('snow-cap')<0.8)details.push({type:'snowcap',variant:0,x:0.5,y:0.16,size:0.75});
  return Object.freeze({surface,density:clamp((treeCount/5)*0.7+c.moisture*0.2+local.coverage*0.1),microVariation:n('micro-ground'),local,treeCount,details});
}
export function detailSelfTest(seed='atlas-root'){
  const a=getTileDetail(seed,12345,67890),b=getTileDetail(seed,12345,67890);
  const checks=[{id:'detail-determinism',ok:JSON.stringify(a)===JSON.stringify(b),note:'local detail repeats exactly for the same seed and tile'},{id:'surface',ok:typeof a.surface==='string'&&a.surface.length>0,note:'every tile receives a deterministic surface'},{id:'objects',ok:Array.isArray(a.details),note:'visual detail objects are generated per tile'}];
  return {passed:checks.every(c=>c.ok),checks};
}
