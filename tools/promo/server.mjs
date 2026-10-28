// Dev-only: serves the site plus the promo page, and saves the recorded video.
// Usage: node tools/promo/server.mjs   →  http://localhost:4174/tools/promo/promo.html
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const outDir = path.join(root, 'promo');
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.json': 'application/json' };

http.createServer((req, res) => {
  const url = new URL(req.url, 'http://promo');
  if (req.method === 'POST' && url.pathname === '/save') {
    const name = path.basename(url.searchParams.get('name') || 'promo.webm');
    fs.mkdirSync(outDir, { recursive: true });
    const out = fs.createWriteStream(path.join(outDir, name));
    req.pipe(out).on('finish', () => { res.end('saved promo/' + name); console.log('saved', name); });
    return;
  }
  try {
    let file = path.resolve(root, '.' + decodeURIComponent(url.pathname));
    if (!file.startsWith(root + path.sep)) { res.writeHead(403).end(); return; }
    if (fs.statSync(file).isDirectory()) file = path.join(file, 'index.html');
    res.setHeader('Content-Type', types[path.extname(file)] || 'application/octet-stream');
    fs.createReadStream(file).pipe(res);
  } catch { res.writeHead(404).end('Not found'); }
}).listen(4174, () => console.log('Promo ready on 4174'));
