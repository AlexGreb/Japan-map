// Офлайн-режим: при первом открытии сохраняет страницу, фото и основу карты в телефоне.
// После изменения файлов увеличьте VERSION, чтобы телефоны забрали новую версию.
const VERSION='v1';

const IMGS=['akihabara.png','arashiyama.jpg','dotonbori.jpg','fushimi-inari.jpg','imperial-palace.jpg','kamakura.jpg',
  'kinkakuji.jpg','kiyomizu.jpg','meiji.jpg','nara-park.jpg','osaka-castle.jpg','sensoji.jpg','shibuya.jpg',
  'shinjuku-gyoen.jpg','todaiji.jpg','toyosu.jpg'];
// диапазоны локальных тайлов в папке tiles/: [zoom, x от, x до, y от, y до]
const TILE_RANGES=[[4,13,14,5,6],[5,27,28,11,13],[6,54,57,23,26],[7,111,113,50,51],[8,223,227,100,102],[9,447,455,200,204]];

const CORE=['./','index.html','schedule.html','data.js','common.js','common.css','manifest.webmanifest','icon.svg',
  'vendor/leaflet/leaflet.js','vendor/leaflet/leaflet.css',
  ...['layers.png','layers-2x.png','marker-icon.png','marker-icon-2x.png','marker-shadow.png'].map(f=>'vendor/leaflet/images/'+f),
  ...IMGS.map(f=>'img/'+f)];
for(const [z,x0,x1,y0,y1] of TILE_RANGES)
  for(let x=x0;x<=x1;x++)for(let y=y0;y<=y1;y++)CORE.push(`tiles/${z}/${x}/${y}.png`);

const CORE_CACHE='core-'+VERSION, TILE_CACHE='tiles-'+VERSION, MAX_TILES=1500;

self.addEventListener('install',e=>{
  e.waitUntil(caches.open(CORE_CACHE).then(c=>c.addAll(CORE)).then(()=>self.skipWaiting()));
});
self.addEventListener('activate',e=>{
  e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>!k.endsWith(VERSION)).map(k=>caches.delete(k))))
    .then(()=>self.clients.claim()));
});

async function trim(cache){
  const keys=await cache.keys();
  for(let i=0;i<keys.length-MAX_TILES;i++)await cache.delete(keys[i]);
}

self.addEventListener('fetch',e=>{
  const req=e.request;if(req.method!=='GET')return;
  const url=new URL(req.url);

  // страницы и данные: сначала сеть (чтобы видеть обновления), без сети — из кэша
  if(url.origin===location.origin&&(req.mode==='navigate'||/\.(html|js|css|webmanifest)$/.test(url.pathname))){
    e.respondWith(fetch(req).then(r=>{
      if(r.ok){const cp=r.clone();caches.open(CORE_CACHE).then(c=>c.put(req,cp));}
      return r;
    }).catch(()=>caches.match(req,{ignoreSearch:true}).then(r=>r||caches.match('index.html'))));
    return;
  }
  // кусочки карты из интернета и шрифты: сначала кэш, потом сеть с сохранением (просмотренные места доступны офлайн)
  if(/tile\.openstreetmap\.org|arcgisonline\.com|fonts\.(googleapis|gstatic)\.com/.test(url.host)){
    e.respondWith(caches.open(TILE_CACHE).then(async c=>{
      const hit=await c.match(req);if(hit)return hit;
      const r=await fetch(req);
      if(r.ok||r.type==='opaque'){c.put(req,r.clone());trim(c);}
      return r;
    }));
    return;
  }
  // остальное локальное (фото, тайлы, leaflet): сначала кэш
  if(url.origin===location.origin){
    e.respondWith(caches.match(req).then(r=>r||fetch(req)));
  }
});
