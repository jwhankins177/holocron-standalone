import {createHash, randomBytes, randomInt, scrypt as scryptCallback, timingSafeEqual} from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';
import {readFile} from 'node:fs/promises';
import {createServer} from 'node:http';
import {promisify} from 'node:util';
import {fileURLToPath} from 'node:url';
import {createCardValueService} from './card-values.mjs';

const defaultCatalog = fileURLToPath(new URL('./public/catalog.json', import.meta.url));
const tokenLifetime = 30 * 24 * 60 * 60 * 1000;
const pairingCodeLifetime = 10 * 60 * 1000;
const bodyLimit = 5 * 1024 * 1024;
const digest = value => createHash('sha256').update(value).digest('hex');
const scrypt = promisify(scryptCallback);
const dummyPasswordSalt = Buffer.alloc(16,0x53);
const json = (response, status, value, headers={}) => {
  response.writeHead(status, {'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store',...headers});
  response.end(JSON.stringify(value));
};

function catalogCardId(set,number) {
  const value=String(number);
  return `${set}_${/^\d+$/.test(value)?value.padStart(3,'0'):value}`;
}

function titleCase(value) {
  return String(value||'').toLowerCase().replace(/\b[a-z]/g,letter=>letter.toUpperCase());
}

function nullableNumber(value) {
  if (value===undefined||value===null||value==='') return null;
  const number=Number(value);
  return Number.isFinite(number)?number:null;
}

function makePairingCode() {
  return String(randomInt(0,100_000_000)).padStart(8,'0');
}

function normalizePairingCode(value) {
  if (typeof value!=='string'||value.length>16) return null;
  const code=value.replace(/[\s-]/g,'');
  return /^\d{8}$/.test(code)?code:null;
}

function normalizeLegacyAccessCode(value) {
  if (typeof value!=='string'||value.length>64) return null;
  const code=value.toUpperCase().replace(/[\s-]/g,'');
  return /^[A-F0-9]{32}$/.test(code)?code:null;
}

function normalizeUsername(value) {
  if(typeof value!=='string'||value.length>64)return null;
  const username=value.trim().toLowerCase();
  return /^[a-z0-9][a-z0-9._-]{2,31}$/.test(username)?username:null;
}

function validPassword(value) {
  return typeof value==='string'&&value.length>=8&&value.length<=128;
}

async function hashPassword(password,salt) {
  const result=await scrypt(password,salt,32,{N:16384,r:8,p:1,maxmem:64*1024*1024});
  return Buffer.from(result).toString('hex');
}

