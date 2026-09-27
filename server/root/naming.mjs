import { normalizeCoordinates, sampleClimate, sampleElevation, WORLD_HEIGHT, WORLD_WIDTH } from './climate.mjs';

const hash32=s=>{let h=2166136261>>>0;for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619)}return h>>>0};
const pick=(a,n)=>a[n%a.length],title=s=>s.charAt(0).toUpperCase()+s.slice(1);
const syllables=['xel','var','ryn','dor','tal','ven','mir','ka','lor','syl','fen','ora','ith'];
const compass=['North','South','East','West','Northeast','Northwest','Southeast','Southwest'];
export const NAMING_TIERS=Object.freeze({
  territory:{scale:2_000_000,capKm:2_000},region:{scale:400_000,capKm:400},
  tract:{scale:80_000,capKm:80},area:{scale:8_000,capKm:8}
});
const CACHE_LIMIT=8192,locationCache=new Map(),continentFieldCache=new Map();
function cachePut(cache,key,value){cache.set(key,value);while(cache.size>CACHE_LIMIT)cache.delete(cache.keys().next().value);return value}
function sampleKey(seed,x,y){return String(seed)+'|'+x+'|'+y}
function baseName(seed,key,tier){const h=hash32(seed+'|name|'+tier+'|'+key);return title(pick(syllables,h)+pick(syllables,Math.floor(h/13))+(h%5===0?pick(syllables,Math.floor(h/97)):'') )}

