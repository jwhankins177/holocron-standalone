import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';
import {createSyncServer} from '../sync-server.mjs';

async function startServer(t,options={}) {
  const database=options.database||new DatabaseSync(':memory:');
  const {server}=createSyncServer({database,allowedOrigins:['https://app.example.test'],registrationCode:'test-invite',...options});
  await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve)});
  const base=`http://127.0.0.1:${server.address().port}`;
  t.after(()=>new Promise(resolve=>server.close(()=>{database.close();resolve()})));
  return base;
}

async function post(base,path,data,token){
  return fetch(base+path,{method:'POST',headers:{...(data===undefined?{}:{'Content-Type':'application/json'}),...(token?{Authorization:'Bearer '+token}:{})},...(data===undefined?{}:{body:JSON.stringify(data)})});
}

async function putWorkspace(base,token,expectedRevision,data){
  return fetch(base+'/api/workspace',{method:'PUT',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify({expectedRevision,data})});
}

test('sync API creates a collection, pairs a device once, and protects workspaces',async t=>{
  const database=new DatabaseSync(':memory:');
  const base=await startServer(t,{database});
  assert.equal((await post(base,'/api/auth/register',{email:'old@example.test',password:'legacy-password',inviteCode:'test-invite'})).status,400);
  assert.equal((await post(base,'/api/auth/register',{username:'ab',password:'short',inviteCode:'test-invite'})).status,400);
  const username='collection.owner';
  const password='correct-horse-battery';
  const account=await post(base,'/api/auth/register',{username,password,inviteCode:'test-invite'});
  assert.equal(account.status,201);
  const {token,user,...accountData}=await account.json();
  assert.equal(user.id,1);
  assert.equal(Object.hasOwn(accountData,'code'),false);
  assert.deepEqual({...database.prepare('SELECT username FROM users WHERE id=?').get(user.id)},{username});
  assert.notEqual(database.prepare('SELECT password_hash FROM users WHERE id=?').get(user.id).password_hash,password);
  const signedIn=await post(base,'/api/auth/login',{username:'Collection.Owner',password});
  assert.equal(signedIn.status,200);
  const signedInData=await signedIn.json();
  assert.equal(signedInData.user.id,user.id);
  assert.equal((await post(base,'/api/auth/login',{username,password:'wrong-password'})).status,401);
  assert.equal((await post(base,'/api/auth/register',{username:'COLLECTION.OWNER',password,inviteCode:'test-invite'})).status,409);
  assert.deepEqual(await (await fetch(base+'/api/auth/account',{headers:{Authorization:'Bearer '+token}})).json(),{username});
  assert.equal((await fetch(base+'/api/workspace')).status,401);
  assert.equal((await fetch(base+'/api/workspace',{headers:{Authorization:'Bearer '+token}})).status,404);

  const pairingResponse=await post(base,'/api/auth/pairing-code',{},token);
  assert.equal(pairingResponse.status,200);
  const {code,expiresAt}=await pairingResponse.json();
  assert.match(code,/^\d{8}$/);
  assert.ok(Date.parse(expiresAt)-Date.now()<=10*60*1000);
  assert.ok(Date.parse(expiresAt)-Date.now()>9*60*1000);
  const redemptions=await Promise.all([post(base,'/api/auth/login',{code}),post(base,'/api/auth/login',{code})]);
  assert.deepEqual(redemptions.map(response=>response.status).sort(),[200,401]);
  const newDevice=await redemptions.find(response=>response.status===200).json();
  assert.equal(newDevice.user.id,user.id);
  assert.equal(Object.hasOwn(newDevice,'code'),false);
  const expired=await (await post(base,'/api/auth/pairing-code',{},token)).json();
  const expiredHash=createHash('sha256').update(expired.code).digest('hex');
  database.prepare('UPDATE pairing_codes SET expires_at=? WHERE code_hash=?').run(Date.now()-1,expiredHash);
  assert.equal((await post(base,'/api/auth/login',{code:expired.code})).status,401);

  const data={collection:[{id:'SOR_005',foil:false,count:2}],decks:[]};
  const created=await putWorkspace(base,token,0,data);
  assert.equal(created.status,200);
  assert.equal((await created.json()).revision,1);
  const conflicting=await putWorkspace(base,token,0,{collection:[],decks:[]});
  assert.equal(conflicting.status,409);
  assert.equal((await conflicting.json()).revision,1);
  const current=await fetch(base+'/api/workspace',{headers:{Authorization:'Bearer '+token}});
  assert.deepEqual((await current.json()).data,data);
});

