const PhaserLib=globalThis.Phaser;

const BIOME_COLORS={
  'Alpine':0xe4e9ed,'Highlands':0x8d795e,'Tundra':0x91b9bb,'Cold Steppe':0x7d987e,
  'Desert':0xd0ad5a,'Tropical Forest':0x187c48,'Wetland':0x3c8c73,'Grassland':0x88a944,'Temperate Forest':0x397540
};
const WATER_COLORS={Ocean:0x155fa3,Shallows:0x4ea8c4,Lake:0x258ac2,River:0x45b8d8,Swamp:0x3d8064};
const LAND_COLORS={Ocean:0x1769aa,Coast:0x58a9c8,Plains:0x8eae4d,Hills:0x9b9b4f,Valley:0x628e57,Plateau:0xb08a50,Mountain:0x766b63,Peak:0xe6e9eb};

function clamp(v,a=0,b=1){return Math.max(a,Math.min(b,v))}
function lerp(a,b,t){return Math.round(a+(b-a)*t)}
function rgb(hex){return {r:(hex>>16)&255,g:(hex>>8)&255,b:hex&255}}
function shade(hex,f){const c=rgb(hex);return (lerp(c.r,255,f)<<16)|(lerp(c.g,255,f)<<8)|lerp(c.b,255,f)}

function tileColor(t,mode){
  const e=clamp(Number(t.elevation)||0),m=clamp(Number(t.moisture)||0),temp=clamp(Number(t.temperature)||0);
  const water=t.waterform||t.hydrology?.waterform||'None';
  const biome=t.biome||'???',land=t.landform||'Plains';
  if(mode==='elevation'){
    const stops=[0x1c4c2d,0x6e9641,0xcdbf64,0x966941,0xebebeb],p=e*(stops.length-1),i=Math.min(stops.length-2,Math.floor(p)),f=p-i,a=rgb(stops[i]),b=rgb(stops[i+1]);
    return (lerp(a.r,b.r,f)<<16)|(lerp(a.g,b.g,f)<<8)|lerp(a.b,b.b,f);
  }
  if(mode==='temperature'){
    const stops=[0x2a4baa,0x37aad2,0x6ecf7d,0xf0cd46,0xeb4b2d],p=temp*4,i=Math.min(3,Math.floor(p)),f=p-i,a=rgb(stops[i]),b=rgb(stops[i+1]);
    return (lerp(a.r,b.r,f)<<16)|(lerp(a.g,b.g,f)<<8)|lerp(a.b,b.b,f);
  }
  if(mode==='moisture'){
    const stops=[0x7a5c37,0xb2964e,0x69b478,0x2d96cd,0x1950aa],p=m*4,i=Math.min(3,Math.floor(p)),f=p-i,a=rgb(stops[i]),b=rgb(stops[i+1]);
    return (lerp(a.r,b.r,f)<<16)|(lerp(a.g,b.g,f)<<8)|lerp(a.b,b.b,f);
  }
  if(mode==='biome')return BIOME_COLORS[biome]||0x68737d;
  if(mode==='landform')return LAND_COLORS[land]||0x68737d;
  if(mode==='waterform')return WATER_COLORS[water]||0x71804b;
  if(WATER_COLORS[water])return WATER_COLORS[water];
  return BIOME_COLORS[biome]||0x65705c;
}

function detailColor(type){
  return {tree:0x163f1b,shrub:0x397c39,grass:0xd6e86d,rock:0x9ba19d,flower:0xf0d5e8,shore:0xd9f6ff,dune:0xf0d08a,snowcap:0xffffff}[type]||0xffffff;
}
function drawDetail(g,d,ox,oy,size){
  const x=ox+d.x*size,y=oy+d.y*size,s=size*(d.size||.5),c=detailColor(d.type);
  g.fillStyle(c,1);g.lineStyle(Math.max(1,size*.025),0x102010,.45);
  if(d.type==='tree'){
    g.fillRect(x-s*.08,y+s*.15,s*.16,s*.42);
    g.fillTriangle(x-s*.48,y+s*.20,x,y-s*.58,x+s*.48,y+s*.20);
    g.fillTriangle(x-s*.36,y-s*.02,x,y-s*.68,x+s*.36,y-s*.02);
  }else if(d.type==='shrub'){
    g.fillCircle(x-s*.18,y+s*.08,s*.24);g.fillCircle(x+s*.15,y,s*.26);g.fillCircle(x,y-s*.12,s*.23);
  }else if(d.type==='grass'){
    for(let i=-1;i<=1;i++)g.lineBetween(x+i*s*.16,y+s*.22,x+i*s*.05,y-s*.22);
  }else if(d.type==='rock'){
    g.fillTriangle(x-s*.45,y+s*.30,x-s*.05,y-s*.40,x+s*.48,y+s*.18);
  }else if(d.type==='flower'){
    g.fillCircle(x,y,s*.10);for(let i=0;i<4;i++){const a=i*Math.PI/2;g.fillCircle(x+Math.cos(a)*s*.16,y+Math.sin(a)*s*.16,s*.10)}
  }else if(d.type==='shore'){
    g.lineStyle(Math.max(1,size*.035),c,.9);g.arc(x,y,s*.34,0.1,Math.PI-.1,false);
  }else if(d.type==='dune'){
    g.lineStyle(Math.max(1,size*.035),c,.9);g.arc(x,y,s*.35,Math.PI,Math.PI*2,false);
  }else if(d.type==='snowcap'){
    g.fillTriangle(x-s*.4,y+s*.15,x,y-s*.35,x+s*.4,y+s*.15);
  }
}

