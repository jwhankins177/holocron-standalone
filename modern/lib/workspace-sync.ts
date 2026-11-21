import type {Workspace} from './model.ts';
import type {RemoteWorkspace} from './sync-api.ts';

type SavedRemote={revision:number;updatedAt:string};
type SyncSnapshot={
 data:Workspace;
 localRevision:number;
 cursor:number|null;
 synced:{remoteRevision:number;localRevision:number}|null;
 read:()=>Promise<RemoteWorkspace>;
 write:(revision:number,data:Workspace)=>Promise<SavedRemote>;
};

export async function syncSnapshot(input:SyncSnapshot){
 let remote:RemoteWorkspace;
 try{remote=await input.read()}
 catch(error){
  if((error as Error&{status?:number}).status!==404)throw error;
  const saved=await input.write(0,input.data);
  return {kind:'created' as const,saved,localRevision:input.localRevision};
 }
 if(input.cursor===null||input.cursor!==remote.revision)return {kind:'conflict' as const,remote};
 if(input.synced?.remoteRevision===remote.revision&&input.synced.localRevision===input.localRevision)
  return {kind:'unchanged' as const,saved:remote,localRevision:input.localRevision};
 const saved=await input.write(remote.revision,input.data);
 return {kind:'saved' as const,saved,localRevision:input.localRevision};
}