test('sync API disables registration without an invite and accepts the configured code',async t=>{
  const disabledBase=await startServer(t,{registrationCode:''});
  const credentials={username:'new.member',password:'a-long-enough-password',inviteCode:'test-invite'};
  assert.equal((await post(disabledBase,'/api/auth/register',credentials)).status,503);

  const base=await startServer(t);
  assert.equal((await post(base,'/api/auth/register',{...credentials,inviteCode:undefined})).status,403);
  assert.equal((await post(base,'/api/auth/register',{...credentials,inviteCode:'wrong-code'})).status,403);
  assert.equal((await post(base,'/api/auth/register',credentials)).status,201);
});

test('separate accounts cannot read or overwrite each other’s collections',async t=>{
  const base=await startServer(t);
  const first=await (await post(base,'/api/auth/register',{username:'first.member',password:'a-long-enough-password',inviteCode:'test-invite'})).json();
  const second=await (await post(base,'/api/auth/register',{username:'second.member',password:'a-long-enough-password',inviteCode:'test-invite'})).json();
  const data={collection:[{id:'SOR_005',foil:false,count:2}],decks:[]};
  assert.equal((await putWorkspace(base,first.token,0,data)).status,200);
  assert.equal((await fetch(base+'/api/workspace',{headers:{Authorization:'Bearer '+second.token}})).status,404);
  assert.equal((await putWorkspace(base,second.token,0,{collection:[],decks:[]})).status,200);
  const firstWorkspace=await fetch(base+'/api/workspace',{headers:{Authorization:'Bearer '+first.token}});
  assert.deepEqual((await firstWorkspace.json()).data,data);
});

test('sync API adds login credentials to an existing collection without replacing its workspace',async t=>{
  const database=new DatabaseSync(':memory:');
  const base=await startServer(t,{database});
  const inserted=database.prepare('INSERT INTO users(access_code_hash) VALUES(NULL)').run();
  const user={id:Number(inserted.lastInsertRowid)};
  const token=Buffer.alloc(32,9).toString('base64url');
  database.prepare('INSERT INTO sessions(token_hash,user_id,expires_at) VALUES(?,?,?)')
    .run(createHash('sha256').update(token).digest('hex'),user.id,Date.now()+60_000);
  const data={collection:[{id:'SOR_005',foil:true,count:3}],decks:[{uid:'existing-deck'}]};
  assert.equal((await putWorkspace(base,token,0,data)).status,200);
  assert.deepEqual(await (await fetch(base+'/api/auth/account',{headers:{Authorization:'Bearer '+token}})).json(),{username:null});

  const credentials=await post(base,'/api/auth/credentials',{username:'my.collection',password:'a-long-enough-password',inviteCode:'test-invite'},token);
  assert.equal(credentials.status,200);
  assert.deepEqual(await credentials.json(),{username:'my.collection'});
  assert.deepEqual(await (await fetch(base+'/api/auth/account',{headers:{Authorization:'Bearer '+token}})).json(),{username:'my.collection'});
  assert.equal((await post(base,'/api/auth/credentials',{username:'another.name',password:'a-long-enough-password',inviteCode:'test-invite'},token)).status,409);

  const login=await post(base,'/api/auth/login',{username:'my.collection',password:'a-long-enough-password'});
  assert.equal(login.status,200);
  const newDevice=await login.json();
  assert.equal(newDevice.user.id,user.id);
  const workspace=await fetch(base+'/api/workspace',{headers:{Authorization:'Bearer '+newDevice.token}});
  assert.deepEqual((await workspace.json()).data,data);
});