const CONTINENT_GRID_X=128,CONTINENT_GRID_Y=64,CONTINENT_SEA_LEVEL=0.30;
function gridElevation(seed,gx,gy){return sampleElevation(seed,Math.floor(((gx+.5)/CONTINENT_GRID_X)*WORLD_WIDTH),Math.floor(((gy+.5)/CONTINENT_GRID_Y)*WORLD_HEIGHT))}
function buildContinentField(seed){
  const sk=String(seed),hit=continentFieldCache.get(sk);if(hit)return hit;
  const land=new Uint8Array(CONTINENT_GRID_X*CONTINENT_GRID_Y);
  for(let gy=0;gy<CONTINENT_GRID_Y;gy++)for(let gx=0;gx<CONTINENT_GRID_X;gx++)land[gy*CONTINENT_GRID_X+gx]=gridElevation(seed,gx,gy)>=CONTINENT_SEA_LEVEL?1:0;
  const ids=new Int32Array(land.length);ids.fill(-1);const qx=new Int32Array(land.length),qy=new Int32Array(land.length);let nextId=0;
  for(let gy=0;gy<CONTINENT_GRID_Y;gy++)for(let gx=0;gx<CONTINENT_GRID_X;gx++){
    const start=gy*CONTINENT_GRID_X+gx;if(!land[start]||ids[start]!==-1)continue;
    let head=0,tail=0;qx[tail]=gx;qy[tail]=gy;tail++;ids[start]=nextId;
    while(head<tail){const cx=qx[head],cy=qy[head];head++;for(const [dx,dy] of [[-1,0],[1,0],[0,-1],[0,1],[-1,-1],[1,-1],[-1,1],[1,1]]){
      const nx=(cx+dx+CONTINENT_GRID_X)%CONTINENT_GRID_X,ny=cy+dy;if(ny<0||ny>=CONTINENT_GRID_Y)continue;const ni=ny*CONTINENT_GRID_X+nx;
      if(land[ni]&&ids[ni]===-1){ids[ni]=nextId;qx[tail]=nx;qy[tail]=ny;tail++}
    }}nextId++;
  }
  const field={ids,count:nextId};continentFieldCache.set(sk,field);return field;
}
function continentIdAt(seed,x,y){
  const p=normalizeCoordinates(x,y);if(sampleElevation(seed,p.x,p.y)<CONTINENT_SEA_LEVEL)return -1;
  const gx=Math.min(CONTINENT_GRID_X-1,Math.floor(p.x/WORLD_WIDTH*CONTINENT_GRID_X)),gy=Math.min(CONTINENT_GRID_Y-1,Math.floor(p.y/WORLD_HEIGHT*CONTINENT_GRID_Y)),field=buildContinentField(seed);
  const direct=field.ids[gy*CONTINENT_GRID_X+gx];if(direct>=0)return direct;
  for(let r=1;r<=2;r++)for(let dy=-r;dy<=r;dy++)for(let dx=-r;dx<=r;dx++){const nx=(gx+dx+CONTINENT_GRID_X)%CONTINENT_GRID_X,ny=gy+dy;if(ny>=0&&ny<CONTINENT_GRID_Y){const id=field.ids[ny*CONTINENT_GRID_X+nx];if(id>=0)return id}}
  return -1;
}
function dominantPhysicalType(seed,x,y,scale){
  const counts=new Map(),points=[[0,0],[scale*.45,0],[-scale*.45,0],[0,scale*.45],[0,-scale*.45]];
  for(const [dx,dy] of points){const p=normalizeCoordinates(x+dx,y+dy),c=sampleClimate(seed,p.x,p.y);if(c.elevation<CONTINENT_SEA_LEVEL)continue;
    const type=c.elevation>=.92?'Peak':c.elevation>=.80?'Mountain':c.elevation>=.65?'Valley/Plateau':c.elevation>=.55?'Hills':(c.biome||'Landmass');counts.set(type,(counts.get(type)||0)+1)}
  if(!counts.size)return 'Landmass';let best='Landmass',bestCount=-1;for(const [type,count] of counts)if(count>bestCount){best=type;bestCount=count}return best;
}
function zoneKey(seed,x,y,tier){
  const scale=NAMING_TIERS[tier].scale,cx=Math.floor(x/scale),cy=Math.floor(y/scale);
  const parent=tier==='territory'?'c'+continentIdAt(seed,x,y):zoneKey(seed,x,y,tier==='region'?'territory':tier==='tract'?'region':'tract');
  return parent+'|'+cx+','+cy;
}
function zoneInfo(seed,x,y,tier){
  const p=normalizeCoordinates(x,y),continentId=continentIdAt(seed,p.x,p.y);
  if(continentId<0)return {tier,active:false,cell:null,name:'???',physicalType:'???',sizeCapKm:NAMING_TIERS[tier].capKm,split:'???',continentId:null};
  const cacheKey=sampleKey(seed,p.x,p.y)+'|'+tier,cached=locationCache.get(cacheKey);if(cached)return cached;
  const cfg=NAMING_TIERS[tier],scale=cfg.scale,cx=Math.floor(p.x/scale),cy=Math.floor(p.y/scale),q=normalizeCoordinates(p.x+Math.floor(scale*.35),p.y+Math.floor(scale*.35));
  const variation=Math.max(0,Math.min(1,Math.abs(sampleElevation(seed,p.x,p.y)-sampleElevation(seed,q.x,q.y)))),split=variation>.055?'organic':'directional',key=zoneKey(seed,p.x,p.y,tier);
  const physicalType=dominantPhysicalType(seed,cx*scale+scale/2,cy*scale+scale/2,Math.max(1,Math.floor(scale/4)));
  const direction=split==='directional'?pick(compass,hash32(seed+'|direction|'+key)):null;
  return cachePut(locationCache,cacheKey,Object.freeze({tier,active:true,cell:{x:cx,y:cy},name:(direction?direction+' ':'')+baseName(seed,key,tier)+' '+physicalType,physicalType,sizeCapKm:cfg.capKm,split,variation:Number(variation.toFixed(4)),continentId}));
}
export function getLocationNames(seed='atlas-root',x=0,y=0){
  const p=normalizeCoordinates(x,y),cacheKey=sampleKey(seed,p.x,p.y),hit=locationCache.get(cacheKey);if(hit)return hit;
  const continentId=continentIdAt(seed,p.x,p.y),continent=continentId<0?{tier:'continent',active:false,cell:null,name:'???',physicalType:'???',sizeCapKm:null,split:'???',continentId:null}:{tier:'continent',active:true,cell:{id:continentId},name:baseName(seed,'continent|'+continentId,'continent'),physicalType:'Landmass',sizeCapKm:null,split:'organic',continentId};
  return cachePut(locationCache,cacheKey,Object.freeze({continent,territory:zoneInfo(seed,p.x,p.y,'territory'),region:zoneInfo(seed,p.x,p.y,'region'),tract:zoneInfo(seed,p.x,p.y,'tract'),area:zoneInfo(seed,p.x,p.y,'area'),chunk:{x:Math.floor(p.x/16),y:Math.floor(p.y/16)},tile:{x:p.x,y:p.y}}));
}
export function namingSignature(seed='atlas-root',x=0,y=0){return JSON.stringify(getLocationNames(seed,x,y))}
export function namingSelfTest(seed='atlas-root'){
  let p=normalizeCoordinates(12345,67890);
  if(sampleElevation(seed,p.x,p.y)<CONTINENT_SEA_LEVEL)outer:for(let y=0;y<WORLD_HEIGHT;y+=Math.floor(WORLD_HEIGHT/32))for(let x=0;x<WORLD_WIDTH;x+=Math.floor(WORLD_WIDTH/64))if(sampleElevation(seed,x,y)>=CONTINENT_SEA_LEVEL){p=normalizeCoordinates(x,y);break outer}
  const a=getLocationNames(seed,p.x,p.y),b=getLocationNames(seed,p.x,p.y);
  const checks=[
    {id:'determinism',ok:JSON.stringify(a)===JSON.stringify(b),note:'same coordinate returns the same physical hierarchy'},
    {id:'hierarchy',ok:a.continent.active&&a.territory.active&&a.region.active&&a.tract.active&&a.area.active,note:'land tiles receive all named physical tiers'},
    {id:'chunk-unnamed',ok:a.chunk.name===undefined&&a.tile.name===undefined,note:'chunk and tile remain unnamed'},
    {id:'size-caps',ok:a.territory.sizeCapKm===2000&&a.region.sizeCapKm===400&&a.tract.sizeCapKm===80&&a.area.sizeCapKm===8,note:'named tiers expose the specification size caps'},
    {id:'physical-types',ok:[a.territory,a.region,a.tract,a.area].every(v=>typeof v.physicalType==='string'&&v.physicalType!=='???'),note:'named tiers use physical terrain or biome types'}
  ];
  return {passed:checks.every(c=>c.ok),checks,sample:a};
}
