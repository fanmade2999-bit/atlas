/**
 * Deterministic tile texture identity.
 *
 * Like rotated block textures in voxel games, orientation is derived from the
 * world coordinate so repeated terrain does not stamp with one identical motif.
 */
function hash(seed,x,y,salt='texture'){
  let h=2166136261>>>0;
  const s=String(seed)+'|'+Math.trunc(x)+'|'+Math.trunc(y)+'|'+salt;
  for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619);}
  h^=h>>>13;h=Math.imul(h,0x5bd1e995);h^=h>>>15;
  return h>>>0;
}
export function getTileTexture(seed='atlas-root',x=0,y=0,surface='grass'){
  const orientation=hash(seed,x,y,'rotation')%4;
  const variant=hash(seed,x,y,'variant')%4;
  const tone=hash(seed,x,y,'tone')%3;
  const pattern=hash(seed,x,y,'pattern');
  return Object.freeze({
    family:String(surface||'unknown'),
    orientation:orientation*90,
    variant,
    tone,
    pattern
  });
}
export function textureSelfTest(seed='atlas-root'){
  const a=getTileTexture(seed,12345,67890,'grass'),b=getTileTexture(seed,12345,67890,'grass'),c=getTileTexture(seed,12346,67890,'grass');
  const checks=[
    {id:'texture-determinism',ok:JSON.stringify(a)===JSON.stringify(b),note:'same tile always gets the same texture identity'},
    {id:'texture-rotation',ok:[0,90,180,270].includes(a.orientation),note:'texture orientation uses quarter-turn rotations'},
    {id:'texture-variation',ok:JSON.stringify(a)!==JSON.stringify(c),note:'neighboring coordinates can receive different variants/orientations'}
  ];
  return {passed:checks.every(c=>c.ok),checks};
}
