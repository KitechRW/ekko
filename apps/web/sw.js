/* EKKO PWA shell: cache public static assets only. Never cache API status, Studio, or YouTube streams. */
const CACHE="ekko-public-shell-v1";
const ASSETS=["/","/styles.css","/immersive.css","/viewer.js","/assets/logo-light.svg","/assets/icon.svg","/assets/icon.png","/assets/site.webmanifest"];
self.addEventListener("install",event=>{
  event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(ASSETS)).then(()=>self.skipWaiting()));
});
self.addEventListener("activate",event=>{
  event.waitUntil(Promise.all([
    caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith("ekko-public-shell-")&&k!==CACHE).map(k=>caches.delete(k)))),
    self.clients.claim()
  ]));
});
self.addEventListener("fetch",event=>{
  const request=event.request;
  if(request.method!=="GET")return;
  const url=new URL(request.url);
  if(url.origin!==self.location.origin)return;
  if(url.pathname.startsWith("/api/")||url.pathname.startsWith("/admin")||url.pathname==="/sw.js")return;
  if(request.mode==="navigate"){
    if(url.pathname!=="/")return;
    event.respondWith(fetch(request).then(response=>{
      if(response.ok){const copy=response.clone();event.waitUntil(caches.open(CACHE).then(c=>c.put("/",copy)));}
      return response;
    }).catch(()=>caches.match("/")));
    return;
  }
  if(!ASSETS.includes(url.pathname))return;
  // Network-first prevents stale app JavaScript or CSS after a new EKKO release.
  event.respondWith(fetch(request).then(response=>{
    if(response.ok){const copy=response.clone();event.waitUntil(caches.open(CACHE).then(c=>c.put(request,copy)));}
    return response;
  }).catch(()=>caches.match(request)));
});