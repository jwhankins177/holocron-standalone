import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeSyncUrl,validateCatalog} from '../modern/lib/sync-api.ts';

test('sync server URLs normalize origins and require HTTPS outside localhost',()=>{
  assert.equal(normalizeSyncUrl('https://sync.example.test/'),'https://sync.example.test');
  assert.equal(normalizeSyncUrl('http://127.0.0.1:41732/'),'http://127.0.0.1:41732');
  assert.throws(()=>normalizeSyncUrl('http://sync.example.test'),/HTTPS/);
  assert.throws(()=>normalizeSyncUrl('https://user:pass@sync.example.test'),/valid sync server origin/);
  assert.throws(()=>normalizeSyncUrl('https://sync.example.test/api'),/valid sync server origin/);
});

test('catalog updates are rejected when IDs are missing or duplicated',()=>{
  const card={id:'SOR_005',name:'Luke Skywalker',image:'https://cards.example.test/SOR_005.webp'};
  assert.deepEqual(validateCatalog({cards:[card],sets:[],updated:'2026-11-17'}).cards,[card]);
  assert.throws(()=>validateCatalog({cards:[{...card,id:''}],sets:[],updated:'today'}),/invalid card catalog/i);
  assert.throws(()=>validateCatalog({cards:[card,card],sets:[],updated:'today'}),/invalid card catalog/i);
});
