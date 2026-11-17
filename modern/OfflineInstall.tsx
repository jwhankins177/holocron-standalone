import {useEffect, useState} from 'react';

type Progress = {done:number; total:number; error?:string};

export default function OfflineInstall(){
 const [progress,setProgress]=useState<Progress|null>(null);
 const [busy,setBusy]=useState(false);
 const supported=location.protocol==='https:'&&'serviceWorker' in navigator&&'caches' in window;

 async function send(type:string,receive:(message:Progress)=>void){
  await navigator.serviceWorker.register('./sw.js');
  const registration=await navigator.serviceWorker.ready;
  if(!registration.active)throw Error('Offline installation is unavailable.');
  const channel=new MessageChannel();
  channel.port1.onmessage=event=>{
   receive(event.data);
   if(event.data.error||type==='status'||event.data.done===event.data.total)channel.port1.close();
  };
  registration.active.postMessage(type,[channel.port2]);
 }

 useEffect(()=>{if(supported)void send('status',setProgress).catch(()=>{})},[supported]);

 if(!supported)return null;
 const ready=!!progress?.total&&progress.done===progress.total;
 async function install(){
  setBusy(true);
  setProgress(null);
  try{
   await send('install-art',message=>{
    setProgress(message);
    if(message.error||message.done===message.total)setBusy(false);
   });
  }catch(error){
   setProgress({done:0,total:0,error:error instanceof Error?error.message:'Offline installation failed.'});
   setBusy(false);
  }
 }
 return <>
  <button disabled={busy||ready} onClick={install}>
   {ready?'Ready for offline use':busy?'Saving artwork…':'Save for offline use'}
  </button>
  {progress&&<small role="status">{progress.error||(busy&&progress.total?
   (Math.floor(progress.done/progress.total*100)+'% of artwork saved'):'')}</small>}
 </>;
}
