import test from 'node:test';
import assert from 'node:assert/strict';
import {collectionValue} from '../modern/lib/collection-value.ts';
import {effectiveCollection,validateBackup} from '../modern/lib/model.ts';

test('values resolved copies by exact printing and finish and reports unpriced copies',()=>{
 const workspace={collection:[
  {id:'SOR_059',foil:false,count:2},{id:'SOR_059',foil:true,count:3},
  {id:'SOR_324',foil:false,count:1},{id:'UNKNOWN_001',foil:false,count:2},
  {id:'SOR_060',foil:false,count:1},
 ],decks:[],resolutions:[{sourceId:'SOR_060',kind:'catalog',targetId:'SOR_059'}]};
 const result=collectionValue(effectiveCollection(workspace),{
  SOR_059:{normal:0.05,foil:null},SOR_324:{normal:0.26,foil:1.75},
 });
 assert.deepEqual(result,{amount:0.41,missing:5});
});

test('value display setting survives backup validation and rejects invalid settings',()=>{
 const data={collection:[],decks:[],settings:{showCardValues:true}};
 assert.equal(validateBackup(data).settings.showCardValues,true);
 assert.throws(()=>validateBackup({...data,settings:{showCardValues:'true'}}),/card value setting/);
});
