import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {runInNewContext} from 'node:vm';

test('offline worker activates a waiting site update on request',async()=>{
  const source=await readFile(new URL('../scripts/offline-worker.js',import.meta.url),'utf8');
  const handlers=new Map();
  let skipWaitingCalled=false,activation;
  const self={
    registration:{scope:'https://app.example.test/'},
    addEventListener:(type,handler)=>handlers.set(type,handler),
    skipWaiting:()=>{skipWaitingCalled=true;return Promise.resolve()},
  };
  runInNewContext('const cacheKey="test";\n'+source,{self,URL});
  handlers.get('message')({
    data:'skip-waiting',
    waitUntil:promise=>{activation=promise},
  });
  await activation;
  assert.equal(skipWaitingCalled,true);
});
