import {useEffect, useState} from 'react';

type Progress = {done:number; total:number; error?:string};

export default function OfflineInstall(){
 const [progress,setProgress]=useState<Progress|null>(null);
 const [busy,setBusy]=useState(false);
 const [updateBusy,setUpdateBusy]=useState(false);
 const [updateMessage,setUpdateMessage]=useState('');
 const supported=location.protocol==='https:'&&'serviceWorker' in navigator&&'caches' in window;

 async function send(type:string,receive:(message:Progress)=>void){
  await navigator.serviceWorker.register('./sw.js',{updateViaCache:'none'});
  const registration=await navigator.serviceWorker.ready;
  if(!registration.active)throw Error('Offline installation is unavailable.');
  const channel=new MessageChannel();
  channel.port1.onmessage=event=>{
   receive(event.data);
   if(event.data.error||type==='status'||event.data.done===event.data.total)channel.port1.close();
  };
  registration.active.postMessage(type,[channel.port2]);
 }

 async function refreshSite(){
  setUpdateBusy(true);
  setUpdateMessage('');
  try{
   const registration=await navigator.serviceWorker.register('./sw.js',{updateViaCache:'none'});
   let worker=registration.waiting;
   if(!worker){
    await registration.update();
    worker=registration.waiting;
   }
   if(!worker&&registration.installing){
    const installing=registration.installing;
    worker=await new Promise<ServiceWorker|null>((resolve,reject)=>{
     const timeout=window.setTimeout(()=>{installing.removeEventListener('statechange',onStateChange);reject(Error('The site update is taking too long. Try again later.'))},30000);
     const onStateChange=()=>{
      if(installing.state==='installed'||installing.state==='redundant'){
       window.clearTimeout(timeout);
       installing.removeEventListener('statechange',onStateChange);
       resolve(installing.state==='installed'?registration.waiting||installing:null);
      }
     };
     installing.addEventListener('statechange',onStateChange);
     onStateChange();
    });
   }
   if(!worker){setUpdateMessage('This site is already up to date.');return}
   const controlChanged=new Promise<void>((resolve,reject)=>{
    const timeout=window.setTimeout(()=>{
     navigator.serviceWorker.removeEventListener('controllerchange',onControllerChange);
     reject(Error('The update was installed but could not take control. Close other site tabs and try again.'));
    },15000);
    const onControllerChange=()=>{
     window.clearTimeout(timeout);
     resolve();
    };
    navigator.serviceWorker.addEventListener('controllerchange',onControllerChange,{once:true});
   });
   worker.postMessage('skip-waiting');
   await controlChanged;
   window.location.reload();
  }catch(error){
   setUpdateMessage(error instanceof Error?error.message:'Unable to refresh the site.');
  }finally{setUpdateBusy(false)}
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
  <button disabled={busy||updateBusy} onClick={()=>void refreshSite()}>
   {updateBusy?'Checking for updates…':'Refresh site'}
  </button>
  <small>Checks for the latest version without clearing your sign-in or collection.</small>
  {updateMessage&&<small role="status">{updateMessage}</small>}
  <button disabled={busy||updateBusy||ready} onClick={install}>
   {ready?'Ready for offline use':busy?'Saving artwork…':'Save for offline use'}
  </button>
  {progress&&<small role="status">{progress.error||(busy&&progress.total?
   (Math.floor(progress.done/progress.total*100)+'% of artwork saved'):'')}</small>}
 </>;
}
