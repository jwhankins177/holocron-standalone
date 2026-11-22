import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';

const defaultCatalog=fileURLToPath(new URL('./public/catalog.json',import.meta.url));
const failure=(message,status)=>Object.assign(Error(message),{status});
const normalizedNumber=value=>String(value??'').split('/')[0].trim().toUpperCase().replace(/^0+(?=\d)/,'');

export function createCardValueService({apiKey=process.env.TCG_API_KEY||'',catalogPath=defaultCatalog,fetchImpl=globalThis.fetch}={}) {
  let catalogPromise,setsPromise;
  const cache=new Map(),pending=new Map();
  async function get(path) {
    let response;
    try {
      response=await fetchImpl('https://api.tcgapi.dev'+path,{
        headers:{'X-API-Key':apiKey},signal:AbortSignal.timeout(20000),
      });
    } catch {
      throw failure('Could not reach the card value provider.',502);
    }
    if(response.status===429)throw failure('The card value provider’s daily request limit was reached. Try again after its reset.',429);
    if(!response.ok)throw failure(`Card value provider returned HTTP ${response.status}.`,502);
    let payload;
    try { payload=await response.json(); } catch { throw failure('Card value provider returned invalid JSON.',502); }
    if(!payload||typeof payload!=='object')throw failure('Card value provider returned invalid data.',502);
    return payload;
  }
  async function loadCatalog() {
    if(!catalogPromise)catalogPromise=readFile(catalogPath,'utf8').then(JSON.parse).catch(error=>{catalogPromise=undefined;throw error});
    return catalogPromise;
  }
  async function loadSets() {
    if(!setsPromise)setsPromise=get('/v1/sets?game=star-wars-unlimited&per_page=100').then(payload=>{
      if(!Array.isArray(payload.data)||payload.meta?.has_more)throw failure('Could not read the complete provider set list.',502);
      return payload.data;
    }).catch(error=>{setsPromise=undefined;throw error});
    return setsPromise;
  }
  async function lookup(id) {
    if(!apiKey.trim())throw failure('Card values are not configured. Set TCG_API_KEY on the server.',503);
    if(typeof id!=='string'||!/^([A-Z0-9]+)_[A-Z0-9-]+$/.test(id)||id.length>80)throw failure('Invalid card ID.',400);
    const saved=cache.get(id);
    if(saved&&Date.now()-Date.parse(saved.fetchedAt)<24*60*60*1000)return saved;
    const unavailable=()=>({id,fetchedAt:new Date().toISOString(),normal:null,foil:null,reported:[]});
    const catalog=await loadCatalog(),card=catalog.cards.find(item=>item.id===id);
    if(!card){const result=unavailable();cache.set(id,result);return result}
    const setName=catalog.sets.find(item=>item.code===card.set)?.name;
    const sets=(await loadSets()).filter(set=>set.name===setName);
    if(sets.length!==1){const result=unavailable();cache.set(id,result);return result}
    const params=new URLSearchParams({game:'star-wars-unlimited',set_id:String(sets[0].id),q:card.name,per_page:'100',type:'Cards'});
    const payload=await get('/v1/search?'+params);
    if(!Array.isArray(payload.data)||payload.meta?.has_more)throw failure('Card search was incomplete; the value could not be matched safely.',502);
    const matches=payload.data.filter(item=>item.set_name===setName&&item.game_slug==='star-wars-unlimited'&&
      item.product_type==='Cards'&&normalizedNumber(item.number)===normalizedNumber(card.number));
    if(matches.length>1)throw failure('Multiple provider products match this printing.',502);
    if(!matches.length){const result=unavailable();cache.set(id,result);return result}
    const item=matches[0];
    if(!Number.isSafeInteger(item.tcgplayer_id)||item.tcgplayer_id<=0)throw failure('Provider product ID is invalid.',502);
    const detail=await get('/v1/cards/tcgplayer/'+item.tcgplayer_id);
    const product=detail.data;
    if(!product||product.tcgplayer_id!==item.tcgplayer_id||product.set_name!==setName||
      normalizedNumber(product.number)!==normalizedNumber(card.number)||!Array.isArray(product.prices))throw failure('Provider product did not match the card printing.',502);
    const reported=product.prices.map(price=>{
      if(!price||typeof price.printing!=='string'||!(price.market_price===null||typeof price.market_price==='number'&&Number.isFinite(price.market_price)&&price.market_price>=0))throw failure('Provider returned an invalid price.',502);
      return {finish:price.printing,amount:price.market_price,asOf:typeof price.market_price_as_of==='string'?price.market_price_as_of:null};
    });
    const exact=finish=>{const values=reported.filter(price=>price.finish===finish);return values.length===1?values[0].amount:null};
    const result={id,fetchedAt:new Date().toISOString(),normal:card.foilOnly?null:exact('Normal'),foil:exact('Foil'),reported,
      productUrl:'https://www.tcgplayer.com/product/'+item.tcgplayer_id};
    cache.set(id,result);
    return result;
  }
  return async id=>{
    if(!pending.has(id))pending.set(id,lookup(id).finally(()=>pending.delete(id)));
    return pending.get(id);
  };
}
