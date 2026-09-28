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
function symEmoji(s){return /thunder/.test(s)?'⛈':/snow|sleet/.test(s)?'🌨':/heavyrain/.test(s)?'🌧':/rain/.test(s)?'🌦':
  /fog/.test(s)?'🌫':/clearsky/.test(s)?'☀️':/fair/.test(s)?'🌤':/partlycloudy/.test(s)?'⛅':'☁️';}
// запрос с тайм-аутом, чтобы заблокированный сервис не «висел»
function fetchT(url,ms=8000){const c=new AbortController();const t=setTimeout(()=>c.abort(),ms);
  return fetch(url,{signal:c.signal}).then(r=>{clearTimeout(t);if(!r.ok)throw new Error(r.status);return r;});}
async function loadWeather(){
  try{const c=JSON.parse(store.get('wx2')||'null');if(c&&Date.now()-c.ts<3*3600e3)return c.data;}catch(e){}
  const data={};
  await Promise.all(Object.keys(CLIMATE).map(async ck=>{
    const d=DAYS.find(x=>x.ck===ck);const p=d&&d.stops.find(s=>!s.move);
    if(!p)return;
    const lat=(+p.lat).toFixed(3),lng=(+p.lng).toFixed(3);
    try{ // 1) Open-Meteo: 16 дней, вероятность дождя
      const r=await fetchT(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}`+
        `&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max&timezone=Asia%2FTokyo&forecast_days=16`);
      const dl=(await r.json()).daily;
      data[ck]={};dl.time.forEach((t,i)=>data[ck][t]={e:wxEmoji(dl.weather_code[i]),max:Math.round(dl.temperature_2m_max[i]),
        min:Math.round(dl.temperature_2m_min[i]),pp:dl.precipitation_probability_max[i]});
      return;
    }catch(e){}
    try{ // 2) запасной — MET Norway: ~9 дней, почасовые данные сводим в дни по японскому времени
      const r=await fetchT(`https://api.met.no/weatherapi/locationforecast/2.0/compact?lat=${lat}&lon=${lng}`);
      const ts=(await r.json()).properties.timeseries;const days={};
      ts.forEach(t=>{const loc=new Date(t.time).toLocaleString('sv-SE',{timeZone:'Asia/Tokyo'});const iso=loc.slice(0,10),h=+loc.slice(11,13);
        const x=days[iso]=days[iso]||{max:-99,min:99,mm:0,sym:null,dh:99};
        const temp=t.data.instant.details.air_temperature;x.max=Math.max(x.max,temp);x.min=Math.min(x.min,temp);
        const n1=t.data.next_1_hours,n6=t.data.next_6_hours;
        if(n1)x.mm+=n1.details.precipitation_amount||0;
        const sym=(n1||n6)&&(n1||n6).summary.symbol_code;if(sym&&Math.abs(h-12)<x.dh){x.sym=sym;x.dh=Math.abs(h-12);}});
      data[ck]={};Object.entries(days).forEach(([iso,x])=>{if(x.sym)data[ck][iso]={e:symEmoji(x.sym),max:Math.round(x.max),min:Math.round(x.min),mm:Math.round(x.mm)};});
    }catch(e){}
  }));
  if(Object.keys(data).length)store.set('wx2',JSON.stringify({ts:Date.now(),data}));
  return data;
}
function wxHtml(d,wx){
  const w=wx&&wx[d.ck]&&wx[d.ck][d.iso];
  if(w)return `<span class="wx" title="Прогноз погоды">${w.e} ${w.max}° / ${w.min}°${w.pp!=null&&w.pp>=20?` · 💧${w.pp}%`:''}${w.mm>=1?` · 💧${w.mm} мм`:''}</span>`;
  const c=CLIMATE[d.ck];
  return `<span class="wx clim" title="Прогноз появится примерно за 2 недели">обычно ≈${c.max}° / ${c.min}°</span>`;
}

// Офлайн-режим: сохраняем страницу в телефоне (работает только по https, например на GitHub Pages)
if('serviceWorker' in navigator&&location.protocol==='https:'){
  window.addEventListener('load',()=>navigator.serviceWorker.register('sw.js').catch(()=>{}));
}
