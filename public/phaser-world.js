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

function surfaceColor(t){
  const s=t.surface||t.detail?.surface||'';
  const e=clamp(Number(t.elevation)||0);
  const palette={
    'water-deep':0x246fa8,'water-shallow':0x4aa7bd,'water-lake':0x358fbd,'water-river':0x43a9c7,
    swamp:0x557f68,sand:0xd7b86b,snow:0xdce8e8,tundra:0x9eb8ad,'cold-grass':0x829d72,
    'wet-ground':0x6f9b70,grass:0x7da64f,'rocky-grass':0x778f58,meadow:0x8cae5d,
    'forest-floor':0x668b4c,'scorched-dirt':0x514235,'stone-wall':0x72777b,'water-pond':0x358fbd,ice:0xdceff5
  };
  let base=palette[s]||0x788d5a;
  if((t.waterform||'None')!=='None' && !palette[s]) base=0x358fbd;
  const shadeFactor=s.startsWith('water-') ? 0 : (e-.5)*.16;
  if(shadeFactor<0) base=shade(base,-shadeFactor);
  else if(shadeFactor>0) base=shade(base,shadeFactor);
  return base;
}
function tileColor(t,mode){
  const e=clamp(Number(t.elevation)||0),m=clamp(Number(t.moisture)||0),temp=clamp(Number(t.temperature)||0);
  const water=t.waterform||t.hydrology?.waterform||'None',biome=t.biome||'???',land=t.landform||'Plains';
  if(mode==='normal')return surfaceColor(t);
  if(mode==='elevation'){
    const stops=[0x315b39,0x71934b,0xc8b86b,0x9a7449,0xe7e9e5],p=e*(stops.length-1),i=Math.min(stops.length-2,Math.floor(p)),f=p-i,a=rgb(stops[i]),b=rgb(stops[i+1]);
    return (lerp(a.r,b.r,f)<<16)|(lerp(a.g,b.g,f)<<8)|lerp(a.b,b.b,f);
  }
  if(mode==='temperature'){
    const stops=[0x3554a5,0x3e9fc1,0x72c778,0xe0c957,0xd9533d],p=temp*4,i=Math.min(3,Math.floor(p)),f=p-i,a=rgb(stops[i]),b=rgb(stops[i+1]);
    return (lerp(a.r,b.r,f)<<16)|(lerp(a.g,b.g,f)<<8)|lerp(a.b,b.b,f);
  }
  if(mode==='moisture'){
    const stops=[0x87633e,0xb39551,0x70ae76,0x4298bc,0x2864a5],p=m*4,i=Math.min(3,Math.floor(p)),f=p-i,a=rgb(stops[i]),b=rgb(stops[i+1]);
    return (lerp(a.r,b.r,f)<<16)|(lerp(a.g,b.g,f)<<8)|lerp(a.b,b.b,f);
  }
  if(mode==='biome')return BIOME_COLORS[biome]||0x68737d;
  if(mode==='landform')return LAND_COLORS[land]||0x68737d;
  if(mode==='waterform')return WATER_COLORS[water]||0x71804b;
  return surfaceColor(t);
}

