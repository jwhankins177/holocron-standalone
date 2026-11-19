import type {Catalog} from './model.ts';

let database:Promise<IDBDatabase>|undefined;
function openCatalogStore(){
 if(!database)database=new Promise<IDBDatabase>((resolve,reject)=>{
  if(!globalThis.indexedDB){reject(Error('This browser cannot cache the card catalog.'));return}
  const request=indexedDB.open('holocron-catalog-cache',1);
  request.onupgradeneeded=()=>request.result.createObjectStore('catalog');
  request.onerror=()=>{database=undefined;reject(request.error||Error('The card catalog cache could not open.'))};
  request.onsuccess=()=>{request.result.onversionchange=()=>{request.result.close();database=undefined};resolve(request.result)};
 });
 return database;
}
export async function readCachedCatalog():Promise<Catalog|undefined>{
 const db=await openCatalogStore();
 return new Promise((resolve,reject)=>{
  const tx=db.transaction('catalog','readonly'),request=tx.objectStore('catalog').get('current');
  tx.oncomplete=()=>resolve(request.result);
  tx.onabort=()=>reject(tx.error||Error('The cached catalog could not be read.'));
  tx.onerror=()=>{};
 });
}
export async function cacheCatalog(catalog:Catalog):Promise<void>{
 const db=await openCatalogStore();
 return new Promise((resolve,reject)=>{
  const tx=db.transaction('catalog','readwrite');
  tx.objectStore('catalog').put(catalog,'current');
  tx.oncomplete=()=>resolve();
  tx.onabort=()=>reject(tx.error||Error('The refreshed catalog could not be cached.'));
  tx.onerror=()=>{};
 });
}
