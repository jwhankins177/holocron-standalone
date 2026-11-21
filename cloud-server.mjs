import {createServer} from 'node:http';
import {fileURLToPath} from 'node:url';
import {createStaticHandler} from './server.mjs';
import {createSyncServer} from './sync-server.mjs';

const port=Number(process.env.PORT||41731);
const railwayDomain=process.env.RAILWAY_PUBLIC_DOMAIN;
const allowedHosts=new Set((process.env.HOLOCRON_ALLOWED_HOSTS||[railwayDomain,'localhost:'+port,'127.0.0.1:'+port].filter(Boolean).join(','))
  .split(',').map(value=>value.trim().toLowerCase()).filter(Boolean));
const allowedOrigins=(process.env.HOLOCRON_ALLOWED_ORIGINS||[
  railwayDomain?'https://'+railwayDomain:'',
  'http://localhost:'+port,
  'http://127.0.0.1:'+port,
].filter(Boolean).join(',')).split(',').map(value=>value.trim()).filter(Boolean);

export function createCloudServer({
  databasePath=process.env.HOLOCRON_SYNC_DATABASE||'./holocron-sync.sqlite',
  registrationCode=process.env.HOLOCRON_REGISTRATION_CODE||'',
  catalogPath,
  database,
  root=fileURLToPath(new URL('./dist',import.meta.url)),
  hosts=allowedHosts,
  origins=allowedOrigins,
}={}) {
  const sync=createSyncServer({databasePath,catalogPath,database,registrationCode,allowedOrigins:origins});
  const staticHandler=createStaticHandler({root,allowedHosts:hosts});
  const server=createServer((request,response)=>{
    const pathname=new URL(request.url,'http://localhost').pathname;
    if (pathname==='/healthz'&&request.method==='GET') {
      response.writeHead(200,{'Content-Type':'text/plain; charset=utf-8','Cache-Control':'no-store'});
      response.end('ok');
      return;
    }
    const host=String(request.headers.host||'').toLowerCase();
    if (!hosts.has(host)) {
      response.writeHead(400,{'Content-Type':'text/plain; charset=utf-8'});
      response.end('Invalid host');
      return;
    }
    if (pathname.startsWith('/api/')) {
      void sync.handleRequest(request,response);
      return;
    }
    void staticHandler(request,response);
  });
  return {server,database:sync.database};
}

if (process.argv[1]===fileURLToPath(import.meta.url)) {
  const {server}=createCloudServer();
  server.on('error',error=>{
    console.error(error.message);
    process.exitCode=1;
  });
  server.listen(port,'0.0.0.0',()=>console.log('Holocron Standalone is ready on port '+port));
}
