// Sunset Streets — tiny dev server. Serves game/ as static files on
// port 8080, so the game opens at http://localhost:8080.
// Node 22, standard library only.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { dirname, extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), 'game');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
};

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url ?? '/', 'http://localhost:8080');
    let path = normalize(join(root, decodeURIComponent(url.pathname)));
    if (!path.startsWith(root)) {
      res.writeHead(403);
      res.end('forbidden');
      return;
    }
    if (path.endsWith('/')) path = join(path, 'index.html');
    const data = await readFile(path);
    res.writeHead(200, { 'content-type': MIME[extname(path)] ?? 'application/octet-stream' });
    res.end(data);
  } catch {
    res.writeHead(404);
    res.end('not found');
  }
});

server.listen(8080, () => {
  console.log('Sunset Streets dev server: http://localhost:8080');
});
