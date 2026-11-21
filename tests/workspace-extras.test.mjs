import test from 'node:test';
import assert from 'node:assert/strict';
import {elapsedBackup,affectedDecks} from '../modern/lib/workspace-extras.ts';

test('backup age reports elapsed days and hours and handles missing dates',()=>{
 const now=Date.parse('2026-11-21T12:00:00Z');
 assert.equal(elapsedBackup('2026-11-19T09:00:00Z',now),'2 days, 3 hours ago');
 assert.equal(elapsedBackup(null,now),'Never');
 assert.equal(elapsedBackup('invalid',now),'Never');
 assert.equal(elapsedBackup('2026-11-22T00:00:00Z',now),'0 days, 0 hours ago');
});

test('catalog comparison flags gameplay changes in saved decks, not artwork',()=>{
 const card={id:'SOR_001',name:'Card',text:'Old',image:'old'};
 const previous={cards:[card],sets:[],updated:'2026-01-01',sources:[]};
 const deck={uid:'one',name:'One',leader:'',base:'',deck:[{id:'SOR_001',count:3},{id:'SOR_002',count:1}],sideboard:[]};
 const next={...previous,cards:[{...card,text:'New',image:'new'},{id:'SOR_002',name:'New card'}]};
 assert.deepEqual(affectedDecks(previous,next,[deck]),[{deckId:'one',name:'One',changed:['SOR_001','SOR_002']}]);
 assert.deepEqual(affectedDecks(previous,{...previous,cards:[{...card,image:'new'}]},[deck]),[]);
});
