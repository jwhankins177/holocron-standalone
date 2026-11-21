import {test} from 'node:test';
import assert from 'node:assert/strict';
import {normalizeSyncUrl} from '../modern/lib/sync-api.ts';
import {readSyncSession} from '../modern/lib/sync-session.ts';

function storage(values){return {getItem:key=>values[key]??null}}

test('saved device sign-in survives equivalent sync URLs',()=>{
 const session=readSyncSession(storage({
  'holocron-sync-token':'token',
  'holocron-sync-user-id':'7',
  'holocron-sync-url':'https://sync.example.test/',
  'holocron-sync-auth-url':'https://SYNC.example.test',
 }),normalizeSyncUrl);
 assert.deepEqual(session,{token:'token',userId:7,serverUrl:'https://sync.example.test'});
});

test('saved device sign-in is rejected for a different sync server or invalid session',()=>{
 const values={
  'holocron-sync-token':'token',
  'holocron-sync-user-id':'7',
  'holocron-sync-url':'https://sync.example.test',
  'holocron-sync-auth-url':'https://other.example.test',
 };
 assert.equal(readSyncSession(storage(values),normalizeSyncUrl),null);
 assert.equal(readSyncSession(storage({...values,'holocron-sync-auth-url':'https://sync.example.test','holocron-sync-user-id':'0'}),normalizeSyncUrl),null);
});
