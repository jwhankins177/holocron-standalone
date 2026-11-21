export type SyncSessionStorage={getItem:(key:string)=>string|null};
export type SyncSession={token:string;userId:number;serverUrl:string};

export function readSyncSession(storage:SyncSessionStorage,normalizeUrl:(value:string)=>string):SyncSession|null{
 try{
  const token=storage.getItem('holocron-sync-token');
  const rawUserId=storage.getItem('holocron-sync-user-id');
  const syncUrl=storage.getItem('holocron-sync-url');
  const authUrl=storage.getItem('holocron-sync-auth-url');
  const userId=Number(rawUserId);
  if(!token||!syncUrl||!authUrl||!Number.isSafeInteger(userId)||userId<=0)return null;
  const serverUrl=normalizeUrl(authUrl);
  if(normalizeUrl(syncUrl)!==serverUrl)return null;
  return {token,userId,serverUrl};
 }catch{return null}
}
