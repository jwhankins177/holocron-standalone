import {createReadStream} from 'node:fs';
import {stat} from 'node:fs/promises';
import {createServer} from 'node:http';
import {extname, resolve, sep} from 'node:path';
import {fileURLToPath} from 'node:url';

const host = '127.0.0.1';
const port = 41731;
const authority = host + ':' + port;
const root = fileURLToPath(new URL('./dist', import.meta.url));
const types = new Map(Object.entries({
  '.html':'text/html; charset=utf-8',
  '.js':'text/javascript; charset=utf-8',
  '.mjs':'text/javascript; charset=utf-8',
  '.css':'text/css; charset=utf-8',
  '.json':'application/json',
  '.webmanifest':'application/manifest+json',
  '.svg':'image/svg+xml',
  '.png':'image/png',
  '.webp':'image/webp',
}));

function fail(response, status, message) {
  response.writeHead(status, {'Content-Type':'text/plain; charset=utf-8'});
  response.end(message);
}

const server = createServer(async (request, response) => {
  if (request.headers.host !== authority) return fail(response, 400, 'Invalid host');
  if (!['GET','HEAD'].includes(request.method)) return fail(response, 405, 'Method unavailable');
  let path;
  try {
    const pathname = decodeURIComponent(new URL(request.url, 'http://' + authority).pathname);
    path = resolve(root, '.' + pathname + (pathname.endsWith('/') ? 'index.html' : ''));
    if (!path.startsWith(root + sep)) return fail(response, 404, 'File unavailable');
  } catch {
    return fail(response, 400, 'Invalid path');
  }
  const type = types.get(extname(path));
  if (!type) return fail(response, 404, 'File unavailable');
  const info = await stat(path).catch(() => null);
  if (!info?.isFile()) return fail(response, 404, 'File unavailable');

  response.writeHead(200, {
    'Content-Type':type,
    'Content-Length':info.size,
    'Cache-Control':extname(path)==='.webp'?'public, max-age=86400':'no-cache',
    'Content-Security-Policy':"default-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'",
    'X-Content-Type-Options':'nosniff',
  });
  if (request.method === 'HEAD') return response.end();
  const stream = createReadStream(path);
  stream.on('error', () => response.destroy());
  response.on('close', () => stream.destroy());
  stream.pipe(response);
});

server.on('error', error => {
  console.error(error.code === 'EADDRINUSE' ? 'Port 41731 is already in use. Open the existing Holocron window or close the other server.' : error.message);
  process.exitCode = 1;
});
server.listen(port, host, () => console.log('Holocron Standalone is ready at http://' + authority + '/'));
