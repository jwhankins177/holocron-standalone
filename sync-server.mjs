import {createHash, randomBytes, scryptSync, timingSafeEqual} from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';
import {readFile} from 'node:fs/promises';
import {createServer} from 'node:http';
import {fileURLToPath} from 'node:url';

const defaultCatalog = fileURLToPath(new URL('./public/catalog.json', import.meta.url));
const tokenLifetime = 30 * 24 * 60 * 60 * 1000;
const bodyLimit = 5 * 1024 * 1024;
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const digest = value => createHash('sha256').update(value).digest('hex');
const json = (response, status, value, headers={}) => {
  response.writeHead(status, {'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store',...headers});
  response.end(JSON.stringify(value));
};

function readBody(request) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    request.on('data', chunk => {
      size += chunk.length;
      if (size > bodyLimit) {
        request.removeAllListeners('data');
        request.resume();
        reject(Object.assign(Error('Request body exceeds 5 MB.'), {status:413}));
        return;
      }
      chunks.push(chunk);
    });
    request.on('end', () => {
      try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8'))); }
      catch { reject(Object.assign(Error('Request body must be valid JSON.'), {status:400})); }
    });
    request.on('error', reject);
  });
}

function validateWorkspace(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value) ||
      !Array.isArray(value.collection) || !Array.isArray(value.decks) ||
      value.collection.length > 30000 || value.decks.length > 500) {
    throw Object.assign(Error('Workspace data is invalid.'), {status:400});
  }
  return value;
}

