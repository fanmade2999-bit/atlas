import { renderWorldMap } from './map.js';
import { mountPhaserWorld } from './phaser-world.js';
const siteRoot=document.querySelector('#site'),address=document.querySelector('#address'),refreshButton=document.querySelector('#refresh'),tabs=[...document.querySelectorAll('.tab')];
const state={mode:'observer',site:'overview',seed:'atlas-root',x:0,y:10001500,gameX:0,gameY:10001500,snapshot:null,gameSnapshot:null,playerId:'local-player',vision:'normal',motion:null,realtimeBusy:false,moveBusy:false,boot:{active:true,progress:0,message:'Initializing Atlas world…'}};
const sites={world:renderWorld,map:renderMap,inspector:renderInspector,systems:renderSystems},order=Object.keys(sites);
const esc=v=>String(v).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'","&#039;");
const val=v=>v==null?'<span class="value unknown">???</span>':`<span class="value">${typeof v==='number'?v.toFixed(4):esc(v)}</span>`;
const coord=v=>{const n=Number(v);const a=Math.abs(n);if(a>=1000000)return (n/1000000).toFixed(3)+'M';if(a>=1000)return (n/1000).toFixed(1)+'k';return String(n)};
const slot=(s,id)=>s.slots[id]?.value??null;
function shell(id){state.site=id;if(address)address.textContent=`atlas://${id}`;tabs.forEach(t=>t.classList.toggle('active',t.dataset.site===id));}
function applyScreenMode(m){
  const gameIds=['#game-panel','#game-vision'];
  gameIds.forEach(sel=>{const el=document.querySelector(sel);if(el)el.hidden=m!=='game'});
  const info=document.querySelector('#info-panel');
  if(info)info.hidden=false;
  document.querySelector('#app')?.classList.toggle('game-mode',m==='game');
  document.querySelector('#app-mode-label').textContent=m==='game'?'GAME':'OBSERVER';
}
function mode(m){
  state.mode=m;
  applyScreenMode(m);
  if(address)address.textContent=m==='game'?'atlas://game':`atlas://${state.site}`;
  document.querySelector('#game-panel')?.classList.toggle('game-active',m==='game');
  render();
}
async function snapshot(showLoad=true){if(showLoad)loadProgress(18,'Loading Observer plugs…');const p=new URLSearchParams({seed:state.seed,x:state.x,y:state.y,playerId:state.playerId}),r=await fetch('/api/observer?'+p);if(!r.ok)throw Error('Observer API '+r.status);state.snapshot=await r.json();render();}
let gameRequestSerial=0;
async function game(showLoad=false){
  const requestSerial=++gameRequestSerial;
  const requestedX=state.gameX,requestedY=state.gameY;
  if(showLoad)loadProgress(12,'Preparing world stream…');
  const started=performance.now();
  const p=new URLSearchParams({seed:state.seed,x:requestedX,y:requestedY,playerId:state.playerId});
  if(showLoad)loadProgress(24,'Requesting world snapshot…');
  const r=await fetch('/api/game?'+p,{cache:'no-store'});
  if(!r.ok)throw Error('Game API '+r.status);
  if(showLoad)loadProgress(34,'World response received…');
  const bytesHeader=Number(r.headers.get('x-atlas-game-bytes')||0);
  const serverMs=Number(r.headers.get('x-atlas-game-ms')||0);
  const raw=await r.text();
  if(showLoad)loadProgress(42,'Parsing world snapshot…');
  let parsed;
  try{parsed=JSON.parse(raw)}
  catch(parseError){throw Error('Game snapshot JSON parse failed ('+raw.length+' chars): '+parseError.message)}
  if(requestSerial!==gameRequestSerial||state.gameX!==requestedX||state.gameY!==requestedY)return;
  if(showLoad)loadProgress(60,'World snapshot parsed…');
  state.gameSnapshot=parsed;
  if(showLoad)loadProgress(78,'Building visible tile field…');
  state.gameX=state.gameSnapshot.center.x;
  state.gameY=state.gameSnapshot.center.y;
  state.x=state.gameX;
  state.y=state.gameY;
  if(state.mode==='game')render();
  if(showLoad){
    const elapsed=performance.now()-started;
    if(elapsed<320)await new Promise(resolve=>setTimeout(resolve,320-elapsed));
    finishLoading();
    statusDetails('WORLD READY · '+(bytesHeader?Math.round(bytesHeader/1024)+' KB':'payload ?')+' · server '+(serverMs?serverMs.toFixed(1)+' ms':'?'));
    render();
  }
}
function enterGame(){state.gameX=state.x;state.gameY=state.y;mode('game');if(state.gameSnapshot)render();else game(true).catch(error);}
function enterObserver(){state.x=state.gameX;state.y=state.gameY;mode('observer');snapshot().catch(error)}
function loadProgress(progress,message){state.boot={active:true,progress,message};const el=document.querySelector('#game-status');if(el)el.textContent=message;const board=document.querySelector('#game-board');if(board&&!state.gameSnapshot)board.innerHTML='<div class="world-loading"><div class="loader-icon">◆</div><strong>GENERATING WORLD</strong><span>'+esc(message)+'</span><div class="progress"><i style="width:'+progress+'%"></i></div><small>'+progress+'%</small></div>';}
function finishLoading(){state.boot={active:false,progress:100,message:'World ready'};const el=document.querySelector('#game-status');if(el)el.textContent='WORLD READY';}
function statusDetails(text){const el=document.querySelector('#game-status');if(el)el.textContent=text;}
function error(e){console.error('[Atlas load error]',e);state.boot={active:false,progress:0,message:'Generation error'};const el=document.querySelector('#game-status');if(el)el.textContent='LOAD ERROR';const board=document.querySelector('#game-board');if(board)board.innerHTML='<div class="world-loading load-error"><div class="loader-icon">!</div><strong>WORLD LOAD ERROR</strong><span>'+esc(e?.message||e)+'</span><small>Check the server response, then refresh.</small></div>';siteRoot.innerHTML=`<div class="site-inner"><div class="hero"><div class="eyebrow">diagnostic</div><h1>Observer error</h1></div><div class="card"><p>${esc(e.message)}</p></div></div>`}
function render(){
  if(state.mode==='game'){
    if(state.gameSnapshot)renderGamePanel();
    else if(state.boot.active)loadProgress(state.boot.progress,state.boot.message);
    if(state.snapshot)sites[state.site](state.snapshot);
    return;
  }
  if(state.snapshot)sites[state.site](state.snapshot);
}
function layout(title,eyebrow,body){return`<div class="site-inner"><div class="hero"><div class="eyebrow">${eyebrow}</div><h1>${title}</h1><p class="muted small">Observer shell · data appears when a system plugs in.</p></div>${body}</div>`}
function renderOverview(s){siteRoot.innerHTML=layout('Atlas Observer','Browser shell',`<div class="device-badge"><span>CARTRIDGE 01</span><strong>ROOT ONLINE</strong></div><div class="card-grid"><div class="card"><div class="label">Root</div><div class="value">${esc(s.root.name)}</div><span class="status pass">${s.root.status}</span></div><div class="card"><div class="label">Seed</div>${val(slot(s,'world.seed'))}</div><div class="card"><div class="label">Focus X</div>${val(s.focus.x)}</div><div class="card"><div class="label">Focus Y</div>${val(s.focus.y)}</div><div class="card"><div class="label">Elevation</div>${val(s.focus.elevation)}</div><div class="card"><div class="label">Temperature</div>${val(s.focus.temperature)}</div><div class="card"><div class="label">Moisture</div>${val(s.focus.moisture)}</div><div class="card"><div class="label">Biome</div>${val(slot(s,'terrain.biome'))}</div></div><section class="section"><div class="section-head"><h2>Build pipeline</h2><span class="muted small">root → branches</span></div><div class="branch-list">${s.branches.map(b=>`<div class="branch"><div class="branch-layer">L${b.layer}</div><div class="branch-name">${esc(b.name)}</div><div class="branch-status">${b.status}</div></div>`).join('')}</div></section>`)}
function renderMap(){renderWorldMap({siteRoot,layout,state,onTeleported:async()=>{await game(true);enterGame();}})}
function renderWorld(s){siteRoot.innerHTML=layout('World','playable world status',`<section class="card"><div class="section-head"><h2>Playable world</h2><span class="status pass">LIVE</span></div><div class="card-grid"><div class="card"><div class="label">X</div>${val(s.focus.x)}</div><div class="card"><div class="label">Y</div>${val(s.focus.y)}</div><div class="card"><div class="label">Chunk</div><div class="value">${Math.floor(s.focus.x/16)},${Math.floor(s.focus.y/16)}</div></div><div class="card"><div class="label">Biome</div>${val(slot(s,'terrain.biome'))}</div></div><div class="device-badge" style="margin-top:9px"><span>WORLD MAP</span><strong>SEPARATE NAVIGATION</strong></div><p class="muted small">The World Map is not the playable screen. Use Map to see the big picture, swipe in any direction, tap a destination, review it, and explicitly confirm teleportation.</p></section><section class="section card"><div class="section-head"><h2>World scale</h2><span class="muted small">procedural, lazy-generated</span></div>${[['Width',s.world.width.toLocaleString()+' tiles'],['Height',s.world.height.toLocaleString()+' tiles'],['X wrap',s.world.xWraps?'YES':'NO'],['Y wrap',s.world.yWraps?'YES':'NO'],['Chunk size',s.tile.chunkSize+' × '+s.tile.chunkSize]].map(x=>`<div class="metric-row"><div class="metric-name">${x[0]}</div><div class="metric-value">${x[1]}</div></div>`).join('')}</section><section class="section card"><div class="section-head"><h2>Where am I?</h2><span class="muted small">tile truth</span></div>${[['Biome',slot(s,'terrain.biome')],['Landform',slot(s,'terrain.landform')],['Waterform',slot(s,'terrain.waterform')],['Continent',slot(s,'location.continent')],['Territory',slot(s,'location.territory')],['Region',slot(s,'location.region')],['Tract',slot(s,'location.tract')]].map(x=>`<div class="metric-row"><div class="metric-name">${x[0]}</div><div class="metric-value">${x[1]==null?'???':esc(x[1])}</div></div>`).join('')}</section>`)}
function renderClimate(s){const cells=s.grid.cells.map(c=>`<button class="cell ${c.x===s.focus.x&&c.y===s.focus.y?'selected':''}" style="background:hsl(${Math.round(c.temperature*210)} ${Math.round(45+c.moisture*35)}% ${Math.round(22+c.elevation*48)}%)" data-x="${c.x}" data-y="${c.y}"></button>`).join('');siteRoot.innerHTML=layout('Climate','atlas://climate',`<div class="controls"><div class="field"><label>Seed</label><input id="seed" value="${esc(state.seed)}"></div><div class="field"><label>X</label><input id="x" value="${s.focus.x}"></div><div class="field"><label>Y</label><input id="y" value="${s.focus.y}"></div></div><div class="map-wrap"><div class="map">${cells}</div></div><div class="card-grid section"><div class="card"><div class="label">Elevation</div>${val(s.focus.elevation)}</div><div class="card"><div class="label">Temperature</div>${val(s.focus.temperature)}</div><div class="card"><div class="label">Moisture</div>${val(s.focus.moisture)}</div><div class="card"><div class="label">Biome</div>${val(slot(s,'terrain.biome'))}</div></div>`);['seed','x','y'].forEach(id=>document.querySelector('#'+id).addEventListener('change',()=>{state.seed=document.querySelector('#seed').value||'atlas-root';state.x=Number(document.querySelector('#x').value||0);state.y=Number(document.querySelector('#y').value||0);snapshot().catch(error)}));document.querySelectorAll('.cell').forEach(c=>c.onclick=()=>{state.x=Number(c.dataset.x);state.y=Number(c.dataset.y);snapshot().catch(error)})}
function renderSystems(s){siteRoot.innerHTML=layout('Systems','atlas://systems',`<section class="card"><div class="section-head"><h2>Plugs</h2><span class="muted small">stable observer slots</span></div>${Object.values(s.slots).map(i=>`<div class="metric-row"><div><div class="metric-name">${esc(i.label)}</div><div class="small muted">${esc(i.id)}</div></div><div class="metric-value">${i.value==null?'???':esc(i.value)}</div></div>`).join('')}</section>`)}
function renderInspector(s){siteRoot.innerHTML=layout('Inspector','atlas://inspector',`<section class="card"><div class="section-head"><h2>Root validation</h2><span class="status pass">${s.root.status}</span></div><div class="test-list">${s.root.checks.map(c=>`<div class="test"><div class="test-icon">${c.ok?'✓':'!'}</div><div><div class="metric-name">${esc(c.id)}</div><div class="test-note">${esc(c.note)}</div></div></div>`).join('')}</div></section><section class="section card"><div class="metric-row"><div class="metric-name">X</div><div class="metric-value">${s.focus.x}</div></div><div class="metric-row"><div class="metric-name">Y</div><div class="metric-value">${s.focus.y}</div></div><div class="metric-row"><div class="metric-name">Elevation</div><div class="metric-value">${s.focus.elevation.toFixed(6)}</div></div></section>`)}
let boardResizeObserver=null;
function syncBoardSize(){const wrap=document.querySelector('.game-board-wrap'),board=document.querySelector('#game-board');if(!wrap||!board)return;const cs=getComputedStyle(wrap),padX=parseFloat(cs.paddingLeft)+parseFloat(cs.paddingRight),padY=parseFloat(cs.paddingTop)+parseFloat(cs.paddingBottom),gap=1;const usableW=Math.max(0,wrap.clientWidth-padX-gap*14),usableH=Math.max(0,wrap.clientHeight-padY-gap*10);const tile=Math.max(1,Math.floor(Math.min(usableW/15,usableH/11)));board.style.setProperty('--tile-size',tile+'px');}
function watchBoardSize(){if(boardResizeObserver)boardResizeObserver.disconnect();const wrap=document.querySelector('.game-board-wrap');if(!wrap)return;boardResizeObserver=new ResizeObserver(syncBoardSize);boardResizeObserver.observe(wrap);syncBoardSize();}
function visionColor(t,mode){
  const e=Math.max(0,Math.min(1,Number(t.elevation)||0));
  const m=Math.max(0,Math.min(1,Number(t.moisture)||0));
  const temp=Math.max(0,Math.min(1,Number(t.temperature)||0));
  const water=t.waterform||t.hydrology?.waterform||'None';
  const land=t.landform||'Plains';
  const biome=t.biome||'???';
  const ramp=(value,stops)=>{const s=Math.max(0,Math.min(1,value))*(stops.length-1),i=Math.min(stops.length-2,Math.floor(s)),f=s-i,a=stops[i],b=stops[i+1];return 'rgb('+a.map((v,k)=>Math.round(v+(b[k]-v)*f)).join(',')+')'};
  if(mode==='elevation')return 'linear-gradient(135deg,'+ramp(e,[[28,76,45],[110,150,65],[205,190,100],[150,105,65],[235,235,235]])+','+ramp(Math.min(1,e+.12),[[28,76,45],[110,150,65],[205,190,100],[150,105,65],[235,235,235]])+')';
  if(mode==='temperature')return 'linear-gradient(135deg,'+ramp(temp,[[42,75,170],[55,170,210],[110,205,125],[240,205,70],[235,75,45]])+','+ramp(Math.min(1,temp+.1),[[42,75,170],[55,170,210],[110,205,125],[240,205,70],[235,75,45]])+')';
  if(mode==='moisture')return 'linear-gradient(135deg,'+ramp(m,[[122,92,55],[178,150,78],[105,180,120],[45,150,205],[25,80,170]])+','+ramp(Math.min(1,m+.1),[[122,92,55],[178,150,78],[105,180,120],[45,150,205],[25,80,170]])+')';
  if(mode==='biome'){const colors={'Ocean':'#1769aa','Alpine':'#e8edf2','Highlands':'#9a8060','Tundra':'#9fc5c9','Cold Steppe':'#7f9b8c','Desert':'#d6b35b','Tropical Forest':'#18844b','Wetland':'#3d9278','Grassland':'#8caf45','Temperate Forest':'#3f7f43'};const col=colors[biome]||'#68737d';return 'linear-gradient(135deg,'+col+','+col+'cc)'};
  if(mode==='landform'){const colors={'Ocean':'#1769aa','Coast':'#58a9c8','Plains':'#8eae4d','Hills':'#9b9b4f','Valley':'#628e57','Plateau':'#b08a50','Mountain':'#766b63','Peak':'#e6e9eb'};const col=colors[land]||'#68737d';return 'linear-gradient(135deg,'+col+','+col+'bb)'};
  if(mode==='waterform'){const colors={'None':'#71804b','Ocean':'#155fa3','Shallows':'#4ea8c4','Lake':'#258ac2','River':'#45b8d8','Swamp':'#3d8064'};const col=colors[water]||'#71804b';return 'linear-gradient(135deg,'+col+','+col+'bb)'};
  const normalWater={Ocean:'#155fa3',Shallows:'#4ea8c4',Lake:'#258ac2',River:'#45b8d8',Swamp:'#3d8064'};
  if(normalWater[water])return 'linear-gradient(135deg,'+normalWater[water]+','+normalWater[water]+'aa)';
  const biomeColors={'Alpine':'#e4e9ed','Highlands':'#8d795e','Tundra':'#91b9bb','Cold Steppe':'#7d987e','Desert':'#d0ad5a','Tropical Forest':'#187c48','Wetland':'#3c8c73','Grassland':'#88a944','Temperate Forest':'#397540'};
  const base=biomeColors[biome]||'#65705c';
  const shade=Math.round(38+e*28);
  return 'linear-gradient(135deg,'+base+','+base+Math.min(99,shade)+')';
}
function visionLegend(mode){
  const legends={
    normal:{title:'Normal',text:'world colors',swatches:[['#155fa3','water'],['#88a944','land'],['#e4e9ed','peak snow']]},
    elevation:{title:'Elevation',text:'low → high'},
    temperature:{title:'Temperature',text:'cold → hot'},
    moisture:{title:'Moisture',text:'dry → wet'},
    biome:{title:'Biome',text:'climate biome'},
    landform:{title:'Landform',text:'terrain shape'},
    waterform:{title:'Waterform',text:'hydrology'}
  };
  const l=legends[mode]||legends.normal;
  const ramp={
    elevation:'linear-gradient(90deg,#1c4c2d,#6e9641,#cdbf64,#966941,#ebebeb)',
    temperature:'linear-gradient(90deg,#2a4baa,#37aad2,#6ecf7d,#f0cd46,#eb4b2d)',
    moisture:'linear-gradient(90deg,#7a5c37,#b2964e,#69b478,#2d96cd,#1950aa)'
  }[mode];
  const swatches=l.swatches?'<div class="vision-swatches">'+l.swatches.map(s=>'<span><i style="background:'+s[0]+'"></i>'+s[1]+'</span>').join('')+'</div>':'';
  return '<div class="vision-legend"><div class="vision-legend-title"><b>'+l.title+'</b><span>'+l.text+'</span></div>'+(ramp?'<div class="vision-ramp" style="background:'+ramp+'"></div><div class="vision-ends"><span>LOW</span><span>HIGH</span></div>':'')+swatches+'</div>';
}
function renderVisionControls(){
  const labels={normal:'Normal',elevation:'Elevation',temperature:'Temperature',moisture:'Moisture',biome:'Biome',landform:'Landform',waterform:'Water'};
  return '<div class="vision-box"><div class="vision-head"><div><b>VISION</b><span>Choose what the world shows</span></div><div class="vision-current">'+labels[state.vision]+'</div></div><div class="vision-options">'+Object.entries(labels).map(([id,label])=>'<button class="'+(state.vision===id?'active':'')+'" data-vision="'+id+'">'+label+'</button>').join('')+'</div>'+visionLegend(state.vision)+'</div>';
}
function detailGlyphs(t){return (t.detail?.details||[]).map(d=>'<i class="td td-'+d.type+'" style="left:'+(d.x*100)+'%;top:'+(d.y*100)+'%;--s:'+(d.size*100)+'%"></i>').join('')}
function terrainGlyph(t,mode){
  if(mode!=='normal')return '';
  const water=t.waterform||t.hydrology?.waterform||'None';
  if(water==='Ocean'||water==='Shallows'||water==='Lake'||water==='River')return '<span class="terrain-glyph water">≈</span>';
  if(water==='Swamp')return '<span class="terrain-glyph water">≋</span>';
  if(t.landform==='Peak'||t.landform==='Mountain')return '<span class="terrain-glyph">▲</span>';
  if(t.biome==='Alpine')return '<span class="terrain-glyph">❄</span>';
  if(t.biome==='Desert')return '<span class="terrain-glyph">·</span>';
  if(t.biome==='Tropical Forest'||t.biome==='Temperate Forest'||t.biome==='Wetland')return '<span class="terrain-glyph">♣</span>';
  return '<span class="terrain-glyph">·</span>';
}
function renderGamePanel(){
  const panel=document.querySelector('#game-panel'),board=document.querySelector('#game-board'),stats=document.querySelector('#game-panel-stats'),status=document.querySelector('#game-status'),visionEl=document.querySelector('#game-vision');
  if(!panel||!state.gameSnapshot)return;
  if(!visionEl)throw new Error('Game Vision panel is missing from the handheld screen');
  const g=state.gameSnapshot,modeName=state.vision||'normal';
  board.querySelector('.world-loading')?.remove();
  try{mountPhaserWorld(board,g,modeName)}catch(e){error(e);return}
  status.textContent=g.width+'×'+g.height+' WORLD · '+(modeName==='normal'?'PHASER TERRAIN':'VIEW '+modeName.toUpperCase())+' · CHUNK '+Math.floor(g.center.x/16)+','+Math.floor(g.center.y/16)+' · '+(g.stream?.reused?.length??0)+' cached';
  const inspected=g.player?.lastInspection?.climate;
  const terrain=g.player?.lastInspection?.terrain;
  const inspectText=inspected?'<div class="inspect-hud"><b>'+esc(inspected.biome)+' · '+esc(terrain?.landform||'???')+' · '+esc(terrain?.waterform||'???')+'</b><span>E '+inspected.elevation.toFixed(3)+'</span><span>T '+inspected.temperature.toFixed(3)+'</span><span>M '+inspected.moisture.toFixed(3)+'</span></div>':'';
  stats.innerHTML='<div class="xyz-hud"><span>X '+g.player.position.x+'</span><span>Y '+g.player.position.y+'</span><span>T '+(g.player?.tick??'???')+'</span></div>'+inspectText;
  visionEl.innerHTML=renderVisionControls();
  visionEl.querySelectorAll('[data-vision]').forEach(b=>b.onclick=()=>{state.vision=b.dataset.vision;renderGamePanel()});
}
const MOVE_REPEAT_MS=125;
const INPUT_SOURCES=new Map();
let inputSequence=0;
let movementLoopRunning=false;
let lastMoveIssuedAt=0;

