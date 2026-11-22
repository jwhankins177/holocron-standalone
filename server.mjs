import {createReadStream} from 'node:fs';
import {stat} from 'node:fs/promises';
import {createServer} from 'node:http';
import {extname, resolve, sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createCardValueService} from './card-values.mjs';

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

export function createStaticHandler({
  root=fileURLToPath(new URL('./dist',import.meta.url)),
  allowedHosts=new Set((process.env.HOLOCRON_ALLOWED_HOSTS||'127.0.0.1:41731,localhost:41731').split(',').map(value=>value.trim().toLowerCase()).filter(Boolean)),
  cardValue=createCardValueService(),
}={}) {
  const staticRoot=resolve(root);
  return async (request,response) => {
    if (!allowedHosts.has(String(request.headers.host||'').toLowerCase())) return fail(response,400,'Invalid host');
    if (!['GET','HEAD'].includes(request.method)) return fail(response,405,'Method unavailable');
    const url=new URL(request.url,'http://localhost');
    if(url.pathname==='/api/card-value'&&request.method==='GET'){
      const origin=request.headers.origin;
      if(request.headers['x-holocron-request']!=='1'||origin&&origin!==`http://${request.headers.host}`)return fail(response,403,'Forbidden');
      try{
        const value=await cardValue(url.searchParams.get('id'));
        response.writeHead(200,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});
        return response.end(JSON.stringify(value));
      }catch(error){
        response.writeHead(error.status||500,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});
        return response.end(JSON.stringify({message:error.status?error.message:'Unable to retrieve card values.'}));
      }
    }
    let path;
    try {
      const pathname=decodeURIComponent(new URL(request.url,'http://localhost').pathname);
      path=resolve(staticRoot,'.'+pathname+(pathname.endsWith('/')?'index.html':''));
      if (!path.startsWith(staticRoot+sep)) return fail(response,404,'File unavailable');
    } catch {
      return fail(response,400,'Invalid path');
    }
    const type=types.get(extname(path));
    if (!type) return fail(response,404,'File unavailable');
    const info=await stat(path).catch(()=>null);
    if (!info?.isFile()) return fail(response,404,'File unavailable');

    response.writeHead(200,{
      'Content-Type':type,
      'Content-Length':info.size,
      'Cache-Control':extname(path)==='.webp'?'public, max-age=86400':'no-cache',
      'Content-Security-Policy':"default-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' https: data: blob:; connect-src 'self' https: http://localhost:41732 http://127.0.0.1:41732; object-src 'none'; base-uri 'self'; frame-ancestors 'none'",
      'X-Content-Type-Options':'nosniff',
    });
    if (request.method==='HEAD') return response.end();
    const stream=createReadStream(path);
    stream.on('error',()=>response.destroy());
    response.on('close',()=>stream.destroy());
    stream.pipe(response);
  };
}

if (process.argv[1]===fileURLToPath(import.meta.url)) {
  const host='127.0.0.1';
  const port=41731;
  const authority=host+':'+port;
  const server=createServer(createStaticHandler());
  server.on('error',error=>{
    console.error(error.code==='EADDRINUSE'?'Port 41731 is already in use. Open the existing Holocron window or close the other server.':error.message);
    process.exitCode=1;
  });
  server.listen(port,host,()=>console.log('Holocron Standalone is ready at http://'+authority+'/'));
}
