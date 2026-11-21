import type {Catalog,Workspace} from './model.ts';

export type SyncUser={id:number};
export type SyncAccount={username:string|null};
export type RemoteWorkspace={revision:number;updatedAt:string;data:Workspace};

export function explainSyncError(error:unknown,fallback:string){
 if((error as {detail?:{error?:string}})?.detail?.error==='registration_disabled')
  return 'Account creation is disabled on this server. The server owner must set HOLOCRON_REGISTRATION_CODE to a private invite code and restart or redeploy the server.';
 return error instanceof Error?error.message:fallback;
}

export function normalizeSyncUrl(value:string){
 const url=new URL(value.trim());
 if(!['http:','https:'].includes(url.protocol)||url.username||url.password||url.search||url.hash||url.pathname!=='/')throw Error('Enter a valid sync server origin without a path, query, or credentials.');
 if(url.protocol==='http:'&&!['localhost','127.0.0.1','[::1]'].includes(url.hostname))throw Error('Use HTTPS for a sync server outside this device.');
 return url.href.replace(/\/+$/,'');
}

async function request<T>(base:string,path:string,token?:string,options:RequestInit={}):Promise<T>{
 const response=await fetch(base+path,{
  ...options,
  headers:{...(options.body?{'Content-Type':'application/json'}:{}),...(token?{Authorization:'Bearer '+token}:{}),...options.headers},
  signal:options.signal||AbortSignal.timeout(20000),
 });
 if(!response.ok){
  let detail:{error?:string;message?:string}={};
  try{detail=await response.json()}catch{}
  const error=Error(detail.message||detail.error||`Sync server returned HTTP ${response.status}.`);
  Object.assign(error,{status:response.status,detail});
  throw error;
 }
 return response.json() as Promise<T>;
}

export function registerAccount(base:string,username:string,password:string,inviteCode:string){
 return request<{token:string;user:SyncUser}>(base,'/api/auth/register',undefined,{method:'POST',body:JSON.stringify({username,password,inviteCode})});
}
export function loginAccount(base:string,username:string,password:string){
 return request<{token:string;user:SyncUser}>(base,'/api/auth/login',undefined,{method:'POST',body:JSON.stringify({username,password})});
}
export function getSyncAccount(base:string,token:string){
 return request<SyncAccount>(base,'/api/auth/account',token);
}
export function setSyncAccountCredentials(base:string,token:string,username:string,password:string,inviteCode:string){
 return request<SyncAccount>(base,'/api/auth/credentials',token,{method:'POST',body:JSON.stringify({username,password,inviteCode})});
}
export function logoutAccount(base:string,token:string){
 return request<{ok:boolean}>(base,'/api/auth/logout',token,{method:'POST'});
}
export function logoutAllAccounts(base:string,token:string){
 return request<{ok:boolean}>(base,'/api/auth/logout-all',token,{method:'POST'});
}
export function getRemoteWorkspace(base:string,token:string){
 return request<RemoteWorkspace>(base,'/api/workspace',token);
}
export function putRemoteWorkspace(base:string,token:string,expectedRevision:number,data:Workspace){
 return request<{revision:number;updatedAt:string}>(base,'/api/workspace',token,{method:'PUT',body:JSON.stringify({expectedRevision,data})});
}

export function validateCatalog(value:unknown):Catalog{
 if(!value||typeof value!=='object')throw Error('The server returned an invalid card catalog.');
 const catalog=value as Partial<Catalog>;
 if(!Array.isArray(catalog.cards)||catalog.cards.length>30000||!Array.isArray(catalog.sets)||typeof catalog.updated!=='string')throw Error('The server returned an invalid card catalog.');
 const ids=new Set<string>();
 for(const card of catalog.cards){
  if(!card||typeof card.id!=='string'||!card.id||ids.has(card.id)||typeof card.name!=='string'||typeof card.image!=='string')throw Error('The server returned an invalid card catalog.');
  ids.add(card.id);
 }
 return catalog as Catalog;
}
export async function getRemoteCatalog(base:string):Promise<Catalog>{
 return validateCatalog(await request<unknown>(base,'/api/catalog'));
}
export async function refreshRemoteCatalog(base:string):Promise<Catalog>{
 return validateCatalog(await request<unknown>(base,'/api/catalog/refresh',undefined,{method:'POST'}));
}
