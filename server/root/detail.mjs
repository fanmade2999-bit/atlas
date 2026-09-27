import { normalizeCoordinates, sampleClimate, classifyTerrain } from './climate.mjs';

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
  const surface=water==='Ocean'?'water-deep':water==='Shallows'?'water-shallow':water==='Lake'?'water-lake':water==='River'?'water-river':water==='Swamp'?'swamp':c.biome==='Desert'?'sand':c.biome==='Alpine'||land==='Peak'?'snow':c.biome==='Tundra'?'tundra':c.biome==='Cold Steppe'?'cold-grass':c.biome==='Wetland'?'wet-ground':c.biome==='Grassland'?'grass':land==='Mountain'?'rocky-grass':land==='Hills'?'meadow':'forest-floor';
  const forest=c.biome==='Temperate Forest'||c.biome==='Tropical Forest',wet=c.biome==='Wetland'||water==='Swamp';
  const treeBase=forest?(0.36+c.moisture*0.30):0,treeCount=forest&&n('tree-density')<treeBase?1+pick(n('tree-count')*3.5):0;
  const details=[];
  for(let i=0;i<treeCount;i++)details.push({type:'tree',variant:pick(n('tree-'+i)*3),x:0.16+n('tree-x-'+i)*0.68,y:0.12+n('tree-y-'+i)*0.70,size:0.62+n('tree-size-'+i)*0.28});
  const shrubChance=forest||wet?0.25+c.moisture*0.35:c.biome==='Grassland'?0.12:0.04;
  const grassChance=['forest-floor','meadow','grass','cold-grass','wet-ground'].includes(surface)?0.38+c.moisture*0.35:0;
  const rockChance=land==='Mountain'||land==='Peak'?0.48:land==='Hills'?0.18:0.04;
  const flowerChance=['Temperate Forest','Grassland','Wetland'].includes(c.biome)?0.10+c.moisture*0.12:0;
  if(n('shrub')<shrubChance)details.push({type:'shrub',variant:pick(n('shrub-v')*2),x:0.15+n('shrub-x')*0.70,y:0.55+n('shrub-y')*0.32,size:0.35+n('shrub-size')*0.22});
  if(n('grass')<grassChance)details.push({type:'grass',variant:pick(n('grass-v')*3),x:0.08+n('grass-x')*0.84,y:0.20+n('grass-y')*0.72,size:0.22+n('grass-size')*0.18});
  if(n('rock')<rockChance)details.push({type:'rock',variant:pick(n('rock-v')*3),x:0.12+n('rock-x')*0.76,y:0.16+n('rock-y')*0.72,size:0.28+n('rock-size')*0.22});
  if(n('flower')<flowerChance)details.push({type:'flower',variant:pick(n('flower-v')*3),x:0.15+n('flower-x')*0.70,y:0.25+n('flower-y')*0.60,size:0.20+n('flower-size')*0.12});
  if(water==='River'||water==='Shallows')details.push({type:'shore',variant:0,x:0.5,y:0.92,size:0.9});
  if(water==='Lake')details.push({type:'shore',variant:1,x:0.5,y:0.88,size:0.9});
  if(surface==='sand'&&n('dune')<0.35)details.push({type:'dune',variant:pick(n('dune-v')*2),x:0.5,y:0.55,size:0.8});
  if(land==='Peak'&&n('snow-cap')<0.8)details.push({type:'snowcap',variant:0,x:0.5,y:0.16,size:0.75});
  return Object.freeze({surface,density:clamp((treeCount/4)*0.7+c.moisture*0.3),microVariation:n('micro-ground'),treeCount,details});
}
export function detailSelfTest(seed='atlas-root'){
  const a=getTileDetail(seed,12345,67890),b=getTileDetail(seed,12345,67890);
  const checks=[{id:'detail-determinism',ok:JSON.stringify(a)===JSON.stringify(b),note:'local detail repeats exactly for the same seed and tile'},{id:'surface',ok:typeof a.surface==='string'&&a.surface.length>0,note:'every tile receives a deterministic surface'},{id:'objects',ok:Array.isArray(a.details),note:'visual detail objects are generated per tile'}];
  return {passed:checks.every(c=>c.ok),checks};
}
