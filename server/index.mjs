import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { makeGameSnapshot, makeObserverSnapshot, makeRealtimeSnapshot } from './observer/snapshot.mjs';
import { movePlayer, inspectPlayer } from './systems-state.mjs';
import { prefetchChunks } from './root/tile.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = path.resolve(__dirname, '../public');
const PORT = Number(process.env.PORT || 4173);

const mime = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png' };

async function sendFile(res, filePath) {
  try {
    const data = await fs.readFile(filePath);
    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, { 'Content-Type': mime[ext] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    res.end(data);
  } catch (error) {
    if (error.code === 'ENOENT') { res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }); res.end('Not found'); return; }
    res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' }); res.end('Server error');
  }
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    if (url.pathname === '/api/realtime') {
      const snapshot=makeRealtimeSnapshot({seed:url.searchParams.get('seed')||'atlas-root',x:Number(url.searchParams.get('x')||0),y:Number(url.searchParams.get('y')||10001500),playerId:url.searchParams.get('playerId')||'local-player'});
      res.writeHead(200,{ 'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','Access-Control-Allow-Origin':'*' });
      res.end(JSON.stringify(snapshot)); return;
    }
    if (url.pathname === '/api/game/move') {
      const result = movePlayer({ playerId: url.searchParams.get('playerId') || 'local-player', seed: url.searchParams.get('seed') || 'atlas-root', x: Number(url.searchParams.get('x') || 0), y: Number(url.searchParams.get('y') || 10001500), direction: url.searchParams.get('direction') || '' });
      res.writeHead(result.result.ok ? 200 : 400, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'Access-Control-Allow-Origin': '*' });
      res.end(JSON.stringify(result));
      if(result.result?.ok){const from=result.result.from,to=result.result.to;const oldChunkX=Math.floor(from.x/16),oldChunkY=Math.floor(from.y/16),newChunkX=Math.floor(to.x/16),newChunkY=Math.floor(to.y/16);if(oldChunkX!==newChunkX||oldChunkY!==newChunkY)setImmediate(()=>prefetchChunks(result.player.seed,newChunkX,newChunkY,1));}
      return;
    }
    if (url.pathname === '/api/game/inspect') {
      const result = inspectPlayer({ playerId: url.searchParams.get('playerId') || 'local-player', seed: url.searchParams.get('seed') || 'atlas-root', x: Number(url.searchParams.get('x') || 0), y: Number(url.searchParams.get('y') || 10001500) });
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'Access-Control-Allow-Origin': '*' });
      res.end(JSON.stringify(result)); return;
    }
    if (url.pathname === '/api/game') {
      const snapshot = makeGameSnapshot({ seed: url.searchParams.get('seed') || 'atlas-root', x: Number(url.searchParams.get('x') || 0), y: Number(url.searchParams.get('y') || 10001500), playerId: url.searchParams.get('playerId') || 'local-player' });
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'Access-Control-Allow-Origin': '*' });
      res.end(JSON.stringify(snapshot)); return;
    }
    if (url.pathname === '/api/observer') {
      const snapshot = makeObserverSnapshot({ seed: url.searchParams.get('seed') || 'atlas-root', x: Number(url.searchParams.get('x') || 0), y: Number(url.searchParams.get('y') || 10001500), playerId: url.searchParams.get('playerId') || 'local-player' });
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'Access-Control-Allow-Origin': '*' });
      res.end(JSON.stringify(snapshot)); return;
    }
    const requested = url.pathname === '/' ? '/observer.html' : url.pathname;
    const normalized = path.normalize(requested).replace(/^([.][.][/\\])+/, '');
    await sendFile(res, path.join(PUBLIC_DIR, normalized));
  } catch {
    res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' }); res.end('Internal error');
  }
});
server.listen(PORT, '0.0.0.0', () => console.log(`Atlas Observer listening on http://localhost:${PORT}`));
