/**
 * Project Atlas — Root Climate Functions
 * Pure, deterministic functions of (seed, x, y).
 *
 * Current root contract:
 *   elevation    -> 0..1
 *   temperature  -> 0..1 (poles cold, equator warm, local variance)
 *   moisture     -> 0..1
 *
 * X wraps; Y is capped.
 */

export const WORLD_WIDTH = 40_075_000;
export const WORLD_HEIGHT = 20_003_000;

function clamp01(value) {
  return Math.max(0, Math.min(1, value));
}

const CLIMATE_CACHE_LIMIT=8192;
const elevationCache=new Map(),moistureCache=new Map(),temperatureCache=new Map(),climateCache=new Map(),terrainCache=new Map(),hydrologyCache=new Map(),flowStepCache=new Map();
function cached(cache,key,compute){const hit=cache.get(key);if(hit!==undefined){cache.delete(key);cache.set(key,hit);return hit;}const value=compute();cache.set(key,value);while(cache.size>CLIMATE_CACHE_LIMIT)cache.delete(cache.keys().next().value);return value;}
function sampleKey(seed,x,y){return String(seed)+'|'+x+'|'+y;}

function fade(t) {
  return t * t * (3 - 2 * t);
}

function hashString(text) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function hash2(seedValue, ix, iy, salt = '') {
  let h = hashString(`${seedValue}|${salt}`);
  h ^= Math.imul((ix | 0), 0x45d9f3b);
  h = Math.imul(h ^ (h >>> 16), 0x45d9f3b);
  h ^= Math.imul((iy | 0), 0x119de1f3);
  h = Math.imul(h ^ (h >>> 16), 0x119de1f3);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967295;
}

function periodicValueNoise(seed, x, y, xCycles, yCells, salt) {
  const u = ((x % WORLD_WIDTH) + WORLD_WIDTH) % WORLD_WIDTH / WORLD_WIDTH;
  const v = clamp01(y / (WORLD_HEIGHT - 1));
  const gx = u * xCycles;
  const gy = v * yCells;
  const x0 = Math.floor(gx);
  const x1 = (x0 + 1) % xCycles;
  const y0 = Math.floor(gy);
  const y1 = Math.min(y0 + 1, yCells);
  const tx = fade(gx - x0);
  const ty = fade(gy - y0);
  const n00 = hash2(seed, x0, y0, salt);
  const n10 = hash2(seed, x1, y0, salt);
  const n01 = hash2(seed, x0, y1, salt);
  const n11 = hash2(seed, x1, y1, salt);
  const nx0 = n00 + (n10 - n00) * tx;
  const nx1 = n01 + (n11 - n01) * tx;
  return nx0 + (nx1 - nx0) * ty;
}

function fractalNoise(seed, x, y, { baseXCells, baseYCells, octaves = 4, salt }) {
  let amplitude = 1;
  let frequency = 1;
  let sum = 0;
  let weight = 0;
  for (let octave = 0; octave < octaves; octave += 1) {
    sum += periodicValueNoise(seed, x, y,
      Math.max(1, Math.round(baseXCells * frequency)),
      Math.max(1, Math.round(baseYCells * frequency)),
      `${salt}:${octave}`) * amplitude;
    weight += amplitude;
    amplitude *= 0.5;
    frequency *= 2;
  }
  return sum / weight;
}

function latitudeHeat(y) {
  const clampedY = Math.max(0, Math.min(WORLD_HEIGHT - 1, y));
  const normalized = clampedY / (WORLD_HEIGHT - 1);
  const distanceFromEquator = Math.abs(normalized * 2 - 1);
  return 1 - distanceFromEquator * distanceFromEquator;
}

export function normalizeCoordinates(x, y) {
  const wrappedX = ((Math.trunc(x) % WORLD_WIDTH) + WORLD_WIDTH) % WORLD_WIDTH;
  const cappedY = Math.max(0, Math.min(WORLD_HEIGHT - 1, Math.trunc(y)));
  return { x: wrappedX, y: cappedY };
}

export function sampleElevation(seed, x, y) {
  ({ x, y } = normalizeCoordinates(x, y));
  return cached(elevationCache,sampleKey(seed,x,y),()=>fractalNoise(seed, x, y, { baseXCells: 48, baseYCells: 24, octaves: 5, salt: 'elevation' }));
}

