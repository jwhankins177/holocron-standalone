import {createContext,useContext,useEffect,useMemo,useRef,useState} from 'react';
import type {Card,Owned} from './model';
import {collectionValue} from './collection-value';

export type CardValue={id:string;fetchedAt:string;normal:number|null;foil:number|null;reported:{finish:string;amount:number|null;asOf:string|null}[];productUrl?:string};
type ValueMap=Record<string,CardValue>;
const Context=createContext<{enabled:boolean;values:ValueMap;busy:boolean;check:(id:string)=>void}>({enabled:false,values:{},busy:false,check:()=>{}});
export const CardValueProvider=Context.Provider;
const money=(value:number|null|undefined)=>value==null?'Unavailable':new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(value);

function database():Promise<IDBDatabase>{
 return new Promise((resolve,reject)=>{
  const request=indexedDB.open('holocron-card-values',1);
  request.onupgradeneeded=()=>request.result.createObjectStore('prices',{keyPath:'id'});
  request.onsuccess=()=>resolve(request.result);
  request.onerror=()=>reject(request.error||Error('Card values could not be stored on this device.'));
 });
}
async function load():Promise<ValueMap>{
 const db=await database();
 return new Promise((resolve,reject)=>{
  const tx=db.transaction('prices','readonly'),request=tx.objectStore('prices').getAll();
  tx.oncomplete=()=>{db.close();resolve(Object.fromEntries((request.result as CardValue[]).map(value=>[value.id,value])))};
  tx.onabort=()=>{db.close();reject(tx.error||Error('Saved card values could not be read.'))};
 });
}
async function save(value:CardValue){
 const db=await database();
 return new Promise<void>((resolve,reject)=>{
  const tx=db.transaction('prices','readwrite');tx.objectStore('prices').put(value);
  tx.oncomplete=()=>{db.close();resolve()};
  tx.onabort=()=>{db.close();reject(tx.error||Error('Card value could not be saved.'))};
 });
}
async function clearSaved(){
 const db=await database();
 return new Promise<void>((resolve,reject)=>{
  const tx=db.transaction('prices','readwrite');tx.objectStore('prices').clear();
  tx.oncomplete=()=>{db.close();resolve()};
  tx.onabort=()=>{db.close();reject(tx.error||Error('Card values could not be cleared.'))};
 });
}
function validate(value:unknown,id:string):CardValue{
 if(!value||typeof value!=='object')throw Error('The server returned an invalid card value.');
 const v=value as CardValue;
 const validPrice=(price:unknown)=>price===null||typeof price==='number'&&Number.isFinite(price)&&price>=0;
 if(v.id!==id||typeof v.fetchedAt!=='string'||!Number.isFinite(Date.parse(v.fetchedAt))||
  !validPrice(v.normal)||!validPrice(v.foil)||!Array.isArray(v.reported)||
  v.reported.some(price=>!price||typeof price.finish!=='string'||!validPrice(price.amount)||!(price.asOf===null||typeof price.asOf==='string'))||
  v.productUrl!==undefined&&!/^https:\/\/www\.tcgplayer\.com\/product\/\d+$/.test(v.productUrl))throw Error('The server returned an invalid card value.');
 return v;
}
export function useCardValues(enabled:boolean,collection:Owned[],byId:ReadonlyMap<string,Card>,token:string){
 const [values,setValues]=useState<ValueMap>({}),[message,setMessage]=useState(''),[busy,setBusy]=useState(false),[cacheReady,setCacheReady]=useState(false);
 const inFlight=useRef(false);
 useEffect(()=>{void load().then(saved=>setValues(Object.fromEntries(Object.entries(saved).map(([id,value])=>[id,validate(value,id)])))).catch(error=>setMessage(error instanceof Error?error.message:'Saved card values could not be read.')).finally(()=>setCacheReady(true))},[]);
 async function checkIds(ids:string[]){
  if(inFlight.current)return;
  inFlight.current=true;setBusy(true);setMessage('');
  try{
   const candidates=[...new Set(ids)].filter(id=>byId.has(id));
   const stale=[...candidates.filter(id=>!values[id]),...candidates.filter(id=>values[id]&&Date.now()-Date.parse(values[id].fetchedAt)>=24*60*60*1000)];
   if(!stale.length){setMessage('Card values were checked within the last 24 hours.');return}
   let completed=0;
   for(const id of stale){
    const response=await fetch('./api/card-value?id='+encodeURIComponent(id),{headers:{'X-Holocron-Request':'1',...(token?{Authorization:'Bearer '+token}:{})},signal:AbortSignal.timeout(60000)});
    if(!response.ok){let detail:{message?:string}={};try{detail=await response.json()}catch{}throw Error(detail.message||`Card value request failed (HTTP ${response.status}).`)}
    const value=validate(await response.json(),id);
    await save(value);setValues(previous=>({...previous,[id]:value}));completed++;
    setMessage(`Checked ${completed} of ${stale.length} printings.`);
   }
   setMessage(`Checked ${completed} printings.`);
  }catch(error){setMessage(error instanceof Error?error.message:'Card values could not be refreshed.')}
  finally{inFlight.current=false;setBusy(false)}
 }
 const refresh=()=>checkIds(collection.map(row=>row.id));
 const check=(id:string)=>{void checkIds([id])};
 const clear=async()=>{if(inFlight.current)return;inFlight.current=true;setBusy(true);try{await clearSaved();setValues({});setMessage('Saved card values cleared.')}catch(error){setMessage(error instanceof Error?error.message:'Card values could not be cleared.')}finally{inFlight.current=false;setBusy(false)}};
 const totals=useMemo(()=>collectionValue(collection,values),[collection,values]);
 return {values,message,busy:busy||!cacheReady,refresh,check,clear,totals,enabled};
}
export function CardValueLabel({card}:{card:Card}){
 const {enabled,values,busy,check}=useContext(Context);
 if(!enabled)return null;
 const value=values[card.id];
 if(!value)return <button type="button" className="card-value-label" disabled={busy} onClick={()=>check(card.id)}>Check value</button>;
 return <span className="card-value-label">{value.reported.length
  ?value.reported.map(price=>`${price.finish}: ${money(price.amount)}${price.asOf?' ('+price.asOf+')':''}`).join(' · ')
  :'Value unavailable'}{value.productUrl&&<> · <a href={value.productUrl} target="_blank" rel="noreferrer">TCGplayer</a></>}</span>;
}
export function ValueSummary({amount,missing}:{amount:number;missing:number}){
 return <span>Estimated collection value: <strong>{money(amount)}</strong>{missing>0&&` · ${missing.toLocaleString()} copies without a matching price`}</span>;
}
