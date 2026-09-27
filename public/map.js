const WORLD_WIDTH=40075000;
const WORLD_HEIGHT=20003000;
const SCALES=[262144,32768,4096,512,16,1];

const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const wrapX=v=>((Math.trunc(v)%WORLD_WIDTH)+WORLD_WIDTH)%WORLD_WIDTH;
const capY=v=>clamp(Math.trunc(v),0,WORLD_HEIGHT-1);
const esc=v=>String(v).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'","&#039;");

function biomeColor(b){
  const colors={Ocean:'#155fa3',Alpine:'#e4e9ed',Highlands:'#8d795e',Tundra:'#91b9bb','Cold Steppe':'#7d987e',Desert:'#d0ad5a','Tropical Forest':'#187c48',Wetland:'#3c8c73',Grassland:'#88a944','Temperate Forest':'#397540'};
  return colors[b]||'#65705c';
}
function layerColor(c,layer){
  if(layer==='normal') return 'linear-gradient(135deg,'+biomeColor(c.biome)+','+biomeColor(c.biome)+'cc)';
  if(layer==='elevation') return ramp(c.elevation,[[28,76,45],[110,150,65],[205,190,100],[150,105,65],[235,235,235]]);
  if(layer==='temperature') return ramp(c.temperature,[[42,75,170],[55,170,210],[110,205,125],[240,205,70],[235,75,45]]);
  return ramp(c.moisture,[[122,92,55],[178,150,78],[105,180,120],[45,150,205],[25,80,170]]);
}
function ramp(value,stops){
  const x=clamp(Number(value)||0,0,1)*(stops.length-1),i=Math.min(stops.length-2,Math.floor(x)),f=x-i,a=stops[i],b=stops[i+1];
  const rgb=a.map((v,k)=>Math.round(v+(b[k]-v)*f)).join(',');
  const rgb2=b.map((v,k)=>Math.round(v+(b[k]-v)*f)).join(',');
  return 'linear-gradient(135deg,rgb('+rgb+'),rgb('+rgb2+'))';
}

