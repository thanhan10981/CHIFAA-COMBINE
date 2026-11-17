/* Public shell only. Never cache authenticated HTML, Auth, APIs or Supabase. */
const CACHE='chifaa-shell-v1';
self.addEventListener('install',event=>{event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(['/offline','/logo-chifaa.png'])));});
self.addEventListener('activate',event=>{event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key.startsWith('chifaa-shell-')&&key!==CACHE).map(key=>caches.delete(key)))));});
self.addEventListener('fetch',event=>{
 const request=event.request,url=new URL(request.url);
 if(request.method!=='GET'||url.origin!==self.location.origin)return;
 if(request.mode==='navigate'){event.respondWith(fetch(request).catch(()=>caches.match('/offline').then(cached=>cached||Response.error())));return;}
 if(url.pathname.startsWith('/_next/static/')||url.pathname==='/logo-chifaa.png')event.respondWith(caches.open(CACHE).then(async cache=>{const saved=await cache.match(request);if(saved)return saved;const response=await fetch(request);if(response.ok)await cache.put(request,response.clone());return response;}));
});