test('sync API preserves existing device sessions and workspaces when adding credential columns',async t=>{
  const database=new DatabaseSync(':memory:');
  database.exec(`
    PRAGMA foreign_keys=ON;
    CREATE TABLE users(id INTEGER PRIMARY KEY,access_code_hash TEXT UNIQUE);
    CREATE TABLE sessions(token_hash TEXT PRIMARY KEY,user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,expires_at INTEGER NOT NULL);
    CREATE TABLE pairing_codes(code_hash TEXT PRIMARY KEY,user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,expires_at INTEGER NOT NULL);
    CREATE TABLE workspaces(user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,revision INTEGER NOT NULL,updated_at TEXT NOT NULL,data TEXT NOT NULL);
    INSERT INTO users VALUES(1,NULL);
    INSERT INTO workspaces VALUES(1,3,'2026-11-20T00:00:00.000Z','{"collection":[{"id":"SOR_005","foil":false,"count":4}],"decks":[]}');
  `);
  const token=Buffer.alloc(32,7).toString('base64url');
  database.prepare('INSERT INTO sessions VALUES(?,?,?)').run(createHash('sha256').update(token).digest('hex'),1,Date.now()+60_000);
  const base=await startServer(t,{database});
  const existingWorkspace=await fetch(base+'/api/workspace',{headers:{Authorization:'Bearer '+token}});
  assert.equal(existingWorkspace.status,200);
  assert.equal((await existingWorkspace.json()).revision,3);
  const columns=database.prepare('PRAGMA table_info(users)').all().map(column=>column.name);
  assert.ok(columns.includes('username')&&columns.includes('password_salt')&&columns.includes('password_hash'));
  assert.equal(database.prepare('SELECT COUNT(*) AS count FROM sessions').get().count,1);
});

test('sync API replaces unused pairing codes and rejects invalid workspace payloads',async t=>{
  const base=await startServer(t);
  const account=await post(base,'/api/auth/register',{username:'pairing.owner',password:'a-long-enough-password',inviteCode:'test-invite'});
  const {token}=await account.json();
  assert.equal((await post(base,'/api/auth/login',{code:'not-a-valid-code'})).status,401);
  const first=await (await post(base,'/api/auth/pairing-code',{},token)).json();
  const second=await (await post(base,'/api/auth/pairing-code',{},token)).json();
  assert.notEqual(second.code,first.code);
  assert.equal((await post(base,'/api/auth/login',{code:first.code})).status,401);
  assert.equal((await post(base,'/api/auth/login',{code:second.code})).status,200);
  assert.equal((await post(base,'/api/auth/login',{code:second.code})).status,401);
  const invalid=await putWorkspace(base,token,0,{collection:'bad',decks:[]});
  assert.equal(invalid.status,400);
});

test('sync API can revoke every session for a collection',async t=>{
  const base=await startServer(t);
  const account=await post(base,'/api/auth/register',{username:'revoke.owner',password:'a-long-enough-password',inviteCode:'test-invite'});
  const {token}=await account.json();
  const secondSession=await post(base,'/api/auth/login',{username:'revoke.owner',password:'a-long-enough-password'});
  const {token:secondToken}=await secondSession.json();
  assert.equal((await post(base,'/api/auth/logout-all',{},token)).status,200);
  assert.equal((await fetch(base+'/api/auth/account',{headers:{Authorization:'Bearer '+token}})).status,401);
  assert.equal((await fetch(base+'/api/auth/account',{headers:{Authorization:'Bearer '+secondToken}})).status,401);
});

test('sync API accepts a previous private code once for reconnection',async t=>{
  const database=new DatabaseSync(':memory:');
  database.exec('CREATE TABLE users(id INTEGER PRIMARY KEY,access_code_hash TEXT UNIQUE)');
  const legacyCode='0123456789ABCDEF0123456789ABCDEF';
  const formattedCode=legacyCode.match(/.{4}/g).join('-');
  const codeHash=createHash('sha256').update(legacyCode).digest('hex');
  database.prepare('INSERT INTO users(id,access_code_hash) VALUES(1,?)').run(codeHash);
  const base=await startServer(t,{database});
  const redemptions=await Promise.all([post(base,'/api/auth/login',{code:formattedCode.toLowerCase()}),post(base,'/api/auth/login',{code:formattedCode})]);
  assert.deepEqual(redemptions.map(response=>response.status).sort(),[200,401]);
  assert.equal((await redemptions.find(response=>response.status===200).json()).legacyCodeUsed,true);
  assert.equal(database.prepare('SELECT access_code_hash FROM users WHERE id=1').get().access_code_hash,null);
});

