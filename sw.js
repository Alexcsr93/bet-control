// Bancô — service worker. Ao publicar uma versão nova, troque o número abaixo.
// Só mexe nos caches que começam com "banco-", para não apagar o cache dos outros apps do mesmo domínio.
const PREFIXO='banco-';
const CACHE=PREFIXO+'v3';
const FILES=['./','./index.html','./config.js','./cloud.js','./manifest.json','./icon-192.png','./icon-512.png','./icon-maskable-512.png'];
self.addEventListener('install',e=>{e.waitUntil(caches.open(CACHE).then(c=>c.addAll(FILES)));self.skipWaiting()});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k.startsWith(PREFIXO)&&k!==CACHE).map(k=>caches.delete(k)))));self.clients.claim()});
self.addEventListener('fetch',e=>{
  const req=e.request,url=new URL(req.url);
  if(req.method!=='GET')return;
  if(url.hostname==='www.gstatic.com'&&url.pathname.startsWith('/firebasejs/')){
    e.respondWith(caches.match(req,{cacheName:CACHE}).then(c=>c||fetch(req).then(r=>{const cp=r.clone();caches.open(CACHE).then(ca=>ca.put(req,cp));return r})));return}
  if(url.origin!==location.origin)return;
  // Só responde pelo que é do Bancô (/banco/...). Os outros apps cuidam dos próprios arquivos.
  if(!url.pathname.startsWith(new URL(self.registration.scope).pathname))return;
  e.respondWith(fetch(req).then(r=>{const cp=r.clone();caches.open(CACHE).then(c=>c.put(req,cp));return r}).catch(()=>caches.open(CACHE).then(c=>c.match(req,{ignoreSearch:true}))));
});
