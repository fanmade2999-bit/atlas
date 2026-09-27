// Layer 3: deterministic physical naming hierarchy.
// Names are derived from seed + coordinate tier. No political naming.
const hash32=(s)=>{let h=2166136261>>>0;for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619)}return h>>>0};
const pick=(a,n)=>a[n%a.length];
const syllables=['xel','var','ryn','dor','tal','ven','mir','ka','lor','syl','fen','ora','ith'];
const types={continent:['Continent','Landmass'],territory:['Rainforest','Desert','Grassland','Woodland','Tundra','Mountain'],region:['Rainforest','Desert','Grassland','Woodland','Tundra','Mountain'],tract:['Rainforest','Desert','Grassland','Woodland','Tundra','Mountain'],area:['Rainforest','Desert','Grassland','Woodland','Tundra','Mountain']};
const limits={territory:2000,region:400,tract:80,area:8};
const tierScale={continent:8192,territory:2048,region:512,tract:128,area:16};
const title=(s)=>s.charAt(0).toUpperCase()+s.slice(1);
function baseName(seed,cx,cy,tier){const h=hash32(seed+'|name|'+tier+'|'+cx+'|'+cy);const a=pick(syllables,h>>>0);const b=pick(syllables,(h/13)>>>0);const c=pick(syllables,(h/97)>>>0);return title(a+b+(h%5===0?c:''));}
function physicalType(seed,cx,cy,tier){return pick(types[tier]||types.area,hash32(seed+'|type|'+tier+'|'+cx+'|'+cy));}
function tierAt(seed,x,y,tier){const scale=tierScale[tier]||16;const cx=Math.floor(x/scale),cy=Math.floor(y/scale);const name=baseName(seed,cx,cy,tier);const type=physicalType(seed,cx,cy,tier);return {tier,cell:{x:cx,y:cy},name:tier==='continent'?name+' Continent':name+' '+type,sizeCapKm:limits[tier]??null,split:'organic'};}
export function getLocationNames(seed='atlas-root',x=0,y=0){return {continent:tierAt(seed,x,y,'continent'),territory:tierAt(seed,x,y,'territory'),region:tierAt(seed,x,y,'region'),tract:tierAt(seed,x,y,'tract'),area:tierAt(seed,x,y,'area'),chunk:{x:Math.floor(x/16),y:Math.floor(y/16)},tile:{x,y}}}
export function namingSignature(seed='atlas-root',x=0,y=0){const a=getLocationNames(seed,x,y);return JSON.stringify(a)}
