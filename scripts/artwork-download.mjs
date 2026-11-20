export async function downloadArtwork(url,{fetchImpl=fetch,attempts=3,wait=ms=>new Promise(resolve=>setTimeout(resolve,ms))}={}){
  let lastError;
  for(let attempt=0;attempt<attempts;attempt++){
    let response;
    try{
      response=await fetchImpl(url,{signal:AbortSignal.timeout(30000)});
    }catch(error){
      lastError=Error(`Could not fetch artwork: ${url} (${error instanceof Error?error.message:String(error)})`);
    }
    if(response){
      if(!response.ok){
        lastError=Error(`Could not fetch artwork: ${url} (HTTP ${response.status})`);
        if(response.status!==429&&response.status<500)throw lastError;
      }else if(!response.headers.get('content-type')?.startsWith('image/')){
        throw Error(`Could not fetch artwork: ${url} (HTTP ${response.status})`);
      }else{
        try{return Buffer.from(await response.arrayBuffer())}
        catch(error){lastError=Error(`Could not fetch artwork: ${url} (${error instanceof Error?error.message:String(error)})`)}
      }
    }
    if(attempt+1<attempts)await wait(1000*2**attempt);
  }
  throw lastError||Error(`Could not fetch artwork: ${url}`);
}
