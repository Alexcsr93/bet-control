// Bancô — service worker. Ao publicar uma versão nova, troque o número abaixo.
const CACHE='banco-v2';
const FILES=['./','./index.html','./config.js','./cloud.js','./manifest.json','./icon-192.png','./icon-512.png','./icon-maskable-512.png'];
self.addEventListener('install',e=>{e.waitUntil(caches.open(CACHE).then(c=>c.addAll(FILES)));self.skipWaiting()});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==CACHE).map(k=>caches.delete(k)))));self.clients.claim()});
self.addEventListener('fetch',e=>{
  const req=e.request,url=new URL(req.url);
  if(req.method!=='GET')return;
  // Bibliotecas do Firebase: guarda no aparelho para abrir offline
  if(url.hostname==='www.gstatic.com'&&url.pathname.startsWith('/firebasejs/')){
    e.respondWith(caches.match(req).then(c=>c||fetch(req).then(r=>{const cp=r.clone();caches.open(CACHE).then(ca=>ca.put(req,cp));return r})));return}
  // Login e banco de dados: nunca passam pelo cache
  if(url.origin!==location.origin)return;
  e.respondWith(fetch(req).then(r=>{const cp=r.clone();caches.open(CACHE).then(c=>c.put(req,cp));return r}).catch(()=>caches.match(req,{ignoreSearch:true})));
});
