import {test} from 'node:test';
import assert from 'node:assert/strict';
import {normalizeSyncUrl} from '../modern/lib/sync-api.ts';
import {elapsedSync,readSyncSession} from '../modern/lib/sync-session.ts';

function storage(values){return {getItem:key=>values[key]??null}}

test('last sync is displayed as elapsed hours or days',()=>{
 const now=Date.parse('2026-11-21T12:00:00Z');
 assert.equal(elapsedSync(null,now),'Never');
 assert.equal(elapsedSync('invalid',now),'Never');
 assert.equal(elapsedSync('2026-11-21T13:00:00Z',now),'Less than an hour ago');
 assert.equal(elapsedSync('2026-11-21T11:01:00Z',now),'Less than an hour ago');
 assert.equal(elapsedSync('2026-11-21T11:00:00Z',now),'1 hour ago');
 assert.equal(elapsedSync('2026-11-20T13:00:00Z',now),'23 hours ago');
 assert.equal(elapsedSync('2026-11-20T12:00:00Z',now),'1 day ago');
 assert.equal(elapsedSync('2026-11-19T12:00:00Z',now),'2 days ago');
});

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
