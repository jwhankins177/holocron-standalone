import test from 'node:test';
import assert from 'node:assert/strict';
import {syncSnapshot} from '../modern/lib/workspace-sync.ts';

const data={collection:[],decks:[]};
const remote={revision:3,updatedAt:'2026-11-21T00:00:00Z',data};
const saved={revision:4,updatedAt:'2026-11-21T01:00:00Z'};

test('a changed remote or missing cursor requires a decision without writing',async()=>{
 for(const cursor of [null,2]){
  let written=false;
  const result=await syncSnapshot({data,localRevision:4,cursor,synced:null,read:async()=>remote,write:async()=>{written=true;return saved}});
  assert.equal(result.kind,'conflict');
  assert.equal(written,false);
 }
});

test('sync writes the captured workspace and records its captured revision',async()=>{
 let finish;
 const pending=new Promise(resolve=>{finish=resolve});
 const snapshot={collection:[{id:'SOR_001',count:1,foil:false}],decks:[]};
 const newer={collection:[{id:'SOR_001',count:2,foil:false}],decks:[]};
 let current=snapshot,revision=5,written;
 const syncing=syncSnapshot({data:current,localRevision:revision,cursor:3,synced:null,read:()=>pending,write:async(expected,workspace)=>{written={expected,workspace};return saved}});
 current=newer;revision=6;finish(remote);
 const result=await syncing;
 assert.deepEqual(written,{expected:3,workspace:snapshot});
 assert.equal(result.localRevision,5);
 assert.notEqual(result.localRevision,revision);
});

test('unchanged snapshots do not create a new cloud revision and new clouds are created',async()=>{
 let writes=0;
 const write=async()=>{writes++;return saved};
 const unchanged=await syncSnapshot({data,localRevision:2,cursor:3,synced:{localRevision:2,remoteRevision:3},read:async()=>remote,write});
 assert.equal(unchanged.kind,'unchanged');
 assert.equal(writes,0);
 const created=await syncSnapshot({data,localRevision:2,cursor:null,synced:null,read:async()=>{throw Object.assign(Error('missing'),{status:404})},write:async(expected,workspace)=>{assert.equal(expected,0);assert.equal(workspace,data);return saved}});
 assert.equal(created.kind,'created');
 await assert.rejects(syncSnapshot({data,localRevision:2,cursor:null,synced:null,read:async()=>{throw Error('offline')},write}),/offline/);
});
