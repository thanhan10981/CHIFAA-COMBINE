// Persist only an opaque application session and its non-exportable signing key.
// Never store Google credentials, raw key material, identities or business rows.
async function sessionStore(scope,operation,value){
  if(!/^[a-f0-9]{64}$/.test(scope||'')||!globalThis.indexedDB)return null;
  return new Promise(resolve=>{
    let db,done=false;
    const finish=result=>{if(done)return;done=true;clearTimeout(timer);db?.close();resolve(result);};
    const timer=setTimeout(()=>finish(null),3000);
    try{
      const request=indexedDB.open('chifaa-session-v1',1);
      request.onupgradeneeded=()=>request.result.createObjectStore('sessions');
      request.onerror=request.onblocked=()=>finish(null);
      request.onsuccess=()=>{
        db=request.result;if(done){db.close();return;}
        try{
          const tx=db.transaction('sessions',operation==='get'?'readonly':'readwrite'),store=tx.objectStore('sessions');
          const query=operation==='get'?store.get(scope):operation==='put'?store.put(value,scope):store.delete(scope);
          let result;query.onsuccess=()=>{result=query.result;};
          tx.oncomplete=()=>finish(operation==='get'?result:true);
          tx.onerror=tx.onabort=()=>finish(null);
        }catch(_){finish(null);}
      };
    }catch(_){finish(null);}
  });
}
function validStoredSession(saved){
  const key=saved?.key;
  return typeof saved?.token==='string'&&/^[a-f0-9]{64}$/.test(saved.token)&&Date.parse(saved.expires)>Date.now()
    &&key?.type==='secret'&&key.extractable===false&&key.algorithm?.name==='HMAC'&&key.algorithm?.hash?.name==='SHA-256'
    &&key.usages?.length===1&&key.usages[0]==='sign';
}
export {sessionStore,validStoredSession};