export function sampleMoisture(seed, x, y) {
  ({ x, y } = normalizeCoordinates(x, y));
  return cached(moistureCache,sampleKey(seed,x,y),()=>fractalNoise(seed, x, y, { baseXCells: 64, baseYCells: 32, octaves: 5, salt: 'moisture' }));
}

export function sampleTemperature(seed, x, y) {
  ({ x, y } = normalizeCoordinates(x, y));
  return cached(temperatureCache,sampleKey(seed,x,y),()=>{const latitude=latitudeHeat(y);const localNoise=fractalNoise(seed,x,y,{baseXCells:96,baseYCells:48,octaves:4,salt:'temperature'});return clamp01(latitude*0.78+localNoise*0.22);});
}

export function classifyBiome(elevation, temperature, moisture) {
  if (elevation < 0.22) return 'Ocean';
  if (elevation > 0.82) return temperature < 0.35 ? 'Alpine' : 'Highlands';
  if (temperature < 0.24) return moisture > 0.58 ? 'Tundra' : 'Cold Steppe';
  if (temperature > 0.76 && moisture < 0.28) return 'Desert';
  if (temperature > 0.68 && moisture > 0.68) return 'Tropical Forest';
  if (moisture > 0.70) return 'Wetland';
  if (moisture < 0.24) return 'Grassland';
  return 'Temperate Forest';
}

export function sampleClimate(seed, x, y) {
  const normalized=normalizeCoordinates(x,y),key=sampleKey(seed,normalized.x,normalized.y);
  return cached(climateCache,key,()=>{const elevation=sampleElevation(seed,normalized.x,normalized.y),temperature=sampleTemperature(seed,normalized.x,normalized.y),moisture=sampleMoisture(seed,normalized.x,normalized.y);return Object.freeze({...normalized,elevation,temperature,moisture,biome:classifyBiome(elevation,temperature,moisture)});});
}

export function sampleGrid(seed, centerX, centerY, radius = 4) {
  const size = radius * 2 + 1;
  const cells = [];
  for (let dy = -radius; dy <= radius; dy += 1) {
    for (let dx = -radius; dx <= radius; dx += 1) cells.push(sampleClimate(seed, centerX + dx, centerY + dy));
  }
  return { size, cells };
}

const rootSelfTestCache=new Map();

export function rootSelfTest(seed = 'atlas-root') {
  const cached=rootSelfTestCache.get(seed);
  if(cached)return cached;
  const equator = sampleTemperature(seed, Math.floor(WORLD_WIDTH / 2), Math.floor(WORLD_HEIGHT / 2));
  const northPole = sampleTemperature(seed, 0, 0);
  const southPole = sampleTemperature(seed, 0, WORLD_HEIGHT - 1);
  const seamA = sampleClimate(seed, 0, Math.floor(WORLD_HEIGHT / 2));
  const seamB = sampleClimate(seed, WORLD_WIDTH, Math.floor(WORLD_HEIGHT / 2));
  const checks = [
    { id: 'determinism', ok: JSON.stringify(sampleClimate(seed, 12345, 67890)) === JSON.stringify(sampleClimate(seed, 12345, 67890)), note: 'same inputs produce same outputs' },
    { id: 'latitude', ok: equator > northPole && equator > southPole, note: `equator ${equator.toFixed(3)} > poles ${northPole.toFixed(3)}, ${southPole.toFixed(3)}` },
    { id: 'x-wrap', ok: JSON.stringify(seamA) === JSON.stringify(seamB), note: 'x=0 matches x=W at the wrap seam' }
  ];
  const result={ passed: checks.every((check) => check.ok), checks, samples: { equator, northPole, southPole } };
  rootSelfTestCache.set(seed,result);
  return result;
}


export const TERRAIN_TRANSFORMS = Object.freeze([
  {landform:'Ocean',min:0,max:0.30,waterform:'Ocean'},
  {landform:'Coast',min:0.30,max:0.38,waterform:'Shallows'},
  {landform:'Plains',min:0.38,max:0.55,waterform:'None'},
  {landform:'Hills',min:0.55,max:0.65,waterform:'None'},
  {landform:'Valley/Plateau',min:0.65,max:0.80,waterform:'None'},
  {landform:'Mountain',min:0.80,max:0.92,waterform:'None'},
  {landform:'Peak',min:0.92,max:1.01,waterform:'None'}
]);