export function createSyncServer({
  databasePath = process.env.HOLOCRON_SYNC_DATABASE || './holocron-sync.sqlite',
  catalogPath = process.env.HOLOCRON_SYNC_CATALOG || defaultCatalog,
  allowedOrigins = (process.env.HOLOCRON_ALLOWED_ORIGINS || 'http://127.0.0.1:41731,http://localhost:41731').split(',').map(value=>value.trim()).filter(Boolean),
  database = new DatabaseSync(databasePath),
}={}) {
  database.exec(`
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY,
      email TEXT NOT NULL UNIQUE COLLATE NOCASE,
      salt TEXT NOT NULL,
      password_hash TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS sessions (
      token_hash TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      expires_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS workspaces (
      user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      revision INTEGER NOT NULL,
      updated_at TEXT NOT NULL,
      data TEXT NOT NULL
    );
  `);
  database.exec('PRAGMA foreign_keys = ON');
  const rateLimits = new Map();
  const clientAddress = request => {
    const forwarded = process.env.HOLOCRON_TRUST_PROXY==='true'
      ? String(request.headers['x-forwarded-for']||'').split(',')[0].trim()
      : '';
    return forwarded||request.socket.remoteAddress||'unknown';
  };
  const limited = (key, now=Date.now()) => {
    const recent = (rateLimits.get(key)||[]).filter(at=>now-at<10*60*1000);
    if (recent.length >= 10) return false;
    recent.push(now);
    rateLimits.set(key,recent);
    if (rateLimits.size > 2000) {
      for (const [entry,times] of rateLimits) if (times.every(at=>now-at>=10*60*1000)) rateLimits.delete(entry);
    }
    return true;
  };
  const authorize = request => {
    const token = request.headers.authorization?.match(/^Bearer ([A-Za-z0-9_-]{40,})$/)?.[1];
    if (!token) return null;
    const session = database.prepare('SELECT users.id, users.email, sessions.expires_at FROM sessions JOIN users ON users.id=sessions.user_id WHERE sessions.token_hash=?').get(digest(token));
    if (!session || session.expires_at <= Date.now()) return null;
    return {id:session.id,email:session.email};
  };
  const handleRequest = async (request,response) => {
    const origin = request.headers.origin;
    if (origin && allowedOrigins.length && !allowedOrigins.includes(origin)) return json(response,403,{error:'origin_not_allowed'});
    const cors = origin ? {
      'Access-Control-Allow-Origin':origin,
      'Vary':'Origin',
      'Access-Control-Allow-Methods':'GET,POST,PUT,OPTIONS',
      'Access-Control-Allow-Headers':'Authorization,Content-Type,If-None-Match',
      'Access-Control-Max-Age':'600',
    } : {};
    if (request.method==='OPTIONS') {
      response.writeHead(204,cors);
      return response.end();
    }
    const pathname = new URL(request.url,'http://localhost').pathname;
    try {
      if (pathname==='/api/catalog' && request.method==='GET') {
        const content = await readFile(catalogPath);
        const catalog = JSON.parse(content);
        if (!Array.isArray(catalog.cards) || !Array.isArray(catalog.sets) || typeof catalog.updated!=='string') {
          throw Error('Configured catalog has an invalid shape.');
        }
        const etag='"'+digest(content)+'"';
        if (request.headers['if-none-match']===etag) {
          response.writeHead(304,{...cors,ETag:etag,'Cache-Control':'no-cache'});
          return response.end();
        }
        return json(response,200,catalog,{...cors,ETag:etag,'Cache-Control':'no-cache'});
      }
      if (pathname==='/api/auth/register' && request.method==='POST') {
        if (!limited('register:'+clientAddress(request))) return json(response,429,{error:'rate_limited'},cors);
        const body = await readBody(request);
        const email = typeof body.email==='string' ? body.email.trim().toLowerCase() : '';
        const password = body.password;
        if (!emailPattern.test(email) || email.length>254 || typeof password!=='string' || password.length<12 || password.length>256) {
          return json(response,400,{error:'invalid_credentials',message:'Use a valid email address and a password of 12–256 characters.'},cors);
        }
        const salt = randomBytes(16).toString('hex');
        const hash = scryptSync(password,salt,64).toString('hex');
        let result;
        try { result=database.prepare('INSERT INTO users(email,salt,password_hash) VALUES(?,?,?)').run(email,salt,hash); }
        catch(error) {
          if (error.errcode===2067) return json(response,409,{error:'account_exists'},cors);
          throw error;
        }
        const user={id:Number(result.lastInsertRowid),email};
        return json(response,201,{token:createSession(user.id),user},cors);
      }
      if (pathname==='/api/auth/login' && request.method==='POST') {
        if (!limited('login:'+clientAddress(request))) return json(response,429,{error:'rate_limited'},cors);
        const body=await readBody(request);
        const email=typeof body.email==='string'?body.email.trim().toLowerCase():'';
        const password=typeof body.password==='string'?body.password:'';
        if (email.length>254||password.length>256) return json(response,401,{error:'invalid_credentials'},cors);
        const user=database.prepare('SELECT id,email,salt,password_hash FROM users WHERE email=?').get(email);
        const salt=user?.salt||'holocron-invalid-login-salt';
        const actual=scryptSync(password,salt,64);
        const expected=Buffer.from(user?.password_hash||'0'.repeat(128),'hex');
        if (!user || !timingSafeEqual(actual,expected)) return json(response,401,{error:'invalid_credentials'},cors);
        return json(response,200,{token:createSession(user.id),user:{id:user.id,email:user.email}},cors);
      }
      const user=authorize(request);
      if (pathname.startsWith('/api/workspace') && !user) return json(response,401,{error:'unauthorized'},cors);
      if (pathname==='/api/auth/logout' && request.method==='POST') {
        if (!user) return json(response,401,{error:'unauthorized'},cors);
        const token=request.headers.authorization?.slice(7);
        if (token) database.prepare('DELETE FROM sessions WHERE token_hash=?').run(digest(token));
        return json(response,200,{ok:true},cors);
      }
      if (pathname==='/api/workspace' && request.method==='GET') {
        const workspace=database.prepare('SELECT revision,updated_at,data FROM workspaces WHERE user_id=?').get(user.id);
        if (!workspace) return json(response,404,{error:'workspace_not_found'},cors);
        return json(response,200,{revision:workspace.revision,updatedAt:workspace.updated_at,data:JSON.parse(workspace.data)},cors);
      }
      if (pathname==='/api/workspace' && request.method==='PUT') {
        const body=await readBody(request);
        if (!Number.isSafeInteger(body.expectedRevision)||body.expectedRevision<0) return json(response,400,{error:'invalid_revision'},cors);
        let data;
        try { data=validateWorkspace(body.data); }
        catch(error) { return json(response,error.status||400,{error:'invalid_workspace',message:error.message},cors); }
        const current=database.prepare('SELECT revision FROM workspaces WHERE user_id=?').get(user.id);
        const revision=current?.revision||0;
        if (body.expectedRevision!==revision) return json(response,409,{error:'revision_conflict',revision},cors);
        const nextRevision=revision+1,updatedAt=new Date().toISOString();
        database.prepare(`INSERT INTO workspaces(user_id,revision,updated_at,data) VALUES(?,?,?,?)
          ON CONFLICT(user_id) DO UPDATE SET revision=excluded.revision,updated_at=excluded.updated_at,data=excluded.data`)
          .run(user.id,nextRevision,updatedAt,JSON.stringify(data));
        return json(response,200,{revision:nextRevision,updatedAt},cors);
      }
      return json(response,404,{error:'not_found'},cors);
    } catch(error) {
      if (!response.headersSent) json(response,error.status||500,{error:error.status===400?'invalid_request':'server_error',message:error.status?error.message:'The sync server encountered an error.'},cors);
      else response.destroy();
      if (!error.status) console.error(error);
    }
  };
  const server=createServer(handleRequest);

  function createSession(userId) {
    database.prepare('DELETE FROM sessions WHERE expires_at<=?').run(Date.now());
    const token=randomBytes(32).toString('base64url');
    database.prepare('INSERT INTO sessions(token_hash,user_id,expires_at) VALUES(?,?,?)')
      .run(digest(token),userId,Date.now()+tokenLifetime);
    return token;
  }
  return {server,database,handleRequest};
}

if (process.argv[1]===fileURLToPath(import.meta.url)) {
  const {server}=createSyncServer();
  const port=Number(process.env.HOLOCRON_SYNC_PORT||41732);
  const host=process.env.HOLOCRON_SYNC_HOST||'127.0.0.1';
  server.on('error',error=>{
    console.error(error.message);
    process.exitCode=1;
  });
  server.listen(port,host,()=>console.log(`Holocron sync API listening on ${host}:${port}`));
}