function holdDirection(source,direction){
  if(state.mode!=='game')return;
  const current=INPUT_SOURCES.get(source);
  if(current?.direction===direction)return;
  INPUT_SOURCES.set(source,{direction,sequence:++inputSequence});
  startMovementLoop();
}

function releaseDirection(source){
  INPUT_SOURCES.delete(source);
}

function activeHeldDirection(){
  let active=null;
  for(const [source,value] of INPUT_SOURCES){
    if(!active||value.sequence>active.sequence)active={source,...value};
  }
  return active?.direction||null;
}

function clearHeldDirections(){
  INPUT_SOURCES.clear();
}

function startMovementLoop(){
  if(movementLoopRunning)return;
  movementLoopRunning=true;
  const frame=now=>{
    if(state.mode!=='game'||INPUT_SOURCES.size===0){
      movementLoopRunning=false;
      lastMoveIssuedAt=0;
      return;
    }
    const direction=activeHeldDirection();
    if(direction&&!state.moveBusy&&(lastMoveIssuedAt===0||now-lastMoveIssuedAt>=MOVE_REPEAT_MS)){
      const v={up:[0,-1],down:[0,1],left:[-1,0],right:[1,0]}[direction];
      if(v){
        lastMoveIssuedAt=now;
        move(...v).catch(error);
      }
    }
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
}

async function move(dx,dy){
  if(state.mode!=='game'){enterGame();return}
  if(state.moveBusy)return;
  const direction=dx===1?'right':dx===-1?'left':dy===1?'down':'up';
  state.moveBusy=true;
  try{
    const from={x:state.gameX,y:state.gameY};
    const p=new URLSearchParams({playerId:state.playerId,seed:state.seed,x:state.gameX,y:state.gameY,direction});
    const r=await fetch('/api/game/move?'+p,{cache:'no-store'});
    if(!r.ok)throw Error('Move API '+r.status);
    const z=await r.json();
    const to=z.player.position;
    gameRequestSerial++;
    state.motion={direction,from,to,startedAt:performance.now(),duration:110};
    state.gameX=to.x;state.gameY=to.y;state.x=state.gameX;state.y=state.gameY;
    if(state.gameSnapshot)state.gameSnapshot.player=z.player;
    renderGamePanel();
    game(false).catch(error);
  }finally{
    state.moveBusy=false;
    if(INPUT_SOURCES.size)startMovementLoop();
  }
}
async function inspect(){const p=new URLSearchParams({playerId:state.playerId,seed:state.seed,x:state.gameX,y:state.gameY}),r=await fetch('/api/game/inspect?'+p);if(!r.ok)throw Error('Inspect API '+r.status);const z=await r.json();state.gameSnapshot.player=z.player;render()}
function action(a){
  if(a==='start'||a==='select'){
    if(state.mode==='game')enterObserver();else enterGame();
    return;
  }
  if(a==='a'){
    if(state.mode==='game')inspect().catch(error);
    else render();
    return;
  }
  if(a==='b'){
    if(state.mode==='game')enterObserver();
    return;
  }
}function animateMotion(){}
async function realtime(){if(state.realtimeBusy)return;state.realtimeBusy=true;try{const p=new URLSearchParams({playerId:state.playerId,seed:state.seed,x:state.gameX,y:state.gameY}),r=await fetch('/api/realtime?'+p,{cache:'no-store'});if(!r.ok)throw Error('Realtime API '+r.status);const z=await r.json();if(z.player){const changed=state.gameX!==z.player.position.x||state.gameY!==z.player.position.y;state.gameX=z.player.position.x;state.gameY=z.player.position.y;state.x=state.gameX;state.y=state.gameY;if(state.snapshot){state.snapshot.player=z.player;state.snapshot.focus=z.focus;state.snapshot.grid=z.grid;state.snapshot.location=z.location;state.snapshot.cache=z.cache;state.snapshot.tile=z.tile;state.snapshot.slots=z.slots;state.snapshot.world=z.world}if(state.gameSnapshot){state.gameSnapshot.player=z.player;state.gameSnapshot.center=z.player.position;if(state.mode==='game'&&changed)game(false).catch(error);else if(state.mode==='game')renderGamePanel()}}if(state.mode==='observer'&&state.snapshot&&state.site!=='map')render()}catch(e){console.warn(e)}finally{state.realtimeBusy=false}}

function pressed(g,i){return !!g.buttons?.[i]?.pressed}
function edge(name,value){const was=!!gamepadPrev[name];gamepadPrev[name]=value;return value&&!was}
let gamepadPrev={},lastGamepadId='';
function pollGamepad(){
  const pads=navigator.getGamepads?.()||[];
  const g=[...pads].find(Boolean);
  if(!g){releaseDirection('gamepad');requestAnimationFrame(pollGamepad);return}
  if(g.id!==lastGamepadId){
    lastGamepadId=g.id;
    gamepadPrev={};
    document.querySelector('#app-mode-label').textContent='GAMEPAD CONNECTED';
  }
  const axX=g.axes?.[0]??0,axY=g.axes?.[1]??0;
  const left=pressed(g,14)||axX<-.5,right=pressed(g,15)||axX>.5,up=pressed(g,12)||axY<-.5,down=pressed(g,13)||axY>.5;
  let gamepadDirection=null;
  if(Math.abs(axX)>=Math.abs(axY)&&Math.abs(axX)>=.5)gamepadDirection=axX<0?'left':'right';
  else if(Math.abs(axY)>=.5)gamepadDirection=axY<0?'up':'down';
  else if(left)gamepadDirection='left';
  else if(right)gamepadDirection='right';
  else if(up)gamepadDirection='up';
  else if(down)gamepadDirection='down';
  if(gamepadDirection)holdDirection('gamepad',gamepadDirection);else releaseDirection('gamepad');
  if(edge('start',pressed(g,9)))action('start');
  if(edge('select',pressed(g,8)))action('select');
  requestAnimationFrame(pollGamepad);
}
addEventListener('gamepadconnected',e=>{lastGamepadId=e.gamepad.id;gamepadPrev={};document.querySelector('#app-mode-label').textContent='GAMEPAD CONNECTED'});
addEventListener('gamepaddisconnected',()=>{releaseDirection('gamepad');lastGamepadId='';document.querySelector('#app-mode-label').textContent='GAME + INFO'});
function nav(d){shell(order[(order.indexOf(state.site)+d+order.length)%order.length]);render()}
tabs.forEach(t=>t.onclick=()=>{shell(t.dataset.site);if(state.snapshot||state.gameSnapshot)render();});
document.querySelectorAll('[data-action="start"],[data-action="select"],[data-action="a"],[data-action="b"]').forEach(b=>b.onclick=()=>action(b.dataset.action));
document.querySelectorAll('[data-direction]').forEach(b=>{
  const direction=b.dataset.direction;
  const source='dpad:'+direction;
  b.addEventListener('pointerdown',e=>{
    e.preventDefault();
    try{b.setPointerCapture?.(e.pointerId)}catch{}
    holdDirection(source,direction);
  });
  const release=()=>releaseDirection(source);
  b.addEventListener('pointerup',release);
  b.addEventListener('pointercancel',release);
  b.addEventListener('lostpointercapture',release);
});

const keyDirections={ArrowUp:'up',ArrowDown:'down',ArrowLeft:'left',ArrowRight:'right'};
document.onkeydown=e=>{
  const d=keyDirections[e.key];
  if(d){
    e.preventDefault();
    if(!e.repeat)holdDirection('key:'+e.key,d);
    return;
  }
  if(e.key==='Enter'){e.preventDefault();action('a')}
  else if(e.key==='Escape'){e.preventDefault();action('b')}
  else if(e.key==='Tab'){e.preventDefault();action('start')}
};
document.onkeyup=e=>{
  const d=keyDirections[e.key];
  if(d){e.preventDefault();releaseDirection('key:'+e.key)}
};
addEventListener('blur',clearHeldDirections);
document.addEventListener('visibilitychange',()=>{if(document.hidden)clearHeldDirections()});
if(refreshButton)refreshButton.onclick=()=>Promise.all([snapshot(),game()]).catch(error);
shell('world');
const initialMode=new URLSearchParams(location.search).get('app')==='observer'?'observer':'game';
applyScreenMode(initialMode);
mode(initialMode);
Promise.all([snapshot(false),initialMode==='game'?game(true):Promise.resolve()]).catch(error);
pollGamepad();
setInterval(realtime,500);