const FLOW_NEIGHBORS = Object.freeze([
  [-1,-1], [0,-1], [1,-1],
  [-1,0],           [1,0],
  [-1,1],  [0,1],  [1,1]
]);

function terrainLocalVariance(seed,x,y){
  const center=sampleElevation(seed,x,y);
  let sum=0;
  for(const [dx,dy] of [[-4,0],[4,0],[0,-4],[0,4],[-4,-4],[4,-4],[-4,4],[4,4]]) sum+=sampleElevation(seed,x+dx,y+dy);
  const mean=sum/8;
  return {center,mean,variance:Math.abs(center-mean)};
}

export function classifyLandform(seed='atlas-root',x=0,y=0,elevation=sampleElevation(seed,x,y)){
  if(elevation<0.30)return 'Ocean';
  if(elevation<0.38)return 'Coast';
  if(elevation<0.55)return 'Plains';
  if(elevation<0.65)return 'Hills';
  if(elevation<0.80){
    const v=terrainLocalVariance(seed,x,y);
    return v.variance<0.018?'Plateau':(v.center<v.mean?'Valley':'Plateau');
  }
  if(elevation<0.92)return 'Mountain';
  return 'Peak';
}

function downhillStep(seed,x,y,elevation){
  const p0=normalizeCoordinates(x,y),cacheKey=sampleKey(seed,p0.x,p0.y),cachedStep=flowStepCache.get(cacheKey);
  if(cachedStep!==undefined)return cachedStep;
  let best=null;
  for(const [dx,dy] of FLOW_NEIGHBORS){
    const p=normalizeCoordinates(x+dx,y+dy);
    const e=sampleElevation(seed,p.x,p.y);
    if(e<elevation-0.000001&&(!best||e<best.elevation))best={x:p.x,y:p.y,elevation:e,dx,dy};
  }
  flowStepCache.set(cacheKey,best||null);while(flowStepCache.size>CLIMATE_CACHE_LIMIT)flowStepCache.delete(flowStepCache.keys().next().value);return best;
}

function flowTrace(seed,x,y,elevation,maxSteps=96){
  let current=normalizeCoordinates(x,y);
  let currentElevation=elevation;
  const visited=new Set();
  const path=[];
  for(let step=0;step<maxSteps;step+=1){
    const key=current.x+','+current.y;
    if(visited.has(key)) return {reachesOcean:false,reachesBasin:true,steps:step,path,outlet:{x:current.x,y:current.y},sink:true};
    visited.add(key);
    if(currentElevation<0.30) return {reachesOcean:true,reachesBasin:false,steps:step,path,outlet:{x:current.x,y:current.y},sink:false};
    const next=downhillStep(seed,current.x,current.y,currentElevation);
    if(!next) return {reachesOcean:false,reachesBasin:true,steps:step,path,outlet:{x:current.x,y:current.y},sink:true};
    path.push({x:current.x,y:current.y});
    current={x:next.x,y:next.y};
    currentElevation=next.elevation;
  }
  return {reachesOcean:false,reachesBasin:false,steps:maxSteps,path,outlet:{x:current.x,y:current.y},sink:false};
}

export function flowToOcean(seed,x,y,elevation,maxSteps=96){
  const trace=flowTrace(seed,x,y,elevation,maxSteps);
  return {reachesOcean:trace.reachesOcean,steps:trace.steps};
}

function immediateUpstreamCount(seed,x,y,elevation){
  let count=0;
  for(const [dx,dy] of FLOW_NEIGHBORS){
    const p=normalizeCoordinates(x+dx,y+dy);
    const neighborElevation=sampleElevation(seed,p.x,p.y);
    const next=downhillStep(seed,p.x,p.y,neighborElevation);
    if(next&&next.x===normalizeCoordinates(x,y).x&&next.y===normalizeCoordinates(x,y).y) count+=1;
  }
  return count;
}

function watershedId(trace){
  return trace.outlet.x+','+trace.outlet.y;
}