function rotatePoint(px,py,angle,cx=.5,cy=.5){
  const dx=px-cx,dy=py-cy,rad=angle*Math.PI/180,cos=Math.cos(rad),sin=Math.sin(rad);
  return {x:cx+dx*cos-dy*sin,y:cy+dx*sin+dy*cos};
}
function drawTextureMark(g,x,y,size,texture,index,base){
  const tone=(texture?.tone??0)-1,variant=texture?.variant??0,angle=texture?.orientation??0;
  const patterns=[
    [[.16,.25,.34,.07],[.62,.18,.18,.05],[.45,.72,.28,.06],[.80,.58,.10,.05]],
    [[.18,.18,.09,.09],[.52,.36,.34,.07],[.27,.76,.22,.05],[.72,.80,.12,.04]],
    [[.08,.46,.30,.06],[.40,.16,.10,.10],[.70,.34,.22,.05],[.62,.74,.28,.05]],
    [[.24,.30,.24,.05],[.70,.16,.08,.10],[.46,.58,.34,.05],[.16,.82,.14,.04]]
  ][variant%4];
  const color=rgb(base);
  const mark=Math.max(1,Math.min(255,color.r+tone*9))<<16 | Math.max(1,Math.min(255,color.g+tone*9))<<8 | Math.max(1,Math.min(255,color.b+tone*9));
  g.lineStyle(Math.max(1,size*.014),mark,.16);
  patterns.forEach((q,k)=>{
    const a=rotatePoint(q[0],q[1],angle),b=rotatePoint(q[0]+q[2],q[1]+(k%2?.02:-.02),angle);
    g.lineBetween(x+a.x*size,y+a.y*size,x+b.x*size,y+b.y*size);
  });
}
function drawTileTexture(g,t,x,y,size,mode){
  if(mode!=='normal')return;
  const texture=t.texture;
  const base=tileColor(t,mode);
  drawTextureMark(g,x,y,size,texture,0,base);
  const local=t.detail?.local;
  if(local){
    const strength=.04+local.relief*.08;
    g.fillStyle(0x101a12,strength);
    g.fillRect(x+size*(.06+local.clearing*.08),y+size*(.72-local.coverage*.12),size*.20,size*.07);
    g.fillStyle(0xffffff,.018+local.roughness*.045);
    g.fillRect(x+size*.58,y+size*(.10+local.relief*.30),size*.22,size*.05);
  }
}

function detailColor(type){
  return {tree:0x285d2e,shrub:0x4f8239,grass:0xb9cb62,rock:0x7b8584,flower:0xe9b7d4,shore:0xd9d39a,dune:0xe7c67d,snowcap:0xf8fbff}[type]||0xffffff;
}
function drawDetail(g,d,ox,oy,size){
  const x=ox+d.x*size,y=oy+d.y*size,s=size*(d.size||.5),c=detailColor(d.type);
  g.fillStyle(c,1);g.lineStyle(Math.max(1,size*.018),0x1a2119,.45);
  if(d.type==='tree'){
    const trunk=Math.max(1,s*.11);
    g.fillStyle(0x5a4329,1);g.fillRect(x-trunk*.5,y+s*.05,trunk,s*.42);
    g.fillStyle(c,1);
    g.fillTriangle(x-s*.40,y+s*.17,x,y-s*.50,x+s*.40,y+s*.17);
    g.fillTriangle(x-s*.30,y-s*.05,x,y-s*.60,x+s*.30,y-s*.05);
    g.fillTriangle(x-s*.22,y-s*.22,x,y-s*.67,x+s*.22,y-s*.22);
  }else if(d.type==='shrub'){
    g.fillCircle(x-s*.20,y+s*.08,s*.22);g.fillCircle(x+s*.14,y,s*.25);g.fillCircle(x,y-s*.10,s*.21);
  }else if(d.type==='grass'){
    g.lineStyle(Math.max(1,size*.018),c,.9);
    for(let i=-1;i<=1;i++)g.lineBetween(x+i*s*.18,y+s*.20,x+i*s*.06,y-s*.22);
  }else if(d.type==='rock'){
    g.fillStyle(c,1);g.fillTriangle(x-s*.44,y+s*.27,x-s*.10,y-s*.32,x+s*.46,y+s*.20);
    g.fillStyle(0xb0b6ae,.35);g.fillTriangle(x-s*.08,y-s*.28,x+s*.10,y-s*.10,x+s*.34,y+s*.16);
  }else if(d.type==='flower'){
    g.fillStyle(c,1);g.fillCircle(x,y,s*.10);for(let i=0;i<4;i++){const a=i*Math.PI/2;g.fillCircle(x+Math.cos(a)*s*.16,y+Math.sin(a)*s*.16,s*.09)}
  }else if(d.type==='shore'){
    g.lineStyle(Math.max(1,size*.035),c,.85);g.arc(x,y,s*.34,0.1,Math.PI-.1,false);
  }else if(d.type==='dune'){
    g.lineStyle(Math.max(1,size*.035),c,.65);g.arc(x,y,s*.35,Math.PI,Math.PI*2,false);
  }else if(d.type==='snowcap'){
    g.fillTriangle(x-s*.4,y+s*.15,x,y-s*.35,x+s*.4,y+s*.15);
  }
}