function drawTile(scene,t,dx,dy,size,mode){
  const x=dx*size,y=dy*size;
  const g=scene.g;
  g.fillStyle(tileColor(t,mode),1);g.fillRect(x,y,size-1,size-1);
  const water=t.waterform||t.hydrology?.waterform||'None';
  if(mode==='normal'&&water==='None'){
    const e=clamp(Number(t.elevation)||0);
    g.fillStyle(0xffffff,0.035+e*.08);g.fillRect(x,y,size-1,size*.18);
  }
  (t.detail?.details||[]).forEach(d=>drawDetail(g,d,x,y,size));
  if(Number(t.x)%16===0)g.lineStyle(2,0xd8df68,.8),g.lineBetween(x,y,x,y+size);
  if(Number(t.y)%16===0)g.lineStyle(2,0xd8df68,.8),g.lineBetween(x,y,x+size,y);
}

function drawPlayer(scene,x,y,size){
  const g=scene.player;
  g.clear();g.fillStyle(0xf7d34a,1);g.fillCircle(x*size+size/2,y*size+size/2,size*.30);
  g.lineStyle(Math.max(2,size*.07),0x11151b,.9);g.strokeCircle(x*size+size/2,y*size+size/2,size*.34);
}

class AtlasScene extends PhaserLib.Scene{
  constructor(){super('AtlasWorld')}
  create(){this.g=this.add.graphics();this.player=this.add.graphics();this.snapshot=null;this.mode='normal';this.onTap=null}
  updateWorld(snapshot,mode,onTap){
    this.snapshot=snapshot;this.mode=mode||'normal';this.onTap=onTap||null;
    const cols=snapshot.width,rows=snapshot.height;
    const size=Math.max(1,Math.floor(Math.min(this.scale.width/cols,this.scale.height/rows)));
    const ox=Math.floor((this.scale.width-cols*size)/2),oy=Math.floor((this.scale.height-rows*size)/2);
    this.g.clear();
    snapshot.tiles.forEach(t=>drawTile(this,t,t.dx+Math.floor(cols/2),t.dy+Math.floor(rows/2),size,this.mode));
    const p=snapshot.player?.position||snapshot.center;
    const pdx=p.x-snapshot.center.x,pdy=p.y-snapshot.center.y;
    drawPlayer(this,Math.floor(cols/2)+pdx,Math.floor(rows/2)+pdy,size);
    this.lastLayout={size,ox,oy,cols,rows};
  }
  resize(){if(this.snapshot)this.updateWorld(this.snapshot,this.mode,this.onTap)}
}
let game=null,scene=null,container=null,lastSnapshot=null,lastMode='normal',phaserError=null;

export function mountPhaserWorld(host,snapshot,mode='normal',onTap=null){
  if(!PhaserLib)throw new Error('Phaser 3 failed to load (CDN unavailable or script blocked)');
  container=host;lastSnapshot=snapshot;lastMode=mode;
  if(!game){
    game=new PhaserLib.Game({
      type:PhaserLib.CANVAS,
      parent:host,
      width:host.clientWidth||480,
      height:host.clientHeight||320,
      transparent:true,
      backgroundColor:'#10161a',
      render:{antialias:false,pixelArt:true},
      scale:{mode:PhaserLib.Scale.RESIZE,autoCenter:PhaserLib.Scale.CENTER_BOTH},
      scene:AtlasScene
    });
    scene=game.scene.getScene('AtlasWorld');
    if(!scene)throw new Error('Phaser AtlasWorld scene failed to initialize');
    scene.events.once('create',()=>scene.updateWorld(lastSnapshot,lastMode,onTap));
  }else scene.updateWorld(snapshot,mode,onTap);
  return game;
}
export function destroyPhaserWorld(){if(game){game.destroy(true);game=null;scene=null;container=null}}