export function classifyHydrology(seed='atlas-root',x=0,y=0){
  const normalized=normalizeCoordinates(x,y),cacheKey=sampleKey(seed,normalized.x,normalized.y),cachedHydro=hydrologyCache.get(cacheKey);
  if(cachedHydro!==undefined)return cachedHydro;
  const elevation=sampleElevation(seed,normalized.x,normalized.y);
  if(elevation<0.30){const ocean=Object.freeze({
    waterform:'Ocean',flowDirection:'ocean',flowSteps:0,flowAccumulation:0,upstreamCount:0,
    watershedId:'ocean',isSink:false,reachesOcean:true
  });hydrologyCache.set(cacheKey,ocean);return ocean;}
  const trace=flowTrace(seed,normalized.x,normalized.y,elevation);
  const next=downhillStep(seed,normalized.x,normalized.y,elevation);
  const upstreamCount=immediateUpstreamCount(seed,normalized.x,normalized.y,elevation);
  const slope=next?Math.max(0,elevation-next.elevation):0;
  const sink=trace.sink;
  let waterform='None';
  if(elevation<0.38) waterform='Shallows';
  else if(sink && elevation<0.70) waterform='Lake';
  else if(elevation<0.44 && sampleMoisture(seed,normalized.x,normalized.y)>0.78) waterform='Swamp';
  else if(trace.steps>0 && trace.reachesOcean && sampleMoisture(seed,normalized.x,normalized.y)>0.55 && (upstreamCount>0 || slope>0.0015)) waterform='River';
  const result=Object.freeze({
    waterform,
    flowDirection:next?next.dx+','+next.dy:(sink?'sink':'unknown'),
    flowSteps:trace.steps,
    flowAccumulation:Math.max(1,upstreamCount+1),
    upstreamCount,
    watershedId:watershedId(trace),
    isSink:sink,
    reachesOcean:trace.reachesOcean
  });
  hydrologyCache.set(cacheKey,result);while(hydrologyCache.size>CLIMATE_CACHE_LIMIT)hydrologyCache.delete(hydrologyCache.keys().next().value);return result;
}

export function classifyTerrain(seed='atlas-root',x=0,y=0){
  const normalized=normalizeCoordinates(x,y),key=sampleKey(seed,normalized.x,normalized.y);
  const hit=terrainCache.get(key);
  if(hit!==undefined){terrainCache.delete(key);terrainCache.set(key,hit);return hit;}
  const c=sampleClimate(seed,normalized.x,normalized.y);
  const landform=classifyLandform(seed,normalized.x,normalized.y,c.elevation);
  const hydro=classifyHydrology(seed,normalized.x,normalized.y);
  const waterform=hydro.waterform;
  const surface=landform==='Peak'?'Snow/Alpine':(waterform==='Ocean'||waterform==='Shallows'||waterform==='Lake'||waterform==='River'||waterform==='Swamp'?waterform:c.biome);
  const result=Object.freeze({...c,landform,waterform,surface,hydrology:hydro});
  terrainCache.set(key,result);
  while(terrainCache.size>CLIMATE_CACHE_LIMIT)terrainCache.delete(terrainCache.keys().next().value);
  return result;
}

export function terrainTransformSignature(seed='atlas-root',x=0,y=0){
  const t=classifyTerrain(seed,x,y);
  return JSON.stringify({biome:t.biome,landform:t.landform,waterform:t.waterform,surface:t.surface,watershedId:t.hydrology.watershedId});
}

export function terrainSelfTest(seed='atlas-root'){
  const points=[[0,0],[12345,67890],[Math.floor(WORLD_WIDTH/2),Math.floor(WORLD_HEIGHT/2)]];
  const checks=[];
  for(const [x,y] of points){
    const a=classifyTerrain(seed,x,y),b=classifyTerrain(seed,x,y);
    checks.push({id:'terrain-determinism',ok:JSON.stringify(a)===JSON.stringify(b),note:'terrain and hydrology are deterministic'});
    checks.push({id:'landform-band',ok:TERRAIN_TRANSFORMS.some(t=>a.elevation>=t.min&&a.elevation<t.max),note:'elevation maps to a landform band'});
    checks.push({id:'waterform-valid',ok:['None','Ocean','Shallows','Lake','River','Swamp'].includes(a.waterform),note:'waterform is from the Layer 4 vocabulary'});
    checks.push({id:'watershed',ok:typeof a.hydrology.watershedId==='string'&&a.hydrology.watershedId.length>0,note:'every land tile has a deterministic drainage outlet id'});
  }
  return {passed:checks.every(c=>c.ok),checks};
}

