import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {createSyncServer} from '../sync-server.mjs';

async function startServer(t,options={}) {
  const database=new DatabaseSync(':memory:');
  const {server}=createSyncServer({database,allowedOrigins:['https://app.example.test'],...options});
  await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve)});
  const base=`http://127.0.0.1:${server.address().port}`;
  t.after(()=>new Promise(resolve=>server.close(()=>{database.close();resolve()})));
  return base;
}

async function post(base,path,data,token){
  return fetch(base+path,{method:'POST',headers:{'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},body:JSON.stringify(data)});
}

async function putWorkspace(base,token,expectedRevision,data){
  return fetch(base+'/api/workspace',{method:'PUT',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify({expectedRevision,data})});
}

test('sync API registers accounts and protects workspaces with revision checks',async t=>{
  const base=await startServer(t);
  const account=await post(base,'/api/auth/register',{email:'pilot@example.test',password:'a-strong-password'});
  assert.equal(account.status,201);
  const {token,user}=await account.json();
  assert.equal(user.email,'pilot@example.test');
  assert.equal((await fetch(base+'/api/workspace')).status,401);
  assert.equal((await fetch(base+'/api/workspace',{headers:{Authorization:'Bearer '+token}})).status,404);

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

test('sync API rejects weak credentials and invalid workspace payloads',async t=>{
  const base=await startServer(t);
  assert.equal((await post(base,'/api/auth/register',{email:'pilot@example.test',password:'short'})).status,400);
  const account=await post(base,'/api/auth/register',{email:'pilot@example.test',password:'a-strong-password'});
  const {token}=await account.json();
  assert.equal((await post(base,'/api/auth/register',{email:'pilot@example.test',password:'another-strong-password'})).status,409);
  assert.equal((await post(base,'/api/auth/login',{email:'pilot@example.test',password:'wrong-password'})).status,401);
  const invalid=await putWorkspace(base,token,0,{collection:'bad',decks:[]});
  assert.equal(invalid.status,400);
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