export function renderWorldMap({siteRoot,layout,state,onTeleported}){
  const root=siteRoot;
  const map={
    zoom:renderWorldMap.zoom??2,
    centerX:renderWorldMap.centerX??state.gameX,
    centerY:renderWorldMap.centerY??state.gameY,
    layer:renderWorldMap.layer??'normal',
    data:null,target:null,drag:false,moved:false,startX:0,startY:0,startCenterX:0,startCenterY:0
  };
  renderWorldMap.zoom=map.zoom;renderWorldMap.centerX=map.centerX;renderWorldMap.centerY=map.centerY;renderWorldMap.layer=map.layer;

  const fetchMap=async()=>{
    const p=new URLSearchParams({seed:state.seed,x:map.centerX,y:map.centerY,zoom:map.zoom});
    const r=await fetch('/api/world-map?'+p,{cache:'no-store'});if(!r.ok)throw Error('World Map API '+r.status);
    map.data=await r.json();map.centerX=map.data.center.x;map.centerY=map.data.center.y;
    renderWorldMap.centerX=map.centerX;renderWorldMap.centerY=map.centerY;draw();
  };

  const draw=()=>{
    const d=map.data;
    if(!d){
      root.innerHTML=layout('World Map','big-picture navigation','<section class="card"><div class="muted small">Loading world map…</div></section>');
      fetchMap().catch(e=>root.innerHTML=layout('World Map','diagnostic','<section class="card"><div class="muted small">'+esc(e.message)+'</div></section>'));
      return;
    }
    const layerButtons=['normal','elevation','moisture','temperature'];
    let cells='';
    for(let i=0;i<d.cells.length;i++){
      const c=d.cells[i];
      cells+='<div class="world-map-cell" data-index="'+i+'" style="background:'+layerColor(c,map.layer)+'" title="X '+c.x+' · Y '+c.y+' · '+esc(c.biome)+'"></div>';
    }
    const target=map.target;
    root.innerHTML=layout('World Map','big-picture navigation',
      '<section class="card world-map-card">'+
      '<div class="map-toolbar">'+
      '<div class="map-toolbar-group"><button class="map-tool" id="map-zoom-out">−</button><strong class="small">ZOOM '+(map.zoom+1)+'/6</strong><button class="map-tool" id="map-zoom-in">+</button></div>'+
      '<div class="map-toolbar-group">'+layerButtons.map(x=>'<button class="map-tool '+(map.layer===x?'active':'')+'" data-map-layer="'+x+'">'+x.toUpperCase()+'</button>').join('')+'</div></div>'+
      '<div id="world-map-viewport" class="world-map-viewport"><div class="world-map-grid">'+cells+'</div><div class="map-center-cross"></div><div class="map-you">◆</div></div>'+
      '<div class="map-hud"><div><strong>X '+d.center.x+' · Y '+d.center.y+' · CHUNK '+Math.floor(d.center.x/16)+','+Math.floor(d.center.y/16)+'</strong><span>1 cell = '+d.scale.toLocaleString()+' tile'+(d.scale===1?'':'s')+' · swipe to pan · tap to select</span></div><span>YOU ARE HERE</span></div>'+
      (target?'<div class="map-target-card"><div class="target-coords">TARGET · X '+target.x+' · Y '+target.y+'</div><div class="target-meta"><span>Chunk '+Math.floor(target.x/16)+','+Math.floor(target.y/16)+'</span><span>'+esc(target.biome||'???')+'</span><span>'+esc(target.terrain?.waterform||'???')+'</span></div><div class="map-toolbar-group"><button class="map-tool" id="map-clear-target">CLEAR</button><button class="map-tool active" id="map-teleport">TELEPORT HERE</button></div></div>':'')+
      '<div class="map-legend"><span><i style="background:#155fa3"></i>water/low</span><span><i style="background:#397540"></i>forest</span><span><i style="background:#d0ad5a"></i>dry</span><span><i style="background:#e4e9ed"></i>high/cold</span></div>'+
      '<div class="map-help">This is a navigation map, not the playable screen. Tap a location, review its exact coordinates and terrain, then confirm before Atlas teleports the player.</div>'+
      '</section>'
    );
    bind();
  };

  const bind=()=>{
    const v=root.querySelector('#world-map-viewport'),grid=root.querySelector('.world-map-grid');
    if(!v)return;
    const begin=e=>{
      map.drag=true;map.moved=false;map.startX=e.clientX;map.startY=e.clientY;map.startCenterX=map.centerX;map.startCenterY=map.centerY;v.classList.add('dragging');v.setPointerCapture?.(e.pointerId);
    };
    const move=e=>{
      if(!map.drag)return;
      const dx=e.clientX-map.startX,dy=e.clientY-map.startY;
      if(Math.abs(dx)+Math.abs(dy)>8)map.moved=true;
      const scale=map.data.scale,rect=v.getBoundingClientRect();
      map.centerX=wrapX(map.startCenterX-Math.round(dx/Math.max(1,rect.width)*25*scale));
      map.centerY=capY(map.startCenterY-Math.round(dy/Math.max(1,rect.height)*17*scale));
      grid.style.transform='translate('+dx+'px,'+dy+'px)';
      const h=root.querySelector('.map-hud strong');if(h)h.textContent='X '+map.centerX+' · Y '+map.centerY+' · CHUNK '+Math.floor(map.centerX/16)+','+Math.floor(map.centerY/16);
    };
    const end=async e=>{
      if(!map.drag)return;
      map.drag=false;v.classList.remove('dragging');grid.style.transform='';
      if(map.moved){renderWorldMap.centerX=map.centerX;renderWorldMap.centerY=map.centerY;fetchMap().catch(()=>{});return;}
      const rect=v.getBoundingClientRect();
      const fx=clamp((e.clientX-rect.left)/rect.width,0,1),fy=clamp((e.clientY-rect.top)/rect.height,0,1);
      const x=wrapX(map.centerX+Math.round((fx-.5)*25*map.data.scale));
      const y=capY(map.centerY+Math.round((fy-.5)*17*map.data.scale));
      const p=new URLSearchParams({playerId:state.playerId,seed:state.seed,x,y});
      try{
        const r=await fetch('/api/game/inspect?'+p,{cache:'no-store'});if(!r.ok)throw Error('Inspect API '+r.status);
        const z=await r.json();map.target={x,y,biome:z.inspection.climate.biome,terrain:z.inspection.terrain,climate:z.inspection.climate};draw();
      }catch(err){console.warn(err);}
    };
    v.addEventListener('pointerdown',begin);v.addEventListener('pointermove',move);v.addEventListener('pointerup',end);v.addEventListener('pointercancel',end);
    root.querySelector('#map-zoom-out').onclick=()=>{map.zoom=Math.max(0,map.zoom-1);renderWorldMap.zoom=map.zoom;fetchMap().catch(()=>{})};
    root.querySelector('#map-zoom-in').onclick=()=>{map.zoom=Math.min(SCALES.length-1,map.zoom+1);renderWorldMap.zoom=map.zoom;fetchMap().catch(()=>{})};
    root.querySelectorAll('[data-map-layer]').forEach(b=>b.onclick=()=>{map.layer=b.dataset.mapLayer;renderWorldMap.layer=map.layer;draw()});
    root.querySelector('#map-clear-target')?.addEventListener('click',()=>{map.target=null;draw()});
    root.querySelector('#map-teleport')?.addEventListener('click',()=>confirmTeleport(map.target));
  };

  const confirmTeleport=async target=>{
    if(!target)return;
    const details=[
      ['X',target.x],['Y',target.y],['Chunk',Math.floor(target.x/16)+','+Math.floor(target.y/16)],
      ['Biome',target.biome],['Landform',target.terrain?.landform||'???'],['Waterform',target.terrain?.waterform||'???'],
      ['Elevation',Number(target.climate?.elevation??0).toFixed(4)],['Moisture',Number(target.climate?.moisture??0).toFixed(4)]
    ];
    const modal=document.querySelector('#teleport-modal'),body=document.querySelector('#teleport-details');
    body.innerHTML=details.map(x=>'<div class="teleport-row"><span>'+x[0]+'</span><strong>'+esc(x[1])+'</strong></div>').join('');
    modal.hidden=false;
    const cancel=document.querySelector('#teleport-cancel'),ok=document.querySelector('#teleport-confirm');
    const close=()=>{modal.hidden=true;cancel.onclick=null;ok.onclick=null;};
    cancel.onclick=close;
    ok.onclick=async()=>{
      ok.disabled=true;ok.textContent='TELEPORTING…';
      try{
        const p=new URLSearchParams({playerId:state.playerId,seed:state.seed,x:target.x,y:target.y}),r=await fetch('/api/game/teleport?'+p);
        if(!r.ok)throw Error('Teleport API '+r.status);
        const z=await r.json();state.gameX=z.player.position.x;state.gameY=z.player.position.y;state.x=state.gameX;state.y=state.gameY;state.gameSnapshot=null;close();
        if(onTeleported)await onTeleported(z.player);
      }catch(e){ok.disabled=false;ok.textContent='TELEPORT';console.warn(e);}
    };
  };

  draw();
}