function updateCatalog(catalog,upstreamCards,upstreamSets,updated) {
  if (!Array.isArray(upstreamCards)||upstreamCards.length===0||upstreamCards.length>30000||
      !Array.isArray(upstreamSets)||upstreamSets.length>500) {
    throw Object.assign(Error('SWU-DB returned an invalid card catalog.'),{status:502});
  }
  const cardsById=new Map();
  for (const source of upstreamCards) {
    if (typeof source.Set!=='string'||typeof source.Number!=='string'&&typeof source.Number!=='number'||
        typeof source.Name!=='string'||typeof source.Type!=='string') {
      throw Object.assign(Error('SWU-DB returned an invalid card catalog.'),{status:502});
    }
    const id=catalogCardId(source.Set,source.Number);
    if (cardsById.has(id)) throw Object.assign(Error('SWU-DB returned duplicate card IDs.'),{status:502});
    const text=source.FrontText||'';
    const card={
      id,name:source.Name,subtitle:source.Subtitle||'',type:source.Type,set:source.Set,number:String(source.Number),
      aspects:Array.isArray(source.Aspects)?source.Aspects:[],
      traits:Array.isArray(source.Traits)?source.Traits.map(titleCase):[],
      keywords:Array.isArray(source.Keywords)?source.Keywords.map(titleCase):[],
      cost:nullableNumber(source.Cost),power:nullableNumber(source.Power),hp:nullableNumber(source.HP),
      arena:Array.isArray(source.Arenas)?source.Arenas.join(', '):'',rarity:source.Rarity||'',artist:source.Artist||'',
      variant:'Normal',image:source.FrontArt||'',back:source.BackArt||'',text,backText:source.BackText||'',
      epic:source.EpicAction||'',unique:source.Unique===true,core:`${source.Name}|${source.Subtitle||''}|${source.Type}`,
      canonical:id,foilOnly:false,
    };
    cardsById.set(id,card);
  }
  const cards=catalog.cards.map(card=>{
    const source=cardsById.get(card.canonical);
    if (!source) return card;
    return {...source,id:card.id,number:card.number,variant:card.variant,image:card.image||source.image,
      back:card.back||source.back,foilOnly:card.foilOnly===true};
  });
  const knownIds=new Set(cards.map(card=>card.id));
  for (const [id,card] of cardsById) if (!knownIds.has(id)) cards.push(card);
  const sets=new Map(catalog.sets.map(set=>[set.code,set]));
  for (const source of upstreamSets) {
    if (typeof source.setId!=='string'||typeof source.fullName!=='string') {
      throw Object.assign(Error('SWU-DB returned an invalid set catalog.'),{status:502});
    }
    sets.set(source.setId,{code:source.setId,name:source.fullName});
  }
  return {...catalog,cards,sets:[...sets.values()],updated};
}

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
  registrationCode = process.env.HOLOCRON_REGISTRATION_CODE || '',
  allowedOrigins = (process.env.HOLOCRON_ALLOWED_ORIGINS || 'http://127.0.0.1:41731,http://localhost:41731').split(',').map(value=>value.trim()).filter(Boolean),
  database = new DatabaseSync(databasePath),
  fetchImpl = globalThis.fetch,
  cardValue = createCardValueService({catalogPath,fetchImpl}),
}={}) {
  const registrationCodeHash=typeof registrationCode==='string'&&registrationCode.trim()
    ?Buffer.from(digest(registrationCode.trim()),'hex')
    :null;
  database.exec(`
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY,
      access_code_hash TEXT UNIQUE
    );
    CREATE TABLE IF NOT EXISTS sessions (
      token_hash TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      expires_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS pairing_codes (
      code_hash TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      expires_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS pairing_codes_expiry ON pairing_codes(expires_at);
    CREATE TABLE IF NOT EXISTS workspaces (
      user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      revision INTEGER NOT NULL,
      updated_at TEXT NOT NULL,
      data TEXT NOT NULL
    );
  `);
  database.exec('PRAGMA foreign_keys = ON');
  const userColumns=database.prepare('PRAGMA table_info(users)').all();
  if (!userColumns.some(column=>column.name==='access_code_hash')) {
    database.exec('PRAGMA foreign_keys = OFF');
    try {
      database.exec(`BEGIN IMMEDIATE;
        CREATE TABLE users_code_migration (id INTEGER PRIMARY KEY,access_code_hash TEXT UNIQUE);
        INSERT INTO users_code_migration(id) SELECT id FROM users;
        DELETE FROM sessions;
        DROP TABLE users;
        ALTER TABLE users_code_migration RENAME TO users;
        COMMIT;`);
    } catch(error) {
      database.exec('ROLLBACK');
      throw error;
    } finally {
      database.exec('PRAGMA foreign_keys = ON');
    }
  }
  const migratedUserColumns=database.prepare('PRAGMA table_info(users)').all();
  if(!migratedUserColumns.some(column=>column.name==='username'))database.exec('ALTER TABLE users ADD COLUMN username TEXT');
  if(!migratedUserColumns.some(column=>column.name==='password_salt'))database.exec('ALTER TABLE users ADD COLUMN password_salt TEXT');
  if(!migratedUserColumns.some(column=>column.name==='password_hash'))database.exec('ALTER TABLE users ADD COLUMN password_hash TEXT');
  database.exec('CREATE UNIQUE INDEX IF NOT EXISTS users_username_unique ON users(username COLLATE NOCASE) WHERE username IS NOT NULL');
  const rateLimits = new Map();
  const clientAddress = request => {
    const forwarded = process.env.HOLOCRON_TRUST_PROXY==='true'
      ? String(request.headers['x-forwarded-for']||'').split(',')[0].trim()
      : '';
    return forwarded||request.socket.remoteAddress||'unknown';
  };
  const limited = (key, now=Date.now(),max=10) => {
    const recent = (rateLimits.get(key)||[]).filter(at=>now-at<10*60*1000);
    if (recent.length >= max) return false;
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
    const session = database.prepare('SELECT users.id, sessions.expires_at FROM sessions JOIN users ON users.id=sessions.user_id WHERE sessions.token_hash=?').get(digest(token));
    if (!session || session.expires_at <= Date.now()) return null;
    return {id:session.id};
  };
  const hasValidRegistrationCode=value=>{
    if(!registrationCodeHash||typeof value!=='string'||value.length>256)return false;
    return timingSafeEqual(registrationCodeHash,Buffer.from(digest(value.trim()),'hex'));
  };
  const handleRequest = async (request,response) => {
    const origin = request.headers.origin;
    if (origin && !allowedOrigins.includes(origin)) return json(response,403,{error:'origin_not_allowed'});
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
      if (pathname==='/api/catalog/refresh' && request.method==='POST') {
        if (!limited('catalog-refresh:'+clientAddress(request))) return json(response,429,{error:'rate_limited',message:'Please wait before refreshing the card catalog again.'},cors);
        const catalog=JSON.parse(await readFile(catalogPath,'utf8'));
        const [cardsResponse,setsResponse]=await Promise.all([
          fetchImpl('https://api.swu-db.com/cards/search?q=*',{signal:AbortSignal.timeout(30000)}),
          fetchImpl('https://api.swu-db.com/sets',{signal:AbortSignal.timeout(30000)}),
        ]);
        if (!cardsResponse.ok||!setsResponse.ok) throw Object.assign(Error('SWU-DB could not be reached. Try again later.'),{status:502});
        const cardsPayload=await cardsResponse.json(),setsPayload=await setsResponse.json();
        const refreshed=updateCatalog(catalog,cardsPayload.data,setsPayload,new Date().toISOString());
        return json(response,200,refreshed,cors);
      }
      if (pathname==='/api/auth/register' && request.method==='POST') {
        if (!limited('register:'+clientAddress(request))) return json(response,429,{error:'rate_limited'},cors);
        if(!registrationCodeHash)return json(response,503,{error:'registration_disabled',message:'Account creation is not enabled. Contact the app owner.'},cors);
        const body=await readBody(request);
        if(!body||typeof body!=='object'||Array.isArray(body))return json(response,400,{error:'invalid_credentials',message:'Enter a username, password, and invite code.'},cors);
        if(!hasValidRegistrationCode(body.inviteCode))return json(response,403,{error:'invalid_invite_code',message:'That invite code is invalid.'},cors);
        const username=normalizeUsername(body.username);
        if(!username)return json(response,400,{error:'invalid_username',message:'Use 3–32 letters, numbers, periods, underscores, or hyphens; start with a letter or number.'},cors);
        if(!validPassword(body.password))return json(response,400,{error:'invalid_password',message:'Use a password between 8 and 128 characters.'},cors);
        const passwordSalt=randomBytes(16).toString('hex');
        const passwordHash=await hashPassword(body.password,Buffer.from(passwordSalt,'hex'));
        let result;
        try{
          result=database.prepare('INSERT INTO users(access_code_hash,username,password_salt,password_hash) VALUES(NULL,?,?,?)').run(username,passwordSalt,passwordHash);
        }catch(error){
          if(database.prepare('SELECT 1 FROM users WHERE username=? COLLATE NOCASE').get(username))return json(response,409,{error:'username_taken',message:'That username is already in use.'},cors);
          throw error;
        }
        const user={id:Number(result.lastInsertRowid)};
        return json(response,201,{token:createSession(user.id),user},cors);
      }
      if (pathname==='/api/auth/login' && request.method==='POST') {
        if (!limited('login:'+clientAddress(request))) return json(response,429,{error:'rate_limited'},cors);
        if (!limited('pair-login-global',Date.now(),1000)) return json(response,429,{error:'rate_limited',message:'Too many pairing attempts. Try again later.'},cors);
        const body=await readBody(request);
        if(!body||typeof body!=='object'||Array.isArray(body))return json(response,400,{error:'invalid_credentials',message:'Enter a username and password.'},cors);
        const code=normalizePairingCode(body.code);
        if (code) {
          const codeHash=digest(code),now=Date.now();
          database.prepare('DELETE FROM pairing_codes WHERE expires_at<=?').run(now);
          const pairing=database.prepare('DELETE FROM pairing_codes WHERE code_hash=? AND expires_at>? RETURNING user_id').get(codeHash,now);
          if (pairing) {
            return json(response,200,{token:createSession(pairing.user_id),user:{id:pairing.user_id}},cors);
          }
        }
        const legacyCode=normalizeLegacyAccessCode(body.code);
        if (legacyCode) {
          const user=database.prepare('UPDATE users SET access_code_hash=NULL WHERE access_code_hash=? RETURNING id').get(digest(legacyCode));
          if (user) {
            return json(response,200,{token:createSession(user.id),user:{id:user.id},legacyCodeUsed:true},cors);
          }
        }
        const username=normalizeUsername(body.username);
        const password=typeof body.password==='string'&&body.password.length<=128?body.password:'';
        const account=username?database.prepare('SELECT id,password_salt,password_hash FROM users WHERE username=? COLLATE NOCASE').get(username):null;
        const salt=account?.password_salt?Buffer.from(account.password_salt,'hex'):dummyPasswordSalt;
        const passwordHash=await hashPassword(password,salt);
        const storedHash=account?.password_hash;
        const hashMatches=typeof storedHash==='string'&&/^[a-f0-9]{64}$/.test(storedHash)&&
          timingSafeEqual(Buffer.from(passwordHash,'hex'),Buffer.from(storedHash,'hex'));
        if(account&&hashMatches)return json(response,200,{token:createSession(account.id),user:{id:account.id}},cors);
        return json(response,401,{error:'invalid_credentials',message:'Username or password is incorrect.'},cors);
      }
      const user=authorize(request);
      if(pathname==='/api/card-value'&&request.method==='GET'){
        if(!user)return json(response,401,{error:'unauthorized'},cors);
        const id=new URL(request.url,'http://localhost').searchParams.get('id');
        return json(response,200,await cardValue(id),cors);
      }
      if(pathname==='/api/auth/account'&&request.method==='GET'){
        if(!user)return json(response,401,{error:'unauthorized'},cors);
        const account=database.prepare('SELECT username FROM users WHERE id=?').get(user.id);
        return json(response,200,{username:account?.username||null},cors);
      }
      if(pathname==='/api/auth/credentials'&&request.method==='POST'){
        if(!user)return json(response,401,{error:'unauthorized'},cors);
        if(!registrationCodeHash)return json(response,503,{error:'registration_disabled',message:'Account creation is not enabled. Contact the app owner.'},cors);
        const body=await readBody(request);
        if(!body||typeof body!=='object'||Array.isArray(body))return json(response,400,{error:'invalid_credentials',message:'Enter a username and password.'},cors);
        if(!hasValidRegistrationCode(body.inviteCode))return json(response,403,{error:'invalid_invite_code',message:'That invite code is invalid.'},cors);
        const username=normalizeUsername(body.username);
        if(!username)return json(response,400,{error:'invalid_username',message:'Use 3–32 letters, numbers, periods, underscores, or hyphens; start with a letter or number.'},cors);
        if(!validPassword(body.password))return json(response,400,{error:'invalid_password',message:'Use a password between 8 and 128 characters.'},cors);
        const account=database.prepare('SELECT username FROM users WHERE id=?').get(user.id);
        if(account?.username)return json(response,409,{error:'credentials_already_set',message:'This collection already has a login.'},cors);
        const passwordSalt=randomBytes(16).toString('hex');
        const passwordHash=await hashPassword(body.password,Buffer.from(passwordSalt,'hex'));
        try{
          const result=database.prepare('UPDATE users SET username=?,password_salt=?,password_hash=? WHERE id=? AND username IS NULL').run(username,passwordSalt,passwordHash,user.id);
          if(result.changes===1)return json(response,200,{username},cors);
          return json(response,409,{error:'credentials_already_set',message:'This collection already has a login.'},cors);
        }catch(error){
          if(database.prepare('SELECT 1 FROM users WHERE username=? COLLATE NOCASE').get(username))return json(response,409,{error:'username_taken',message:'That username is already in use.'},cors);
          throw error;
        }
      }
      if (pathname==='/api/auth/pairing-code' && request.method==='POST') {
        if (!user) return json(response,401,{error:'unauthorized'},cors);
        if (!limited('pair-code:'+user.id,Date.now(),5)) return json(response,429,{error:'rate_limited',message:'Too many pairing codes generated. Try again later.'},cors);
        const now=Date.now(),expiresAt=now+pairingCodeLifetime;
        database.prepare('DELETE FROM pairing_codes WHERE expires_at<=? OR user_id=?').run(now,user.id);
        const insert=database.prepare('INSERT INTO pairing_codes(code_hash,user_id,expires_at) VALUES(?,?,?) ON CONFLICT(code_hash) DO NOTHING');
        let code='',stored=false;
        for(let attempt=0;attempt<3&&!stored;attempt++){
          code=makePairingCode();
          stored=insert.run(digest(code),user.id,expiresAt).changes===1;
        }
        if(!stored)throw Error('Could not create a pairing code. Try again.');
        return json(response,200,{code,expiresAt:new Date(expiresAt).toISOString()},cors);
      }
      if (pathname.startsWith('/api/workspace') && !user) return json(response,401,{error:'unauthorized'},cors);
      if (pathname==='/api/auth/logout' && request.method==='POST') {
        if (!user) return json(response,401,{error:'unauthorized'},cors);
        const token=request.headers.authorization?.slice(7);
        if (token) database.prepare('DELETE FROM sessions WHERE token_hash=?').run(digest(token));
        return json(response,200,{ok:true},cors);
      }
      if (pathname==='/api/auth/logout-all' && request.method==='POST') {
        if (!user) return json(response,401,{error:'unauthorized'},cors);
        database.prepare('DELETE FROM sessions WHERE user_id=?').run(user.id);
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
