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
function mapGlyph(c,zoom){
  if(zoom<4)return '';
  const water=c.waterform||'None';
  if(water==='Ocean'||water==='Shallows'||water==='Lake'||water==='River')return '≈';
  if(water==='Swamp')return '≋';
  if(c.landform==='Peak'||c.landform==='Mountain')return '▲';
  if(c.biome==='Alpine')return '❄';
  if(c.biome==='Desert')return '·';
  if(c.biome==='Tropical Forest'||c.biome==='Temperate Forest'||c.biome==='Wetland')return '♣';
  return '·';
}
function layerColor(c,layer){
  if(layer==='normal') return 'linear-gradient(135deg,'+biomeColor(c.biome)+','+biomeColor(c.biome)+'cc)';
  if(layer==='elevation') return ramp(c.elevation,[[28,76,45],[110,150,65],[205,190,100],[150,105,65],[235,235,235]]);
  if(layer==='temperature') return ramp(c.temperature,[[42,75,170],[55,170,210],[110,205,125],[240,205,70],[235,75,45]]);
  return ramp(c.moisture,[[122,92,55],[178,150,78],[105,180,120],[45,150,205],[25,80,170]]);
}
function layerBaseColor(c,layer){
  if(layer==='normal') return biomeColor(c.biome);
  if(layer==='elevation') return '#6e9641';
  if(layer==='temperature') return '#6ecf7d';
  return '#69b478';
}

function formatScale(scale){
  if(scale>=1000000)return (scale/1000000).toFixed(1)+'M';
  if(scale>=1000)return Math.round(scale/1000)+'k';
  return String(scale);
}
function wrappedDelta(value,origin){
  let d=value-origin;
  if(Math.abs(d)>WORLD_WIDTH/2)d+=d>0?-WORLD_WIDTH:WORLD_WIDTH;
  return d;
}
function mapRegionLabel(zoom){
  return ['WORLD','CONTINENTAL','REGIONAL','LOCAL','TERRAIN','TILE'][zoom]||'MAP';
}
function distanceTiles(x,y,px,py){
  return Math.abs(wrappedDelta(x,px))+Math.abs(y-py);
}

