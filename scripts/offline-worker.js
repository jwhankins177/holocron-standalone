const scope = self.registration.scope;
const url = path => new URL(path,scope).href;
const manifestUrl = url('offline-manifest.json');
const readyUrl = url('offline-art-ready');
let transfer;

async function loadManifest(cache){
 const cached=await cache.match(manifestUrl);
 return (cached||await fetch(manifestUrl,{cache:'no-store'})).json();
}

self.addEventListener('install',event=>{
 event.waitUntil((async()=>{
  const cache=await caches.open(cacheKey);
  const manifest=await loadManifest(cache);
  if(manifest.key!==cacheKey)throw Error('Offline files are from different builds.');
  await cache.addAll(manifest.shell.map(url));
  await cache.put(manifestUrl,new Response(JSON.stringify(manifest),{headers:{'Content-Type':'application/json'}}));
 })());
});

self.addEventListener('activate',event=>event.waitUntil(self.clients.claim()));

self.addEventListener('fetch',event=>{
 const {request}=event;
 if(request.method!=='GET'||!request.url.startsWith(scope))return;
 event.respondWith((async()=>{
  const cache=await caches.open(cacheKey);
  return await cache.match(request,{ignoreSearch:true})||fetch(request);
 })());
});

self.addEventListener('message',event=>{
 if(event.data==='skip-waiting'){
  event.waitUntil(self.skipWaiting());
  return;
 }
 const client=event.ports[0];
 if(!client||!['status','install-art'].includes(event.data))return;
 event.waitUntil((async()=>{
  const cache=await caches.open(cacheKey);
  const {art}=await loadManifest(cache);
  const total=art.length;
  if(await cache.match(readyUrl)){
   client.postMessage({done:total,total});
   return;
  }
  if(event.data==='status'){
   client.postMessage({done:0,total});
   return;
  }
  if(transfer)throw Error('Artwork is already being saved in another window.');
  let done=0;
  const entries=art.values();
  transfer=Promise.allSettled(Array.from({length:8},async()=>{
   for(const path of entries){
    const image=url(path);
    if(!await cache.match(image))await cache.add(image);
    done++;
    if(done%100===0&&done<total)client.postMessage({done,total});
   }
  }));
  try{
   const results=await transfer;
   if(results.some(result=>result.status==='rejected')||done!==total){
    throw Error('Artwork download paused. Reopen this menu to retry.');
   }
   await cache.put(readyUrl,new Response('ready'));
   client.postMessage({done,total});
  }finally{
   transfer=undefined;
  }
 })().catch(error=>client.postMessage({done:0,total:0,error:error.message})));
});
