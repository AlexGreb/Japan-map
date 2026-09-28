// Общие функции для index.html и schedule.html

// localStorage может быть недоступен (приватный режим) — не ломаемся
const store={
  get(k){try{return localStorage.getItem(k);}catch(e){return null;}},
  set(k,v){try{if(v===null)localStorage.removeItem(k);else localStorage.setItem(k,v);}catch(e){}}
};

// Тема: auto (как в системе) → light → dark
function isDark(){
  const t=document.documentElement.dataset.theme;
  if(t)return t==='dark';
  return window.matchMedia&&matchMedia('(prefers-color-scheme: dark)').matches;
}
function themeLabel(){const t=document.documentElement.dataset.theme;return t==='dark'?'🌙':t==='light'?'☀️':'🌓';}
function cycleTheme(){
  const t=document.documentElement.dataset.theme;
  const next=!t?'light':t==='light'?'dark':null;
  if(next)document.documentElement.dataset.theme=next;else delete document.documentElement.dataset.theme;
  store.set('theme',next);
  document.dispatchEvent(new Event('themechange'));
}
function bindThemeButton(btn){
  const upd=()=>{btn.textContent=themeLabel();btn.title='Тема: '+({'🌓':'как в системе','☀️':'светлая','🌙':'тёмная'})[themeLabel()];};
  upd();btn.addEventListener('click',()=>{cycleTheme();upd();});
}

// Сегодняшняя дата в Японии (YYYY-MM-DD)
function todayJP(){return new Date().toLocaleDateString('sv-SE',{timeZone:'Asia/Tokyo'});}
function todayDay(){return DAYS.find(d=>d.iso===todayJP())||null;}
function daysUntilTrip(){
  const ms=new Date(DAYS[0].iso+'T00:00:00+09:00')-new Date(todayJP()+'T00:00:00+09:00');
  return Math.round(ms/864e5);
}

// Ссылки в Google Maps
function placeLink(s){return s.url||('https://www.google.com/maps/search/?api=1&query='+s.lat+','+s.lng);}
function routeLink(s){return 'https://www.google.com/maps/dir/?api=1&destination='+s.lat+','+s.lng+'&travelmode=transit';}
function hotelLink(h){return 'https://www.google.com/maps/search/?api=1&query='+encodeURIComponent(h.name.replace('♨️','').trim())+'&query_place_id='+h.pid;}

// Офлайн-режим: сохраняем страницу в телефоне (работает только по https, например на GitHub Pages)
if('serviceWorker' in navigator&&location.protocol==='https:'){
  window.addEventListener('load',()=>navigator.serviceWorker.register('sw.js').catch(()=>{}));
}
