import test from 'node:test';
import assert from 'node:assert/strict';
import {downloadArtwork} from '../scripts/artwork-download.mjs';

test('artwork download retries transient server failures',async()=>{
  let calls=0;
  const bytes=await downloadArtwork('https://cards.example.test/card.png',{
    fetchImpl:async()=>++calls===1
      ?new Response('',{status:500})
      :new Response(Uint8Array.from([1,2,3]),{status:200,headers:{'Content-Type':'image/png'}}),
    wait:async()=>{},
  });
  assert.equal(calls,2);
  assert.deepEqual([...bytes],[1,2,3]);
});

test('artwork download fails immediately for missing or non-image assets',async()=>{
  let calls=0;
  await assert.rejects(()=>downloadArtwork('https://cards.example.test/missing.png',{
    fetchImpl:async()=>{calls++;return new Response('',{status:404})},
    wait:async()=>{},
  }),/HTTP 404/);
  assert.equal(calls,1);
  await assert.rejects(()=>downloadArtwork('https://cards.example.test/card.png',{
    fetchImpl:async()=>new Response('not an image',{status:200,headers:{'Content-Type':'text/plain'}}),
    wait:async()=>{},
  }),/HTTP 200/);
});
