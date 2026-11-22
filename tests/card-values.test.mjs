import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {createCardValueService} from '../card-values.mjs';
import {createStaticHandler} from '../server.mjs';

function provider({price=0.12,printing='Normal'}={}){
 const calls=[];
 return {calls,fetchImpl:async url=>{
  calls.push(url);
  if(url.includes('/v1/sets?'))return Response.json({data:[{id:10,name:'Jump to Lightspeed'}],meta:{has_more:false}});
  if(url.includes('/v1/search?'))return Response.json({data:[{tcgplayer_id:621646,set_name:'Jump to Lightspeed',game_slug:'star-wars-unlimited',product_type:'Cards',number:'661'}],meta:{has_more:false}});
  return Response.json({data:{tcgplayer_id:621646,set_name:'Jump to Lightspeed',number:'661',prices:[{printing,market_price:price,market_price_as_of:'2026-11-21'}]}});
 }};
}

test('preserves provider finish labels without treating a mislabeled foil-only price as normal',async()=>{
 const mock=provider(),lookup=createCardValueService({apiKey:'test-key',fetchImpl:mock.fetchImpl});
 const result=await lookup('JTL_661');
 assert.equal(result.normal,null);
 assert.equal(result.foil,null);
 assert.deepEqual(result.reported,[{finish:'Normal',amount:0.12,asOf:'2026-11-21'}]);
 assert.equal(result.productUrl,'https://www.tcgplayer.com/product/621646');
 await lookup('JTL_661');
 assert.equal(mock.calls.length,3);
});

test('accepts a provider foil price for a foil-only printing',async()=>{
 const mock=provider({printing:'Foil'});
 const lookup=createCardValueService({apiKey:'test-key',fetchImpl:mock.fetchImpl});
 const result=await lookup('JTL_661');
 assert.equal(result.foil,0.12);
 assert.equal(result.normal,null);
});

test('reports configuration, quota, and incomplete search errors',async()=>{
 await assert.rejects(createCardValueService({apiKey:''})('JTL_661'),{status:503});
 const quota=createCardValueService({apiKey:'test-key',fetchImpl:async()=>new Response('',{status:429})});
 await assert.rejects(quota('JTL_661'),{status:429});
 const incomplete=createCardValueService({apiKey:'test-key',fetchImpl:async url=>url.includes('/v1/sets?')
  ?Response.json({data:[{id:10,name:'Jump to Lightspeed'}],meta:{has_more:false}})
  :Response.json({data:[],meta:{has_more:true}})});
 await assert.rejects(incomplete('JTL_661'),{status:502});
});

test('marks cards absent from the bundled catalog unavailable without contacting the provider',async()=>{
 const mock=provider(),lookup=createCardValueService({apiKey:'test-key',fetchImpl:mock.fetchImpl});
 const result=await lookup('FUTURE_999');
 assert.equal(result.normal,null);
 assert.equal(result.foil,null);
 assert.deepEqual(result.reported,[]);
 assert.equal(mock.calls.length,0);
});

test('local card values require the request header and reject foreign origins',async t=>{
 const hosts=new Set();
 const server=createServer(createStaticHandler({allowedHosts:hosts,cardValue:async id=>{
  if(id==='SOR_429')throw Object.assign(Error('Daily limit reached.'),{status:429});
  return {id};
 }}));
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 t.after(()=>new Promise(resolve=>server.close(resolve)));
 const base=`http://127.0.0.1:${server.address().port}`,url=base+'/api/card-value?id=SOR_059';
 hosts.add(new URL(base).host);
 assert.equal((await fetch(url)).status,403);
 assert.equal((await fetch(url,{headers:{'X-Holocron-Request':'1',Origin:'https://example.test'}})).status,403);
 const response=await fetch(url,{headers:{'X-Holocron-Request':'1',Origin:base}});
 assert.equal(response.status,200);
 assert.deepEqual(await response.json(),{id:'SOR_059'});
 const quota=await fetch(base+'/api/card-value?id=SOR_429',{headers:{'X-Holocron-Request':'1'}});
 assert.equal(quota.status,429);
 assert.equal((await quota.json()).message,'Daily limit reached.');
});