function drawTransform(g,t,x,y,size){
  const tr=t.transform;
  if(!tr)return;
  const surface=t.surface||'';
  if(surface==='scorched-dirt'){
    g.lineStyle(Math.max(1,size*.035),0x241b15,.8);
    for(let i=0;i<3;i++)g.lineBetween(x+size*(.18+i*.22),y+size*.78,x+size*(.25+i*.18),y+size*.35);
  }else if(surface==='stone-wall'){
    g.lineStyle(Math.max(1,size*.025),0x303438,.85);
    for(let i=1;i<3;i++)g.lineBetween(x+size*.06,y+size*(i/3),x+size*.94,y+size*(i/3));
    g.lineBetween(x+size*.5,y+size*.06,x+size*.5,y+size*.33);
    g.lineBetween(x+size*.25,y+size*.33,x+size*.25,y+size*.66);
    g.lineBetween(x+size*.75,y+size*.66,x+size*.75,y+size*.94);
  }else if(surface==='water-pond'){
    g.lineStyle(Math.max(1,size*.025),0xb7ecff,.8);
    g.arc(x+size*.5,y+size*.5,size*.3,Math.PI*.1,Math.PI*.9,false);
  }else if(surface==='ice'){
    g.lineStyle(Math.max(1,size*.025),0xffffff,.8);
    g.lineBetween(x+size*.2,y+size*.7,x+size*.75,y+size*.25);
    g.lineBetween(x+size*.45,y+size*.85,x+size*.85,y+size*.45);
  }
  if(t.object?.type==='BerryTree'){
    g.fillStyle(0x244c27,1);
    g.fillCircle(x+size*.5,y+size*.32,size*.2);
    g.fillCircle(x+size*.34,y+size*.43,size*.16);
    g.fillCircle(x+size*.66,y+size*.43,size*.16);
    g.fillStyle(0x714b2d,1);
    g.fillRect(x+size*.46,y+size*.48,size*.08,size*.35);
  }
}

function drawTile(scene,t,dx,dy,size,mode){
  const x=dx*size,y=dy*size,g=scene.g;
  const base=tileColor(t,mode);
  g.fillStyle(base,1);g.fillRect(Math.floor(x),Math.floor(y),Math.ceil(size)+1,Math.ceil(size)+1);

  if(mode==='normal'){
    const e=clamp(Number(t.elevation)||0),surface=t.surface||t.detail?.surface||'',water=t.waterform||'None';
    if(water!=='None'){
      g.fillStyle(0xffffff,.055+e*.025);
      g.fillRect(x,y+size*.10,size,size*.08);
      if(water==='River'||water==='Shallows'){
        g.lineStyle(Math.max(1,size*.025),0xbbeaf2,.45);
        g.lineBetween(x+size*.08,y+size*.30,x+size*.82,y+size*.25);
        g.lineBetween(x+size*.28,y+size*.62,x+size*.92,y+size*.57);
      }
    }else{
      g.fillStyle(0xffffff,.025+e*.07);g.fillRect(x,y,size,size*.13);
      g.fillStyle(0x25351f,.035);g.fillRect(x+size*.08,y+size*.72,size*.25,size*.08);
      if(surface==='forest-floor'||surface==='meadow'||surface==='grass'){
        g.fillStyle(0x334d29,.035);g.fillRect(x+size*.55,y+size*.48,size*.18,size*.06);
      }
    }
  }
  (t.detail?.details||[]).forEach(d=>drawDetail(g,d,x,y,size));
  drawTileTexture(g,t,x,y,size,mode);
  if(mode==='normal')drawTransform(g,t,x,y,size);
}

function drawPlayer(scene,x,y,size,step=0){
  const g=scene.player;g.clear();
  const bob=Math.sin(step*Math.PI*2)*size*.035;
  const cx=x*size+size/2,cy=y*size+size/2+bob;
  const s=size*.82;
  g.fillStyle(0x000000,.22);g.fillEllipse(cx,cy+s*.28,s*.48,s*.20);
  g.fillStyle(0x315d8f,1);g.fillRoundedRect(cx-s*.24,cy-s*.02,s*.48,s*.48,s*.10);
  g.fillStyle(0xd8a477,1);g.fillCircle(cx,cy-s*.22,s*.20);
  g.fillStyle(0x5b3b2b,1);g.fillRect(cx-s*.19,cy-s*.40,s*.38,s*.11);
  g.fillStyle(0xe7c04f,1);g.fillRect(cx-s*.30,cy+s*.05,s*.60,s*.09);
  g.lineStyle(Math.max(1,size*.045),0x10151b,.9);g.strokeRoundedRect(cx-s*.27,cy-s*.08,s*.54,s*.62,s*.10);
}

