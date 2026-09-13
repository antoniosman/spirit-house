const CACHE='spirit-house-v6';
const ASSETS=['./','index.html','style.css','app.js','engine.js','manifest.webmanifest','icon.svg','apple-touch-icon.png','intro_music.mp3',...['Alex.webp','Billy.webp','Catherine.png','demarin.webp','elisa.webp','Eva.png','Evaggelia.png','evelyn.webp','hope.webp','Ian.png','irene.png','Jasmine.png','Luna.webp','pauline.webp','Paul.png','phillip.webp','rino.webp','sargenie.jpeg','smaragda.jpeg','Sorina.png','tony.webp','vicky.jpg','Vincent.jpg','Violet.png','zoe.jpeg','Ester.png'].map(x=>'characters/'+x)];
self.addEventListener('install',e=>{e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS)));self.skipWaiting()});
self.addEventListener('message',e=>{if(e.data==='SKIP_WAITING')self.skipWaiting()});
self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('spirit-house-')&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',e=>{if(e.request.method!=='GET'||new URL(e.request.url).origin!==self.location.origin)return;e.respondWith(caches.match(e.request).then(cached=>cached||fetch(e.request)));});
