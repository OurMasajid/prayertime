// PrayerTime - Prayer times, Qibla direction, and Azan notifications
// Frontend-only application using Adhan.js for prayer calculations

document.addEventListener('DOMContentLoaded', function(){
  // Optional local Adhan audio (place `adhan.mp3` next to index.html)
  (function addAudioElement(){
    const a = document.createElement('audio');
    a.id = 'adhanAudio';
    a.src = 'adhan.mp3';
    a.preload = 'auto';
    a.crossOrigin = 'anonymous';
    document.body.appendChild(a);
  })();

  // Constants
  const KAABA = {lat: 21.422487, lon: 39.826206};

  const state = {lat:null,lon:null,timings:{},timeouts:[],notificationsEnabled:false};

  // Helpers
  function el(id){return document.getElementById(id)}
  
  function formatTime(date){
    if(!date) return '--:--';
    const H = date.getHours(); const M = date.getMinutes();
    return String(H).padStart(2,'0') + ':' + String(M).padStart(2,'0');
  }

  function getLocalPrayerTimes(lat, lon, settings){
    try{
      const coords = new adhan.Coordinates(lat, lon);
      let params = null;
      switch((settings && settings.method) || 'MWL'){
        case 'ISNA': params = adhan.CalculationMethod.NorthAmerica(); break;
        case 'Egypt': params = adhan.CalculationMethod.Egyptian(); break;
        case 'Makkah': params = adhan.CalculationMethod.UmmAlQura(); break;
        case 'Karachi': params = adhan.CalculationMethod.Karachi(); break;
        case 'Tehran': params = adhan.CalculationMethod.Tehran(); break;
        case 'MWL':
        default: params = adhan.CalculationMethod.MuslimWorldLeague(); break;
      }
      // apply madhab
      params.madhab = (settings && settings.asr === 'Hanafi') ? adhan.Madhab.Hanafi : adhan.Madhab.Shafi;
      // allow custom override of angles
      if(settings && settings.fajrAngle) params.fajrAngle = Number(settings.fajrAngle);
      if(settings && settings.ishaAngle) params.ishaAngle = Number(settings.ishaAngle);
      const date = new Date();
      const times = new adhan.PrayerTimes(coords, date, params);
      return {
        Fajr: formatTime(times.fajr), Sunrise: formatTime(times.sunrise), Dhuhr: formatTime(times.dhuhr),
        Asr: formatTime(times.asr), Maghrib: formatTime(times.maghrib), Isha: formatTime(times.isha)
      };
    }catch(e){ console.error('Adhan calc failed', e); return null; }
  }

  function parseTimeToDate(timeStr){
    // timeStr like "05:12" or "05:12 (EDT)" — take HH:MM
    const m = timeStr.match(/(\d{1,2}:\d{2})/);
    if(!m) return null;
    const [hh,mm] = m[1].split(":").map(Number);
    const d = new Date();
    d.setHours(hh,mm,0,0);
    return d;
  }

  function deg2rad(d){return d*Math.PI/180}
  function rad2deg(r){return r*180/Math.PI}

  function computeQibla(lat1,lon1){
    // Bearing from (lat1,lon1) to Kaaba
    const φ1 = deg2rad(lat1), φ2 = deg2rad(KAABA.lat);
    const Δλ = deg2rad(KAABA.lon - lon1);
    const y = Math.sin(Δλ)*Math.cos(φ2);
    const x = Math.cos(φ1)*Math.sin(φ2) - Math.sin(φ1)*Math.cos(φ2)*Math.cos(Δλ);
    let θ = Math.atan2(y,x);
    θ = (rad2deg(θ)+360)%360;
    return θ; // degrees from north
  }

  function updateLocalTime(){
    const now = new Date();
    el('localTime').textContent = now.toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'});
  }

  function renderTimings(timings){
    const container = el('prayerList');
    container.innerHTML = '';
    const order = ['Fajr','Sunrise','Dhuhr','Asr','Maghrib','Isha'];
    const now = new Date();
    const items = [];
    for(const name of order){
      const timeStr = timings[name];
      if(!timeStr) continue;
      const d = parseTimeToDate(timeStr);
      items.push({name, timeStr, date: d});
    }
    if(items.length === 0){ el('nextPrayerName').textContent = '—'; return; }

    // find next upcoming prayer (first time > now). If none, next is first item (tomorrow)
    let nextIndex = items.findIndex(it => it.date && it.date > now);
    if(nextIndex === -1){
      nextIndex = 0;
      if(items[0].date) items[0].date = new Date(items[0].date.getTime() + 24*60*60*1000);
    }
    const currentIndex = (nextIndex - 1 + items.length) % items.length;

    let nextTime = items[nextIndex].date;
    let currentTime = items[currentIndex].date;
    if(!nextTime || !currentTime){
      // fallback: just mark next
      for(let i=0;i<items.length;i++){
        const it = items[i];
        const div = document.createElement('div'); div.className='pray';
        if(i===nextIndex) div.classList.add('next');
        const left = document.createElement('div'); left.innerHTML = `<div class="name">${it.name}</div><div class="small">${it.timeStr}</div>`;
        const right = document.createElement('div'); right.className='adhan-time'; right.textContent = it.date? it.date.toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'}) : it.timeStr;
        div.appendChild(left); div.appendChild(right); container.appendChild(div);
      }
      el('nextPrayerName').textContent = items[nextIndex].name;
      return;
    }

    if(nextTime <= currentTime){ nextTime = new Date(nextTime.getTime() + 24*60*60*1000); }
    if(currentTime > now){ currentTime = new Date(currentTime.getTime() - 24*60*60*1000); }
    const isCurrent = now >= currentTime && now < nextTime;

    for(let i=0;i<items.length;i++){
      const it = items[i];
      const div = document.createElement('div'); div.className='pray';
      if(i===nextIndex) div.classList.add('next');
      if(i===currentIndex && isCurrent) div.classList.add('current');
      const left = document.createElement('div'); left.innerHTML = `<div class="name">${it.name}</div><div class="small">${it.timeStr}</div>`;
      const right = document.createElement('div'); right.className='adhan-time'; right.textContent = it.date? it.date.toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'}) : it.timeStr;
      div.appendChild(left); div.appendChild(right); container.appendChild(div);
    }
    el('nextPrayerName').textContent = items[nextIndex].name;
  }

  function scheduleNotifications(timings){
    // clear previous timeouts
    state.timeouts.forEach(t=>clearTimeout(t)); state.timeouts=[];
    const now = new Date();
    const order = ['Fajr','Dhuhr','Asr','Maghrib','Isha'];
    for(const name of order){
      const tstr = timings[name]; if(!tstr) continue;
      const dt = parseTimeToDate(tstr);
      if(!dt) continue;
      let ms = dt.getTime() - now.getTime();
      if(ms < 0) ms += 24*60*60*1000; // schedule for next day if passed
      if(state.notificationsEnabled){
        const to = setTimeout(()=>{
          showAzanNotification(name);
        }, ms);
        state.timeouts.push(to);
      }
    }
  }

  function showAzanNotification(prayer){
    if(Notification.permission === 'granted'){
      navigator.serviceWorker?.getRegistration().then(reg=>{
        if(reg && reg.showNotification){
          reg.showNotification(`Azan — ${prayer}`,{body:`It's time for ${prayer}`,tag:'azan'})
        } else {
          new Notification(`Azan — ${prayer}`,{body:`It's time for ${prayer}`});
        }
      });
    }
    playAdhan(prayer);
  }

  // Try to play a prayer-specific Adhan audio file (e.g., fajr.mp3, dhuhr.mp3), fallback to adhan.mp3, then TTS or beep
  function playAdhan(prayer){
    const audioEl = document.getElementById('adhanAudio');
    if(!audioEl) { speakFallback(prayer); return; }
    
    // Try prayer-specific file first (e.g., fajr.mp3, dhuhr.mp3)
    const prayerLower = prayer.toLowerCase();
    const prayerFile = `${prayerLower}.mp3`;
    const genericFile = 'adhan.mp3';
    
    // Try specific file
    audioEl.src = prayerFile;
    audioEl.pause();
    audioEl.currentTime = 0;
    audioEl.play().catch(err=>{
      // Fallback to generic adhan.mp3
      audioEl.src = genericFile;
      audioEl.currentTime = 0;
      audioEl.play().catch(err2=>{
        // If audio fails, fallback to speech
        speakFallback(prayer);
      });
    });
  }

  function speakFallback(prayer){
    try{
      const s = `It's time for ${prayer}`;
      const u = new SpeechSynthesisUtterance(s);
      u.lang = 'en-US';
      speechSynthesis.cancel();
      speechSynthesis.speak(u);
    }catch(e){
      try{
        const ctx = new (window.AudioContext||window.webkitAudioContext)();
        const o = ctx.createOscillator(); const g = ctx.createGain();
        o.type='sine'; o.frequency.value=440; g.gain.value=0.05; o.connect(g); g.connect(ctx.destination);
        o.start(); setTimeout(()=>{o.stop();ctx.close();},1800);
      }catch(e){console.warn('Audio unavailable',e)}
    }
  }

  // Main
  async function refresh(){
    updateLocalTime();
    
    const lat = state.lat || parseFloat(el('latInput').value) || null;
    const lon = state.lon || parseFloat(el('lonInput').value) || null;
    if(!lat || !lon){
      // try geolocation
      try{
        const pos = await new Promise((res,rej)=>navigator.geolocation.getCurrentPosition(res,rej,{enableHighAccuracy:true,timeout:8000}));
        state.lat = pos.coords.latitude; state.lon = pos.coords.longitude;
      }catch(e){
        el('locationName').textContent = 'Coordinates required';
        el('coords').textContent = '';
        return;
      }
    }
    el('locationName').textContent = 'Using coordinates';
    el('coords').textContent = `${state.lat?.toFixed(4)}, ${state.lon?.toFixed(4)}`;
    try{
      // compute timezone offset and load settings
      const tz = -new Date().getTimezoneOffset()/60;
      const settings = loadSettings();
      // get local times using Adhan.js
      let times = getLocalPrayerTimes(state.lat, state.lon, settings);

      state.timings = times;
      renderTimings(times);
      const qdeg = computeQibla(state.lat,state.lon).toFixed(1);
      state.qdeg = Number(qdeg);
      el('qiblaDeg').textContent = `${qdeg}°`;
      const marker = el('qiblaMarker'); if(marker) marker.style.transform = `rotate(${qdeg}deg)`;
      scheduleNotifications(times);
    }catch(err){console.error(err)}
  }

  // Controls
  el('refreshBtn').addEventListener('click',()=>{ refresh(); });
  el('settingsBtn').addEventListener('click',()=>{ el('settingsModal').style.display='flex'; loadSettingsToUI(); });
  el('closeSettings').addEventListener('click',()=>{ el('settingsModal').style.display='none'; });
  el('saveSettings').addEventListener('click',()=>{ saveSettingsFromUI(); el('settingsModal').style.display='none'; refresh(); });

  el('notifBtn').addEventListener('click',async ()=>{
    if(Notification.permission === 'granted'){
      state.notificationsEnabled = !state.notificationsEnabled;
      el('notifBtn').textContent = state.notificationsEnabled? 'Disable Azan' : 'Enable Azan';
      scheduleNotifications(state.timings);
      return;
    }
    if(Notification.permission !== 'denied'){
      const p = await Notification.requestPermission();
      if(p === 'granted'){
        state.notificationsEnabled = true; el('notifBtn').textContent = 'Disable Azan';
        // Suggest registering a service worker for richer notifications if available
        scheduleNotifications(state.timings);
      }else{ alert('Notifications blocked — enable in browser settings to receive Azan alerts.'); }
    } else {
      alert('Notifications denied. Change browser settings to allow.');
    }
  });

  // Update clock every 5 seconds   
  setInterval(updateLocalTime, 5*1000);

  // Try to register a simple service worker to enable showNotification from registration (optional)
  if('serviceWorker' in navigator){
    try{ navigator.serviceWorker.register('sw.js').catch(()=>{}); }catch(e){}
  }

  // Device orientation / compass support (enabled by default)
  function normalizeAngle(angle){ // returns -180..180
    let a = ((angle + 540) % 360) - 180;
    return a;
  }

  function handleOrientationEvent(ev){
    // Try webkitCompassHeading (iOS), otherwise use alpha
    const heading = ev.webkitCompassHeading || (ev.alpha != null ? (360 - ev.alpha) : null);
    if(heading == null) return;
    state.deviceHeading = heading; // degrees
    el('deviceHeading').textContent = `Device heading: ${heading.toFixed(0)}°`;
    if(state.qdeg == null) return;
    // angle to rotate arrow relative to device (so arrow points toward qibla on device screen)
    const raw = state.qdeg - heading;
    const diff = normalizeAngle(raw);
    // Rotate the Qibla marker relative to fixed pointer so the marker moves
    const marker = el('qiblaMarker');
    if(marker) marker.style.transform = `rotate(${diff}deg)`;

    // Instruction: left or right
    const absd = Math.abs(diff);
    const instr = el('turnInstruction');
    if(absd <= 5){ instr.textContent = 'Facing Qibla — aligned'; instr.style.color = '#7efc9a'; }
    else if(diff > 0){ instr.textContent = `Turn right ${Math.round(absd)}°`; instr.style.color = '#ffd166'; }
    else { instr.textContent = `Turn left ${Math.round(absd)}°`; instr.style.color = '#ffd166'; }
  }

  async function enableCompass(){
    // enable automatically (request permission on iOS 13+)
    if(typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function'){
      try{
        const res = await DeviceOrientationEvent.requestPermission();
        if(res === 'granted'){
          window.addEventListener('deviceorientation', handleOrientationEvent, true);
        } else {
          console.warn('Compass permission denied.');
        }
      }catch(e){
        console.warn('Compass permission failed.', e);
      }
    } else if('ondeviceorientationabsolute' in window){
      window.addEventListener('deviceorientationabsolute', handleOrientationEvent, true);
    } else if('ondeviceorientation' in window){
      window.addEventListener('deviceorientation', handleOrientationEvent, true);
    } else {
      console.warn('Device orientation not supported on this device.');
    }
  }

  // auto-enable compass
  enableCompass();

  // Initial load
  refresh();

  // Settings persistence
  function loadSettings(){
    const raw = localStorage.getItem('praySettings');
    if(!raw) return {fajrAngle:18, ishaAngle:17, asr:'Standard', method:'MWL'};
    try{return JSON.parse(raw);}catch(e){return {fajrAngle:18, ishaAngle:17, asr:'Standard', method:'MWL'}}
  }

  function saveSettings(s){ localStorage.setItem('praySettings', JSON.stringify(s)); }

  function loadSettingsToUI(){
    const s = loadSettings();
    el('methodSelect').value = s.method || 'MWL';
    el('asrSelect').value = s.asr || 'Standard';
  }

  function saveSettingsFromUI(){
    const s = loadSettings();
    s.method = el('methodSelect').value;
    s.asr = el('asrSelect').value;
    // adjust angles based on method (simple mapping)
    if(s.method === 'MWL'){ s.fajrAngle = 18; s.ishaAngle = 17; }
    else if(s.method === 'ISNA'){ s.fajrAngle = 15; s.ishaAngle = 15; }
    else if(s.method === 'Egypt'){ s.fajrAngle = 19.5; s.ishaAngle = 17.5; }
    else if(s.method === 'Makkah'){ s.fajrAngle = 18.5; s.ishaAngle = 90; }
    else if(s.method === 'Karachi'){ s.fajrAngle = 18; s.ishaAngle = 18; }
    else if(s.method === 'Tehran'){ s.fajrAngle = 17.7; s.ishaAngle = 14; }
    s.asr = el('asrSelect').value;
    saveSettings(s);
  }
});