test('legacy email accounts are not migrated but their workspaces are preserved',async t=>{
  const database=new DatabaseSync(':memory:');
  database.exec(`
    PRAGMA foreign_keys=ON;
    CREATE TABLE users(id INTEGER PRIMARY KEY,email TEXT NOT NULL UNIQUE,salt TEXT NOT NULL,password_hash TEXT NOT NULL);
    CREATE TABLE sessions(token_hash TEXT PRIMARY KEY,user_id INTEGER NOT NULL REFERENCES users(id),expires_at INTEGER NOT NULL);
    CREATE TABLE workspaces(user_id INTEGER PRIMARY KEY REFERENCES users(id),revision INTEGER NOT NULL,updated_at TEXT NOT NULL,data TEXT NOT NULL);
    INSERT INTO users VALUES(1,'old@example.test','salt','hash');
    INSERT INTO sessions VALUES('old-session',1,9999999999999);
    INSERT INTO workspaces VALUES(1,1,'2026-11-20T00:00:00.000Z','{\"collection\":[],\"decks\":[]}');
  `);
  const {server}=createSyncServer({database,allowedOrigins:['https://app.example.test']});
  await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve)});
  t.after(()=>new Promise(resolve=>server.close(()=>{database.close();resolve()})));
  assert.deepEqual({...database.prepare('SELECT id,access_code_hash FROM users').get()},{id:1,access_code_hash:null});
  assert.equal(database.prepare('SELECT COUNT(*) AS count FROM sessions').get().count,0);
  assert.equal(database.prepare('SELECT data FROM workspaces WHERE user_id=1').get().data,'{\"collection\":[],\"decks\":[]}');
  assert.deepEqual(database.prepare('PRAGMA foreign_key_check').all(),[]);
});

test('sync API restricts origins and exposes a cacheable public catalog',async t=>{
  const base=await startServer(t);
  assert.equal((await fetch(base+'/api/catalog',{headers:{Origin:'https://attacker.example.test'}})).status,403);
  const preflight=await fetch(base+'/api/workspace',{method:'OPTIONS',headers:{Origin:'https://app.example.test','Access-Control-Request-Method':'PUT'}});
  assert.equal(preflight.status,204);
  const catalog=await fetch(base+'/api/catalog',{headers:{Origin:'https://app.example.test'}});
  assert.equal(catalog.status,200);
  assert.match(catalog.headers.get('etag'),/^".+"$/);
  const cached=await fetch(base+'/api/catalog',{headers:{Origin:'https://app.example.test','If-None-Match':catalog.headers.get('etag')}});
  assert.equal(cached.status,304);
});

test('sync API rejects cross-origin requests when the origin allowlist is empty',async t=>{
  const base=await startServer(t,{allowedOrigins:[]});
  assert.equal((await fetch(base+'/api/catalog',{headers:{Origin:'https://app.example.test'}})).status,403);
  assert.equal((await fetch(base+'/api/catalog')).status,200);
});

test('catalog refresh imports current SWU-DB data while preserving local printings',async t=>{
  const upstreamCards=[
    {Set:'SOR',Number:'059',Name:'2-1B Surgical Droid',Type:'Unit',Aspects:['Vigilance'],Traits:['DROID'],Keywords:[],Arenas:['Ground'],Cost:'1',Power:'1',HP:'3',FrontText:'Updated rules text.',DoubleSided:false,Rarity:'Common',Unique:false,Artist:'Hoan Nguyen',VariantType:'Normal',FrontArt:'https://cards.example.test/SOR/059.png'},
    {Set:'ZZZ',Number:'1',Name:'New Card',Type:'Unit',Aspects:[],Traits:[],Keywords:[],Arenas:['Ground'],Cost:'2',Power:'2',HP:'2',FrontText:'New card text.',DoubleSided:false,Rarity:'Common',Unique:false,Artist:'Unknown',VariantType:'Normal',FrontArt:'https://cards.example.test/ZZZ/001.png'},
  ];
  const fetchImpl=async url=>new Response(JSON.stringify(String(url).endsWith('/sets')
    ?[{setId:'ZZZ',fullName:'New Set'}]
    :{data:upstreamCards}),{status:200,headers:{'Content-Type':'application/json'}});
  const base=await startServer(t,{fetchImpl});
  const response=await fetch(base+'/api/catalog/refresh',{method:'POST'});
  assert.equal(response.status,200);
  const catalog=await response.json();
  assert.ok(Date.parse(catalog.updated)>Date.parse('2026-11-02T23:24:18.606665+00:00'));
  assert.equal(catalog.cards.find(card=>card.id==='SOR_059').text,'Updated rules text.');
  const hyperspace=catalog.cards.find(card=>card.id==='SOR_324');
  assert.equal(hyperspace.text,'Updated rules text.');
  assert.equal(hyperspace.variant,'Hyperspace');
  assert.equal(hyperspace.image,'https://cdn.swu-db.com/images/cards/SOR/324.png');
  assert.equal(catalog.cards.find(card=>card.id==='ZZZ_001').name,'New Card');
  assert.ok(catalog.sets.some(set=>set.code==='ZZZ'&&set.name==='New Set'));
});
