import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {fileURLToPath} from 'node:url';
import {createCloudServer} from '../cloud-server.mjs';

test('cloud server serves the app and authenticated API on one origin',async t=>{
  const database=new DatabaseSync(':memory:');
  const hosts=new Set();
  const origins=[];
  const {server}=createCloudServer({
    database,
    registrationCode:'test-invite',
    catalogPath:fileURLToPath(new URL('../public/catalog.json',import.meta.url)),
    root:fileURLToPath(new URL('../public/',import.meta.url)),
    hosts,
    origins,
  });
  await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve)});
  const base='http://127.0.0.1:'+server.address().port;
  const host='127.0.0.1:'+server.address().port;
  const origin='http://'+host;
  hosts.add(host);
  origins.push(origin);
  const request=(path,options={})=>fetch(base+path,options);
  t.after(()=>new Promise(resolve=>server.close(()=>{database.close();resolve()})));

  hosts.clear();
  assert.equal((await request('/healthz')).status,200);
  hosts.add(host);
  const health=await request('/healthz');
  assert.equal(health.status,200);
  assert.equal(await health.text(),'ok');
  assert.equal((await request('/manifest.webmanifest')).status,200);
  assert.equal((await request('/api/catalog',{headers:{Origin:origin}})).status,200);
  assert.equal((await request('/api/catalog',{headers:{Origin:'https://attacker.example.test'}})).status,403);
  const account=await request('/api/auth/register',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify({username:'cloud.user',password:'a-long-enough-password',inviteCode:'test-invite'})});
  assert.equal(account.status,201);
  const {token,user,...accountData}=await account.json();
  assert.equal(user.id,1);
  assert.equal(Object.hasOwn(accountData,'code'),false);
  const pairing=await request('/api/auth/pairing-code',{method:'POST',headers:{Origin:origin,Authorization:'Bearer '+token}});
  assert.equal(pairing.status,200);
  const {code,expiresAt}=await pairing.json();
  assert.match(code,/^\d{8}$/);
  assert.ok(Date.parse(expiresAt)>Date.now());
});