function worldDelta(value,center,size){
  let d=value-center;
  if(size>0&&Math.abs(d)>size/2)d+=d>0?-size:size;
  return d;
}

class AtlasScene extends PhaserLib.Scene{
  constructor(){super('AtlasWorld')}
  create(){
    this.g=this.add.graphics();
    this.player=this.add.graphics();
    this.snapshot=null;
    this.mode='normal';
    this.onTap=null;
    this.lastTarget=null;
    this.visualPlayer=null;
    this.visualCamera=null;
    this.cameraStart=null;
    this.cameraTarget=null;
    this.playerAnim=0;
    this.cameraAnim=0;
    this.motionDuration=110;
    this.inputBound=false;
    scene=this;
    if(lastSnapshot)this.updateWorld(lastSnapshot,lastMode,lastTap);
    this.inputBound=true;
    this.input.on('pointerdown', pointer => {
      if(!this.lastLayout || !this.snapshot || !this.onTap)return;
      const rect=this.game.canvas.getBoundingClientRect();
      const px=(pointer.event.clientX-rect.left)*(this.scale.width/rect.width);
      const py=(pointer.event.clientY-rect.top)*(this.scale.height/rect.height);
      const {cols,rows,size,ox,oy}=this.lastLayout;
      const sx=Math.floor((px-ox)/size), sy=Math.floor((py-oy)/size);
      if(sx<0||sx>=cols||sy<0||sy>=rows)return;
      const center=this.cameraNow();
      const wx=Math.round(center.x+(sx-Math.floor(cols/2)));
      const wy=Math.round(center.y+(sy-Math.floor(rows/2)));
      const fixture=(this.snapshot.testFixtures||[]).find(f=>{
        if(!f.available||f.testOnly!==true)return false;
        const fx=worldDelta(f.x,center.x,40075000)+Math.floor(cols/2);
        const fy=(f.y-center.y)+Math.floor(rows/2);
        return Math.round(fx)===sx&&Math.round(fy)===sy;
      });
      if(fixture){this.onTap({kind:'fixture',fixture});return;}
      const tile=this.snapshot.tiles.find(t=>t.x===((wx%40075000)+40075000)%40075000&&t.y===wy);
      this.onTap({kind:'tile',x:wx,y:wy,tile});
    });
  }
  layoutFor(snapshot){
    const cols=snapshot.width,rows=snapshot.height;
    const size=Math.max(1,Math.floor(Math.min(this.scale.width/cols,this.scale.height/rows)));
    const ox=Math.floor((this.scale.width-cols*size)/2),oy=Math.floor((this.scale.height-rows*size)/2);
    return {size,ox,oy,cols,rows};
  }
  cameraNow(){
    return this.visualCamera||this.cameraTarget||this.snapshot?.center||{x:0,y:0};
  }
  screenPlayerPosition(){
    const p=this.visualPlayer||this.snapshot?.player?.position||this.snapshot?.center;
    const c=this.cameraNow();
    const {cols,rows,size,ox,oy}=this.lastLayout;
    return {
      x:Math.floor(cols/2)+worldDelta(p.x,c.x,40075000)/1+ox/size,
      y:Math.floor(rows/2)+(p.y-c.y)+oy/size
    };
  }
  redrawWorld(){
    if(!this.snapshot||!this.lastLayout)return;
    const {cols,rows,size,ox,oy}=this.lastLayout;
    const center=this.cameraNow();
    this.g.clear();
    this.snapshot.tiles.forEach(t=>{
      const dx=worldDelta(t.x,center.x,40075000);
      const dy=t.y-center.y;
      const sx=Math.floor(cols/2)+dx+ox/size;
      const sy=Math.floor(rows/2)+dy+oy/size;
      if(sx>-1&&sx<cols&&sy>-1&&sy<rows)drawTile(this,t,sx,sy,size,this.mode);
    });
  }
  updateWorld(snapshot,mode,onTap){
    const previousTarget=this.lastTarget;
    this.snapshot=snapshot;
    this.mode=mode||'normal';
    this.onTap=onTap||null;
    this.lastLayout=this.layoutFor(snapshot);

    const target=snapshot.player?.position||snapshot.center;
    if(!this.visualPlayer){
      this.visualPlayer={x:target.x,y:target.y};
      this.visualCamera={x:snapshot.center.x,y:snapshot.center.y};
      this.cameraTarget={x:snapshot.center.x,y:snapshot.center.y};
      this.lastTarget={x:target.x,y:target.y};
    }

    if(previousTarget&&(
      previousTarget.x!==target.x||previousTarget.y!==target.y
    )){
      this.visualPlayer={x:this.visualPlayer?.x??previousTarget.x,y:this.visualPlayer?.y??previousTarget.y};
      this.playerAnim=0;
    }

    const camera=this.cameraTarget||snapshot.center;
    const playerOffsetX=worldDelta(target.x,camera.x,40075000);
    const playerOffsetY=target.y-camera.y;
    if(Math.abs(playerOffsetX)>=4||Math.abs(playerOffsetY)>=4){
      this.cameraStart={x:this.cameraNow().x,y:this.cameraNow().y};
      this.cameraTarget={x:snapshot.center.x,y:snapshot.center.y};
      this.cameraAnim=0;
    }

    this.redrawWorld();
    this.drawPlayerNow();
    this.lastTarget={x:target.x,y:target.y};
  }
  drawPlayerNow(){
    if(!this.lastLayout)return;
    const p=this.screenPlayerPosition();
    const progress=Math.min(1,this.playerAnim);
    drawPlayer(this,p.x,p.y,this.lastLayout.size,progress);
  }
  update(time,delta){
    if(!this.snapshot||!this.lastLayout)return;
    const dt=Math.min(50,Math.max(0,delta||16.7));
    const target=this.snapshot.player?.position||this.snapshot.center;

    if(this.visualPlayer){
      const rate=dt/this.motionDuration;
      this.visualPlayer.x+=worldDelta(target.x,this.visualPlayer.x,40075000)*Math.min(1,rate);
      this.visualPlayer.y+=(target.y-this.visualPlayer.y)*Math.min(1,rate);
      this.playerAnim=Math.min(1,this.playerAnim+rate);
    }

    let cameraChanged=false;
    if(this.cameraTarget&&this.cameraStart&&(
      this.cameraStart.x!==this.cameraTarget.x||this.cameraStart.y!==this.cameraTarget.y
    )){
      this.cameraAnim=Math.min(1,this.cameraAnim+dt/this.motionDuration);
      const t=this.cameraAnim*this.cameraAnim*(3-2*this.cameraAnim);
      const nextX=this.cameraStart.x+worldDelta(this.cameraTarget.x,this.cameraStart.x,40075000)*t;
      const nextY=this.cameraStart.y+(this.cameraTarget.y-this.cameraStart.y)*t;
      if(!this.visualCamera)this.visualCamera={x:nextX,y:nextY};
      else{
        cameraChanged=Math.abs(this.visualCamera.x-nextX)>.001||Math.abs(this.visualCamera.y-nextY)>.001;
        this.visualCamera.x=nextX;this.visualCamera.y=nextY;
      }
      if(this.cameraAnim>=1){
        this.visualCamera={...this.cameraTarget};
        this.cameraStart=null;
      }
    }

    if(cameraChanged)this.redrawWorld();
    this.drawPlayerNow();
  }
  resize(){
    if(this.snapshot){
      this.lastLayout=this.layoutFor(this.snapshot);
      this.redrawWorld();
      this.drawPlayerNow();
    }
  }
}
let game=null,scene=null,container=null,lastSnapshot=null,lastMode='normal',lastTap=null,phaserError=null;

export function mountPhaserWorld(host,snapshot,mode='normal',onTap=null){
  if(!PhaserLib)throw new Error('Phaser 3 failed to load (CDN unavailable or script blocked)');
  container=host;lastSnapshot=snapshot;lastMode=mode;lastTap=onTap;
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
  }
  if(scene)scene.updateWorld(snapshot,mode,onTap);
  return game;
}
export function destroyPhaserWorld(){if(game){game.destroy(true);game=null;scene=null;container=null}}