function mapLabelCandidates(cells){
  const byName=new Map();
  for(let i=0;i<cells.length;i++){
    const c=cells[i],label=c.label;
    if(!label||!label.name)continue;
    const key=label.tier+'|'+label.name;
    if(!byName.has(key))byName.set(key,{...label,index:i,x:c.x,y:c.y});
  }
  return [...byName.values()].slice(0,14);
}
function labelPosition(index,width,height){
  const col=index%width,row=Math.floor(index/width);
  return {left:((col+.5)/width*100),top:((row+.5)/height*100)};
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
    data:null,target:null,preparedGame:null,preparedKey:null,preparedPromise:null,preparedController:null,
    drag:false,moved:false,startX:0,startY:0,startCenterX:0,startCenterY:0
  };
  renderWorldMap.zoom=map.zoom;renderWorldMap.centerX=map.centerX;renderWorldMap.centerY=map.centerY;renderWorldMap.layer=map.layer;

  const fetchMap=async()=>{
    const p=new URLSearchParams({seed:state.seed,x:map.centerX,y:map.centerY,zoom:map.zoom});
    const r=await fetch('/api/world-map?'+p,{cache:'no-store'});if(!r.ok)throw Error('World Map API '+r.status);
    map.data=await r.json();map.centerX=map.data.center.x;map.centerY=map.data.center.y;
    renderWorldMap.centerX=map.centerX;renderWorldMap.centerY=map.centerY;draw();
  };

  const prepareDestination=async target=>{
    if(!target)return;
    const key=state.seed+'|'+target.x+'|'+target.y;
    if(map.preparedKey===key && map.preparedGame)return map.preparedGame;
    map.preparedController?.abort();
    const controller=new AbortController();
    map.preparedController=controller;
    map.preparedKey=key;
    map.preparedGame=null;
    const p=new URLSearchParams({
      seed:state.seed,playerId:state.playerId,x:target.x,y:target.y,preview:'1'
    });
    map.preparedPromise=fetch('/api/game?'+p,{cache:'no-store',signal:controller.signal})
      .then(async r=>{if(!r.ok)throw Error('Destination preview '+r.status);return r.json();})
      .then(snapshot=>{
        if(map.preparedKey===key)map.preparedGame=snapshot;
        return snapshot;
      })
      .catch(error=>{
        if(error.name!=='AbortError')console.warn(error);
        return null;
      });
    return map.preparedPromise;
  };

  const draw=()=>{
    const d=map.data;
    if(!d){
      root.innerHTML=layout('World Map','navigation & exploration','<section class="card"><div class="muted small">Loading world map…</div></section>');
      fetchMap().catch(e=>root.innerHTML=layout('World Map','diagnostic','<section class="card"><div class="muted small">'+esc(e.message)+'</div></section>'));
      return;
    }

    const playerX=wrapX(state.gameX),playerY=capY(state.gameY);
    const scale=d.scale;
    const playerDx=wrappedDelta(playerX,d.center.x);
    const playerDy=playerY-d.center.y;
    const playerVisible=Math.abs(playerDx)<=((d.width-1)/2)*scale && Math.abs(playerDy)<=((d.height-1)/2)*scale;
    const pxPct=50+(playerDx/(d.width*scale))*100;
    const pyPct=50+(playerDy/(d.height*scale))*100;
    const target=map.target;
    const targetDx=target?wrappedDelta(target.x,d.center.x):0;
    const targetDy=target?(target.y-d.center.y):0;
    const targetVisible=!!target && Math.abs(targetDx)<=((d.width-1)/2)*scale && Math.abs(targetDy)<=((d.height-1)/2)*scale;
    const txPct=target?50+(targetDx/(d.width*scale))*100:50;
    const tyPct=target?50+(targetDy/(d.height*scale))*100:50;

    const layerButtons=[['normal','TERRAIN'],['elevation','HEIGHT'],['moisture','MOISTURE'],['temperature','TEMP']];
    let cells='';
    for(let i=0;i<d.cells.length;i++){
      const cell=d.cells[i];
      const terrainInfo=(cell.landform||cell.waterform||cell.surface)?' · '+(cell.landform||'')+' · '+(cell.waterform||'')+(cell.surface?' · '+cell.surface):'';
      cells+='<div class="world-map-cell" data-index="'+i+'" style="background-color:'+layerBaseColor(cell,map.layer)+';background-image:'+layerColor(cell,map.layer)+'" title="X '+cell.x+' · Y '+cell.y+' · '+esc(cell.biome)+' '+esc(terrainInfo)+'"><span class="map-glyph">'+mapGlyph(cell,d.zoom)+'</span></div>';
    }
    const labels=mapLabelCandidates(d.cells);
    const labelMarkup=labels.map(label=>{
      const p=labelPosition(label.index,d.width,d.height);
      return '<div class="map-region-label map-region-'+label.tier+'" style="left:'+p.left.toFixed(2)+'%;top:'+p.top.toFixed(2)+'%" title="'+esc(label.name)+'">'+esc(label.name)+'</div>';
    }).join('');

    const currentTile=(d.zoom>=5&&target&&target.x===playerX&&target.y===playerY)?target:null;
    const targetDistance=target?distanceTiles(target.x,target.y,playerX,playerY):null;
    const targetTravel=target&&targetDistance!=null?(targetDistance===0?'HERE':targetDistance.toLocaleString()+' tiles away'):'';

    root.innerHTML=layout('World Map','navigation & exploration',
      '<section class="card world-map-card">'+
      '<div class="map-head">'+
      '<div><div class="map-kicker">'+mapRegionLabel(map.zoom)+'</div><h2>Explore the world</h2><span>Pan the map, inspect a location, then choose what to do.</span></div>'+
      '<button class="map-tool map-center-button" id="map-center-player">CENTER ON ME</button>'+
      '</div>'+
      '<div class="map-toolbar">'+
      '<div class="map-toolbar-group"><button class="map-tool" id="map-zoom-out">−</button><strong class="map-zoom-label">'+(map.zoom+1)+'/6 · '+formatScale(scale)+'</strong><button class="map-tool" id="map-zoom-in">+</button></div>'+
      '<div class="map-toolbar-group">'+layerButtons.map(x=>'<button class="map-tool '+(map.layer===x[0]?'active':'')+'" data-map-layer="'+x[0]+'">'+x[1]+'</button>').join('')+'</div>'+
      '</div>'+
      '<div id="world-map-viewport" class="world-map-viewport"><div class="world-map-grid">'+cells+'</div><div class="world-map-labels">'+labelMarkup+'</div>'+
      (playerVisible?'<div class="map-player-marker" style="left:'+clamp(pxPct,2,98)+'%;top:'+clamp(pyPct,2,98)+'%"><span>◆</span></div>':'<div class="map-offscreen-note">YOU ARE OFF SCREEN</div>')+
      (targetVisible?'<div class="map-target-marker" style="left:'+clamp(txPct,2,98)+'%;top:'+clamp(tyPct,2,98)+'%"><span>⌖</span></div>':'')+
      '<div class="map-center-cross"></div>'+
      '</div>'+
      '<div class="map-coordinates"><div><span>CENTER</span><strong>X '+d.center.x+' · Y '+d.center.y+'</strong></div><div><span>YOU</span><strong>X '+playerX+' · Y '+playerY+'</strong></div><div><span>SCALE</span><strong>1 cell = '+formatScale(scale)+' tile'+(scale===1?'':'s')+'</strong></div></div>'+
      (target?'<div class="map-target-card">'+
        '<div class="map-target-head"><div><div class="map-kicker">SELECTED DESTINATION</div><strong>X '+target.x+' · Y '+target.y+'</strong></div><button class="map-tool" id="map-clear-target">CLEAR</button></div>'+
        '<div class="target-meta"><span>'+esc(target.biome||'???')+'</span><span>'+esc(target.terrain?.landform||'???')+'</span><span>'+esc(target.terrain?.waterform||'???')+'</span><span class="'+(target.tile?.passable===false?'target-blocked':'')+'">'+(target.tile?.passable===false?'NON-PASSABLE':'PASSABLE / UNKNOWN')+'</span></div>'+
        '<div class="target-stats"><div><span>DISTANCE</span><strong>'+esc(targetTravel)+'</strong></div><div><span>ELEVATION</span><strong>'+Number(target.climate?.elevation??0).toFixed(3)+'</strong></div><div><span>MOISTURE</span><strong>'+Number(target.climate?.moisture??0).toFixed(3)+'</strong></div></div>'+
        '<div class="map-toolbar-group target-actions"><button class="map-tool" id="map-recenter-target">SHOW TARGET</button><button class="map-tool active" id="map-teleport">TELEPORT HERE</button></div>'+
      '</div>':'<div class="map-empty-card"><strong>Tap a location</strong><span>Atlas will inspect the exact tile before you decide whether to teleport.</span></div>')+
      '<div class="map-legend">'+
        '<span><i style="background:#88a944"></i>land</span><span><i style="background:#155fa3"></i>water</span><span><i style="background:#d0ad5a"></i>dry</span><span><i style="background:#e4e9ed"></i>high</span><span><b>◆</b> you</span><span><b>⌖</b> target</span>'+
      '</div>'+
      '<div class="map-help"><b>TIP</b> Zoom in to TILE view for exact terrain. The map is for finding places; the game screen is where you explore them.</div>'+
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
        const z=await r.json();
        map.target={x,y,biome:z.inspection.climate.biome,terrain:z.inspection.terrain,climate:z.inspection.climate,tile:z.inspection.tile||null};
        draw();
        prepareDestination(map.target);
      }catch(err){console.warn(err);}
    };
    v.addEventListener('wheel',e=>{
      e.preventDefault();
      const next=map.zoom+(e.deltaY<0?1:-1);
      const bounded=Math.max(0,Math.min(SCALES.length-1,next));
      if(bounded===map.zoom)return;
      const rect=v.getBoundingClientRect();
      const fx=clamp((e.clientX-rect.left)/rect.width,0,1),fy=clamp((e.clientY-rect.top)/rect.height,0,1);
      const scale=map.data.scale;
      const anchorX=wrapX(map.centerX+Math.round((fx-.5)*25*scale));
      const anchorY=capY(map.centerY+Math.round((fy-.5)*17*scale));
      map.zoom=bounded;renderWorldMap.zoom=bounded;
      const nextScale=SCALES[bounded];
      map.centerX=wrapX(anchorX-Math.round((fx-.5)*25*nextScale));
      map.centerY=capY(anchorY-Math.round((fy-.5)*17*nextScale));
      renderWorldMap.centerX=map.centerX;renderWorldMap.centerY=map.centerY;
      fetchMap().catch(()=>{});
    },{passive:false});
    v.addEventListener('pointerdown',begin);v.addEventListener('pointermove',move);v.addEventListener('pointerup',end);v.addEventListener('pointercancel',end);
    root.querySelector('#map-zoom-out').onclick=()=>{map.zoom=Math.max(0,map.zoom-1);renderWorldMap.zoom=map.zoom;fetchMap().catch(()=>{})};
    root.querySelector('#map-zoom-in').onclick=()=>{map.zoom=Math.min(SCALES.length-1,map.zoom+1);renderWorldMap.zoom=map.zoom;fetchMap().catch(()=>{})};
    root.querySelectorAll('[data-map-layer]').forEach(b=>b.onclick=()=>{map.layer=b.dataset.mapLayer;renderWorldMap.layer=map.layer;draw()});
    root.querySelector('#map-clear-target')?.addEventListener('click',()=>{map.target=null;draw()});
    root.querySelector('#map-center-player')?.addEventListener('click',()=>{map.centerX=playerX;map.centerY=playerY;renderWorldMap.centerX=playerX;renderWorldMap.centerY=playerY;fetchMap().catch(()=>{})});
    root.querySelector('#map-recenter-target')?.addEventListener('click',()=>{if(!map.target)return;map.centerX=map.target.x;map.centerY=map.target.y;renderWorldMap.centerX=map.centerX;renderWorldMap.centerY=map.centerY;fetchMap().catch(()=>{})});
    root.querySelector('#map-teleport')?.addEventListener('click',()=>confirmTeleport(map.target));
  };

  const ensureModal=()=>{
    let modal=document.querySelector('#teleport-modal');
    if(modal)return modal;
    modal=document.createElement('div');modal.id='teleport-modal';modal.className='modal-backdrop';modal.hidden=true;
    modal.innerHTML='<div class="teleport-dialog" role="dialog" aria-modal="true"><div class="modal-kicker">WORLD MAP · DESTINATION</div><h2>Teleport here?</h2><div id="teleport-details" class="teleport-details"></div><div class="modal-actions"><button id="teleport-cancel" class="modal-button secondary">CANCEL</button><button id="teleport-confirm" class="modal-button primary">TELEPORT</button></div></div>';
    document.body.appendChild(modal);return modal;
  };

  const confirmTeleport=async target=>{
    if(!target)return;
    const details=[
      ['X',target.x],['Y',target.y],['Chunk',Math.floor(target.x/16)+','+Math.floor(target.y/16)],
      ['Biome',target.biome],['Landform',target.terrain?.landform||'???'],['Waterform',target.terrain?.waterform||'???'],
      ['Elevation',Number(target.climate?.elevation??0).toFixed(4)],['Moisture',Number(target.climate?.moisture??0).toFixed(4)]
    ];
    const modal=ensureModal(),body=modal.querySelector('#teleport-details');
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
        const z=await r.json();
        let prepared=map.preparedGame;
        if(!prepared && map.preparedKey===state.seed+'|'+target.x+'|'+target.y && map.preparedPromise)prepared=await map.preparedPromise;
        state.gameX=z.player.position.x;state.gameY=z.player.position.y;state.x=state.gameX;state.y=state.gameY;
        close();
        if(onTeleported)await onTeleported(z.player,target,prepared||null);
      }catch(e){ok.disabled=false;ok.textContent='TELEPORT';console.warn(e);}
    };
  };

  draw();
}
