// PrayerTime - Prayer times, Qibla direction, and Azan notifications.
// Frontend-only application using Adhan.js for prayer calculations.

document.addEventListener('DOMContentLoaded', function () {
  'use strict';

  // ---- Constants -----------------------------------------------------------
  const KAABA = { lat: 21.422487, lon: 39.826206 };
  const PRAYER_ORDER = ['Fajr', 'Sunrise', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'];
  const NOTIFY_PRAYERS = ['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha']; // Sunrise is not a prayer
  const DAY_MS = 24 * 60 * 60 * 1000;
  const LOC_KEY = 'prayLocation';
  const SETTINGS_KEY = 'praySettings';

  const state = {
    lat: null,
    lon: null,
    schedule: [],            // [{ name, date, isPrayer }]
    qdeg: null,              // qibla bearing from north
    deviceHeading: null,
    notificationsEnabled: false,
    notifyTimeouts: [],
    notifiedKeys: new Set(), // prevents duplicate notifications within a render cycle
  };

  // ---- DOM helpers ---------------------------------------------------------
  const el = (id) => document.getElementById(id);

  // Local Adhan audio element (place `adhan.mp3` next to index.html).
  const audioEl = document.createElement('audio');
  audioEl.id = 'adhanAudio';
  audioEl.preload = 'auto';
  audioEl.crossOrigin = 'anonymous';
  document.body.appendChild(audioEl);

  // ---- Settings ------------------------------------------------------------
  function defaultSettings() {
    return { method: 'MWL', asr: 'Standard', twentyFourHour: false };
  }

  function loadSettings() {
    try {
      const raw = localStorage.getItem(SETTINGS_KEY);
      return raw ? Object.assign(defaultSettings(), JSON.parse(raw)) : defaultSettings();
    } catch (e) {
      return defaultSettings();
    }
  }

  function saveSettings(s) {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
  }

  function loadSettingsToUI() {
    const s = loadSettings();
    el('methodSelect').value = s.method;
    el('asrSelect').value = s.asr;
    el('twentyFourHour').checked = !!s.twentyFourHour;
  }

  function saveSettingsFromUI() {
    const s = loadSettings();
    s.method = el('methodSelect').value;
    s.asr = el('asrSelect').value;
    s.twentyFourHour = el('twentyFourHour').checked;
    saveSettings(s);
  }

  // ---- Time formatting -----------------------------------------------------
  function formatTime(date) {
    if (!date) return '--:--';
    const opts = { hour: '2-digit', minute: '2-digit', hour12: !loadSettings().twentyFourHour };
    return date.toLocaleTimeString([], opts);
  }

  function pad(n) { return String(n).padStart(2, '0'); }

  function formatDuration(ms) {
    if (ms < 0) ms = 0;
    const total = Math.floor(ms / 1000);
    const h = Math.floor(total / 3600);
    const m = Math.floor((total % 3600) / 60);
    const sec = total % 60;
    return `${pad(h)}:${pad(m)}:${pad(sec)}`;
  }

  // ---- Prayer calculation --------------------------------------------------
  function getCalculationParams(settings) {
    let params;
    switch (settings.method) {
      case 'ISNA': params = adhan.CalculationMethod.NorthAmerica(); break;
      case 'Egypt': params = adhan.CalculationMethod.Egyptian(); break;
      case 'Makkah': params = adhan.CalculationMethod.UmmAlQura(); break;
      case 'Karachi': params = adhan.CalculationMethod.Karachi(); break;
      case 'Tehran': params = adhan.CalculationMethod.Tehran(); break;
      case 'MWL':
      default: params = adhan.CalculationMethod.MuslimWorldLeague(); break;
    }
    params.madhab = settings.asr === 'Hanafi' ? adhan.Madhab.Hanafi : adhan.Madhab.Shafi;
    return params;
  }

  // Returns a chronological schedule of Date objects for the given day.
  function computeSchedule(lat, lon, settings, date) {
    const coords = new adhan.Coordinates(lat, lon);
    const params = getCalculationParams(settings);
    const times = new adhan.PrayerTimes(coords, date, params);
    const map = {
      Fajr: times.fajr, Sunrise: times.sunrise, Dhuhr: times.dhuhr,
      Asr: times.asr, Maghrib: times.maghrib, Isha: times.isha,
    };
    return PRAYER_ORDER
      .filter((name) => map[name] instanceof Date && !isNaN(map[name]))
      .map((name) => ({ name, date: map[name], isPrayer: name !== 'Sunrise' }));
  }

  // ---- Qibla ---------------------------------------------------------------
  const deg2rad = (d) => (d * Math.PI) / 180;
  const rad2deg = (r) => (r * 180) / Math.PI;

  function computeQibla(lat1, lon1) {
    const f1 = deg2rad(lat1), f2 = deg2rad(KAABA.lat);
    const dl = deg2rad(KAABA.lon - lon1);
    const y = Math.sin(dl) * Math.cos(f2);
    const x = Math.cos(f1) * Math.sin(f2) - Math.sin(f1) * Math.cos(f2) * Math.cos(dl);
    return (rad2deg(Math.atan2(y, x)) + 360) % 360;
  }

  function normalizeAngle(angle) { // -180..180
    return ((angle + 540) % 360) - 180;
  }

  // ---- Hijri date ----------------------------------------------------------
  function updateHijriDate() {
    try {
      const hijri = new Intl.DateTimeFormat('en-US-u-ca-islamic-umalqura', {
        day: 'numeric', month: 'long', year: 'numeric',
      }).format(new Date());
      el('hijriDate').textContent = hijri.replace(/\s*AH/, '') + ' AH';
    } catch (e) {
      el('hijriDate').textContent = new Date().toLocaleDateString();
    }
  }

  // ---- Rendering -----------------------------------------------------------
  // Index of the next prayer (skips Sunrise; wraps to tomorrow's first prayer).
  function nextPrayerIndex(schedule, now) {
    let idx = schedule.findIndex((it) => it.isPrayer && it.date > now);
    if (idx === -1) idx = schedule.findIndex((it) => it.isPrayer); // all passed → tomorrow's first
    return idx;
  }

  // Index of the current prayer = most recent prayer already begun.
  // Before today's first prayer, this is yesterday's last prayer (its row).
  function currentPrayerIndex(schedule, now) {
    for (let i = schedule.length - 1; i >= 0; i--) {
      if (schedule[i].isPrayer && schedule[i].date <= now) return i;
    }
    for (let i = schedule.length - 1; i >= 0; i--) {
      if (schedule[i].isPrayer) return i;
    }
    return -1;
  }

  function renderTimings() {
    const container = el('prayerList');
    const now = new Date();
    const schedule = state.schedule;
    if (!schedule.length) { container.innerHTML = ''; return; }

    const next = nextPrayerIndex(schedule, now);
    const current = currentPrayerIndex(schedule, now);

    container.innerHTML = '';
    for (let i = 0; i < schedule.length; i++) {
      const it = schedule[i];
      const div = document.createElement('div');
      div.className = 'pray' + (it.isPrayer ? '' : ' sunrise');
      // "Next" takes precedence if an entry is somehow both.
      if (i === next) div.classList.add('next');
      else if (i === current) div.classList.add('current');

      const badge = i === next ? '<span class="badge">Next</span>'
        : (i === current ? '<span class="badge">Now</span>' : '');
      div.innerHTML =
        `<div class="name">${it.name}${badge}</div>` +
        `<div class="time">${formatTime(it.date)}</div>`;
      container.appendChild(div);
    }
  }

  // The next prayer entry as an absolute Date (wraps to tomorrow if needed).
  function getNextPrayer() {
    const now = new Date();
    const schedule = state.schedule;
    if (!schedule.length) return null;
    const upcoming = schedule.find((it) => it.isPrayer && it.date > now);
    if (upcoming) return upcoming;
    // Everything today passed — first prayer tomorrow.
    const first = schedule.find((it) => it.isPrayer);
    return first ? { name: first.name, date: new Date(first.date.getTime() + DAY_MS), isPrayer: true } : null;
  }

  // ---- Per-second tick: clock, countdown, highlight, notifications --------
  let lastRenderedMinute = -1;
  function tick() {
    const now = new Date();
    el('localTime').textContent = formatTime(now);

    const np = getNextPrayer();
    if (np) {
      el('nextPrayerName').textContent = np.name;
      el('nextPrayerTime').textContent = formatTime(np.date);
      el('countdown').textContent = formatDuration(np.date.getTime() - now.getTime());

      // Fire azan when the moment arrives (in-page, while app is open).
      if (state.notificationsEnabled) {
        const key = np.name + np.date.toDateString();
        if (np.date <= now && !state.notifiedKeys.has(key)) {
          state.notifiedKeys.add(key);
          showAzanNotification(np.name);
        }
      }
    }

    // Re-render the list when the minute changes or a prayer just passed.
    if (now.getMinutes() !== lastRenderedMinute) {
      lastRenderedMinute = now.getMinutes();
      renderTimings();
      updateHijriDate();
    }
  }

  // ---- Notifications & audio ----------------------------------------------
  function showAzanNotification(prayer) {
    if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
      const opts = { body: `It's time for ${prayer}`, tag: 'azan', icon: './images/icons/icon-192x192.png' };
      if (navigator.serviceWorker) {
        navigator.serviceWorker.getRegistration().then((reg) => {
          if (reg && reg.showNotification) reg.showNotification(`Azan — ${prayer}`, opts);
          else new Notification(`Azan — ${prayer}`, opts);
        }).catch(() => new Notification(`Azan — ${prayer}`, opts));
      } else {
        new Notification(`Azan — ${prayer}`, opts);
      }
    }
    playAdhan(prayer);
  }

  // Try a prayer-specific file (e.g. fajr.mp3), then generic adhan.mp3, then TTS/beep.
  function playAdhan(prayer) {
    const specific = `${prayer.toLowerCase()}.mp3`;
    audioEl.src = specific;
    audioEl.currentTime = 0;
    audioEl.play().catch(() => {
      audioEl.src = 'adhan.mp3';
      audioEl.currentTime = 0;
      audioEl.play().catch(() => speakFallback(prayer));
    });
  }

  function speakFallback(prayer) {
    try {
      const u = new SpeechSynthesisUtterance(`It's time for ${prayer}`);
      u.lang = 'en-US';
      speechSynthesis.cancel();
      speechSynthesis.speak(u);
    } catch (e) {
      try {
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        const o = ctx.createOscillator(), g = ctx.createGain();
        o.type = 'sine'; o.frequency.value = 440; g.gain.value = 0.05;
        o.connect(g); g.connect(ctx.destination);
        o.start(); setTimeout(() => { o.stop(); ctx.close(); }, 1800);
      } catch (err) { console.warn('Audio unavailable', err); }
    }
  }

  // ---- Location ------------------------------------------------------------
  function saveLocation(lat, lon) {
    try { localStorage.setItem(LOC_KEY, JSON.stringify({ lat, lon })); } catch (e) {}
  }

  function loadLocation() {
    try {
      const raw = localStorage.getItem(LOC_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e) { return null; }
  }

  // Reverse-geocode to a human-readable place name (best effort, no key).
  async function resolveLocationName(lat, lon) {
    el('locationName').textContent = 'Locating…';
    try {
      const url = `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lon}&localityLanguage=en`;
      const res = await fetch(url);
      if (!res.ok) throw new Error('geocode failed');
      const j = await res.json();
      const parts = [j.city || j.locality, j.principalSubdivision, j.countryName].filter(Boolean);
      el('locationName').textContent = parts.length ? parts.join(', ') : 'Your location';
    } catch (e) {
      el('locationName').textContent = 'Your location';
    }
  }

  // ---- Main refresh --------------------------------------------------------
  async function refresh() {
    if (state.lat == null || state.lon == null) {
      const manualLat = parseFloat(el('latInput').value);
      const manualLon = parseFloat(el('lonInput').value);
      if (!isNaN(manualLat) && !isNaN(manualLon)) {
        state.lat = manualLat; state.lon = manualLon;
      } else if (navigator.geolocation) {
        try {
          const pos = await new Promise((res, rej) =>
            navigator.geolocation.getCurrentPosition(res, rej, { enableHighAccuracy: true, timeout: 8000 }));
          state.lat = pos.coords.latitude;
          state.lon = pos.coords.longitude;
        } catch (e) {
          el('locationName').textContent = 'Coordinates required';
          el('coords').textContent = 'Enter them manually below.';
          return;
        }
      } else {
        el('locationName').textContent = 'Coordinates required';
        return;
      }
    }

    saveLocation(state.lat, state.lon);
    el('coords').textContent = `${state.lat.toFixed(4)}, ${state.lon.toFixed(4)}`;
    resolveLocationName(state.lat, state.lon);

    try {
      const settings = loadSettings();
      state.schedule = computeSchedule(state.lat, state.lon, settings, new Date());
      state.notifiedKeys.clear();
      lastRenderedMinute = -1; // force re-render on next tick

      state.qdeg = computeQibla(state.lat, state.lon);
      el('qiblaDeg').textContent = `${state.qdeg.toFixed(1)}°`;
      const marker = el('qiblaMarker');
      if (marker && state.deviceHeading == null) marker.style.transform = `rotate(${state.qdeg}deg)`;

      renderTimings();
      tick();
    } catch (err) {
      console.error('Failed to compute prayer times', err);
    }
  }

  // ---- Compass -------------------------------------------------------------
  function handleOrientationEvent(ev) {
    const heading = ev.webkitCompassHeading != null
      ? ev.webkitCompassHeading
      : (ev.alpha != null ? 360 - ev.alpha : null);
    if (heading == null) return;

    state.deviceHeading = heading;
    el('deviceHeading').textContent = `Device heading: ${heading.toFixed(0)}°`;
    if (state.qdeg == null) return;

    const diff = normalizeAngle(state.qdeg - heading);
    const marker = el('qiblaMarker');
    if (marker) marker.style.transform = `rotate(${diff}deg)`;

    const instr = el('turnInstruction');
    const absd = Math.abs(diff);
    if (absd <= 5) { instr.textContent = 'Facing Qibla — aligned ✓'; instr.style.color = 'var(--green)'; }
    else if (diff > 0) { instr.textContent = `Turn right ${Math.round(absd)}°`; instr.style.color = 'var(--accent)'; }
    else { instr.textContent = `Turn left ${Math.round(absd)}°`; instr.style.color = 'var(--accent)'; }
  }

  function enableCompass() {
    if (typeof DeviceOrientationEvent !== 'undefined' &&
        typeof DeviceOrientationEvent.requestPermission === 'function') {
      // iOS 13+ requires a user gesture; defer until first tap.
      const ask = () => {
        DeviceOrientationEvent.requestPermission().then((res) => {
          if (res === 'granted') window.addEventListener('deviceorientation', handleOrientationEvent, true);
        }).catch(() => {});
        window.removeEventListener('click', ask);
      };
      window.addEventListener('click', ask, { once: true });
    } else if ('ondeviceorientationabsolute' in window) {
      window.addEventListener('deviceorientationabsolute', handleOrientationEvent, true);
    } else if ('ondeviceorientation' in window) {
      window.addEventListener('deviceorientation', handleOrientationEvent, true);
    }
  }

  // ---- Settings modal ------------------------------------------------------
  function openModal() { el('settingsModal').classList.add('open'); loadSettingsToUI(); }
  function closeModal() { el('settingsModal').classList.remove('open'); }

  // ---- Wiring --------------------------------------------------------------
  el('refreshBtn').addEventListener('click', () => { state.lat = state.lon = null; refresh(); });
  el('applyCoords').addEventListener('click', () => {
    const lat = parseFloat(el('latInput').value), lon = parseFloat(el('lonInput').value);
    if (!isNaN(lat) && !isNaN(lon)) { state.lat = lat; state.lon = lon; refresh(); }
  });
  el('settingsBtn').addEventListener('click', openModal);
  el('closeSettings').addEventListener('click', closeModal);
  el('saveSettings').addEventListener('click', () => { saveSettingsFromUI(); closeModal(); refresh(); });
  el('settingsModal').addEventListener('click', (e) => { if (e.target === el('settingsModal')) closeModal(); });

  el('notifBtn').addEventListener('click', async () => {
    if (typeof Notification === 'undefined') { alert('Notifications are not supported in this browser.'); return; }
    if (Notification.permission === 'granted') {
      state.notificationsEnabled = !state.notificationsEnabled;
    } else if (Notification.permission !== 'denied') {
      const p = await Notification.requestPermission();
      if (p === 'granted') state.notificationsEnabled = true;
      else { alert('Notifications blocked — enable in browser settings to receive Azan alerts.'); return; }
    } else {
      alert('Notifications denied. Change browser settings to allow.');
      return;
    }
    el('notifBtn').textContent = state.notificationsEnabled ? 'Disable Azan' : 'Enable Azan';
    state.notifiedKeys.clear();
  });

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }

  // ---- Boot ----------------------------------------------------------------
  const saved = loadLocation();
  if (saved && typeof saved.lat === 'number' && typeof saved.lon === 'number') {
    state.lat = saved.lat; state.lon = saved.lon;
    el('latInput').value = saved.lat; el('lonInput').value = saved.lon;
  }
  updateHijriDate();
  enableCompass();
  refresh();
  setInterval(tick, 1000);

  // Honor the "Refresh" PWA shortcut (manifest start_url ?action=refresh).
  if (new URLSearchParams(location.search).get('action') === 'refresh') {
    state.lat = state.lon = null;
    refresh();
  }
});
