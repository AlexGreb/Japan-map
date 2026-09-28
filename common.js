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

// Цены: сумма входов и транспорта за день / за поездку (ориентировочно)
const fmtYen=n=>n.toLocaleString('ru-RU').replace(/ /g,' ')+'¥';
function dayBudget(d){return d.stops.reduce((a,s)=>a+(s.yen||0),0);}
function tripBudget(){return DAYS.reduce((a,d)=>a+dayBudget(d),0);}

// Часы работы: предупреждение, если по плану приходим поздно
const toMin=t=>{const m=/^(\d{1,2}):(\d{2})$/.exec(t||'');return m?+m[1]*60+ +m[2]:null;};
function hoursWarn(s){
  const t=toMin(s.time),c=toMin(s.close);
  if(t===null||c===null)return null;
  if(t>=c)return {bad:true,text:`⛔ Закрывается в ${s.close}, а по плану вы приходите в ${s.time} — поменяйте порядок!`};
  if(c-t<=60)return {bad:false,text:`⚠️ Закрывается в ${s.close} — у вас меньше часа, не задерживайтесь по пути`};
  return null;
}

// Погода: прогноз Open-Meteo (бесплатно, без ключа, до 16 дней вперёд), иначе — «обычно в эти дни»
function wxEmoji(c){return c===0?'☀️':c<=2?'🌤':c===3?'☁️':c<=48?'🌫':c<=57?'🌦':c<=67?'🌧':c<=77?'🌨':c<=82?'🌧':'⛈';}
async function loadWeather(){
  try{const c=JSON.parse(store.get('wx')||'null');if(c&&Date.now()-c.ts<3*3600e3)return c.data;}catch(e){}
  const data={};
  await Promise.all(Object.keys(CLIMATE).map(async ck=>{
    const d=DAYS.find(x=>x.ck===ck);const p=d&&d.places?d.places[0]:d&&d.stops.find(s=>!s.move);
    if(!p)return;
    try{
      const r=await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${p.lat}&longitude=${p.lng}`+
        `&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max&timezone=Asia%2FTokyo&forecast_days=16`);
      const j=await r.json();const dl=j.daily;if(!dl)return;
      data[ck]={};dl.time.forEach((t,i)=>data[ck][t]={code:dl.weather_code[i],max:Math.round(dl.temperature_2m_max[i]),
        min:Math.round(dl.temperature_2m_min[i]),pp:dl.precipitation_probability_max[i]});
    }catch(e){}
  }));
  if(Object.keys(data).length)store.set('wx',JSON.stringify({ts:Date.now(),data}));
  return data;
}
function wxHtml(d,wx){
  const w=wx&&wx[d.ck]&&wx[d.ck][d.iso];
  if(w)return `<span class="wx" title="Прогноз погоды">${wxEmoji(w.code)} ${w.max}° / ${w.min}°${w.pp!=null&&w.pp>=20?` · 💧${w.pp}%`:''}</span>`;
  const c=CLIMATE[d.ck];
  return `<span class="wx clim" title="Прогноз появится примерно за 2 недели">обычно ≈${c.max}° / ${c.min}°</span>`;
}

// Офлайн-режим: сохраняем страницу в телефоне (работает только по https, например на GitHub Pages)
if('serviceWorker' in navigator&&location.protocol==='https:'){
  window.addEventListener('load',()=>navigator.serviceWorker.register('sw.js').catch(()=>{}));
}
