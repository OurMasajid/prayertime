// Clock engine — drives the big-clock prayer display.
// Uses PrayTimes.js (prayertime.js) for calculations.

var pos = { lat: 0, lon: 0 };
var daily = {};    // 12-hour display strings (no suffix)
var dailyWS = {};  // 24-hour strings, used for scheduling/comparison
var azanAudio = new Audio('../azan/azan.mp3');
var fazanAudio = new Audio('../azan/fazan.mp3');
var lastAzan = "";
var cityName = "";

var PRAYERS = ["fajr", "dhuhr", "asr", "maghrib", "isha"];
var LOC_KEY = "clockLocation";
var DAY_MS = 24 * 60 * 60 * 1000;

function pad(n) { return String(n).padStart(2, "0"); }

function main() {
  if (!localStorage.getItem("cmethod")) localStorage.setItem("cmethod", "ISNA");
  if (!localStorage.getItem("casr")) localStorage.setItem("casr", "Standard");
  if (!localStorage.getItem("autoAzan")) localStorage.setItem("autoAzan", "false");

  document.getElementById("cmethod").value = localStorage.getItem("cmethod");
  document.getElementById("casr").value = localStorage.getItem("casr");
  document.getElementById("autoAzan").checked = localStorage.getItem("autoAzan") === "true";

  // The clock runs no matter what — independent of location/permission.
  updateClock();
  updateDates();
  startClock();

  // Prayer times need a location: use the last known one immediately (works
  // offline), then refine with a live geolocation fix.
  var saved = loadLocation();
  if (saved) applyLocation(saved.lat, saved.lon, saved.city);
  getLocation();
}

function getuserTimezone() {
  // getTimezoneOffset() already accounts for the current DST state.
  return -new Date().getTimezoneOffset() / 60;
}

function updatePrayerTime() {
  prayTimes.setMethod(localStorage.getItem("cmethod"));
  prayTimes.adjust({ asr: localStorage.getItem("casr") });
  daily = prayTimes.getTimes(new Date(), [pos.lat, pos.lon], getuserTimezone(), 0, "12hNS");
  dailyWS = prayTimes.getTimes(new Date(), [pos.lat, pos.lon], getuserTimezone(), 0, "24h");

  document.getElementById("f").innerHTML = daily.fajr;
  document.getElementById("s").innerHTML = daily.sunrise;
  document.getElementById("d").innerHTML = daily.dhuhr;
  document.getElementById("a").innerHTML = daily.asr;
  document.getElementById("m").innerHTML = daily.maghrib;
  document.getElementById("i").innerHTML = daily.isha;
  document.getElementById("mid").innerHTML = daily.midnight;
}

// Build a Date for today at the given "HH:MM" 24-hour string.
function timeToDate(hhmm) {
  var parts = hhmm.split(":");
  var d = new Date();
  d.setHours(parseInt(parts[0], 10), parseInt(parts[1], 10), 0, 0);
  return d;
}

function formatSpan(ms, withSeconds) {
  if (ms < 0) ms = 0;
  var total = Math.floor(ms / 1000);
  var h = Math.floor(total / 3600);
  var m = Math.floor((total % 3600) / 60);
  var s = total % 60;
  return withSeconds ? (pad(h) + ":" + pad(m) + ":" + pad(s)) : (pad(h) + ":" + pad(m));
}

function setCurrentNextPrayer() {
  var now = new Date();

  // Find the next upcoming prayer; default to Fajr (tomorrow) if all passed.
  var nextName = PRAYERS[0];
  var currentName = PRAYERS[PRAYERS.length - 1];
  for (var i = 0; i < PRAYERS.length; i++) {
    if (timeToDate(dailyWS[PRAYERS[i]]) > now) {
      nextName = PRAYERS[i];
      currentName = (i === 0) ? PRAYERS[PRAYERS.length - 1] : PRAYERS[i - 1];
      break;
    }
  }

  // Resolve absolute Date objects, wrapping across midnight where needed.
  var nextDate = timeToDate(dailyWS[nextName]);
  if (nextDate <= now) nextDate = new Date(nextDate.getTime() + DAY_MS); // next is tomorrow
  var currentDate = timeToDate(dailyWS[currentName]);
  if (currentDate > now) currentDate = new Date(currentDate.getTime() - DAY_MS); // current was yesterday

  document.getElementById("currentPrayer").textContent = currentName;
  document.getElementById("currentPrayerTime").textContent = daily[currentName];
  document.getElementById("currentPrayerSpan").textContent = formatSpan(now - currentDate, false);

  document.getElementById("nextPrayer").textContent = nextName;
  document.getElementById("nextPrayerTime").textContent = daily[nextName];
  document.getElementById("nextPrayerSpan").textContent = formatSpan(nextDate - now, true);

  // Highlight the corresponding rows.
  PRAYERS.concat(["sunrise", "midnight"]).forEach(function (name) {
    var row = document.getElementById("row-" + name);
    if (row) row.classList.remove("current", "next");
  });
  var nextRow = document.getElementById("row-" + nextName);
  var curRow = document.getElementById("row-" + currentName);
  if (curRow) curRow.classList.add("current");
  if (nextRow) nextRow.classList.add("next");
}

function updateClock() {
  var now = new Date();
  var hours = now.getHours();
  var ampm = hours >= 12 ? "PM" : "AM";
  var h12 = hours % 12;
  if (h12 === 0) h12 = 12;
  var hm = h12 + ":" + pad(now.getMinutes());
  document.getElementById("clock").innerHTML =
    hm + '<span class="ampm">' + ampm + "</span>";
}

function updateDates() {
  var now = new Date();
  document.getElementById("gregDate").textContent =
    now.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" });
  try {
    var hijri = new Intl.DateTimeFormat("en-US-u-ca-islamic-umalqura",
      { day: "numeric", month: "long", year: "numeric" }).format(now);
    document.getElementById("hijriDate").textContent = hijri.replace(/\s*AH/, "") + " AH";
  } catch (e) {
    document.getElementById("hijriDate").textContent = "";
  }
}

function getLocation() {
  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(setPosition, geoError);
  } else {
    geoError();
  }
}

function geoError() {
  // Clock keeps running; only prayer times need a location.
  if (hasLocation) {
    // We're already running on saved coordinates — keep using them.
    updateLocLabel(" · using saved location (live location off)");
  } else {
    document.getElementById("locLabel").textContent =
      "📍 Location permission missing — prayer times unavailable. Enable location to show them.";
  }
}

function setPosition(position) {
  applyLocation(position.coords.latitude, position.coords.longitude);
  resolveCityName(pos.lat, pos.lon); // updates the label and persists with city
}

// Apply a known location and (re)compute prayer times.
function applyLocation(lat, lon, city) {
  pos.lat = lat;
  pos.lon = lon;
  hasLocation = true;
  if (city) cityName = city;
  updateLocLabel();
  updatePrayerTime();
  setCurrentNextPrayer();
}

// Footer label: prefer the city name, fall back to coordinates.
function updateLocLabel(suffix) {
  var base = cityName || (pos.lat.toFixed(3) + ", " + pos.lon.toFixed(3));
  document.getElementById("locLabel").textContent = base + (suffix || "");
}

// Best-effort reverse geocode to a readable place name (no API key).
function resolveCityName(lat, lon) {
  var url = "https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=" +
    lat + "&longitude=" + lon + "&localityLanguage=en";
  fetch(url)
    .then(function (res) { return res.ok ? res.json() : Promise.reject(); })
    .then(function (j) {
      var parts = [j.city || j.locality, j.principalSubdivision, j.countryName].filter(Boolean);
      if (parts.length) { cityName = parts.join(", "); updateLocLabel(); }
      saveLocation(lat, lon, cityName);
    })
    .catch(function () { saveLocation(lat, lon, cityName); });
}

function saveLocation(lat, lon, city) {
  try {
    localStorage.setItem(LOC_KEY, JSON.stringify({ lat: lat, lon: lon, city: city || "" }));
  } catch (e) {}
}

function loadLocation() {
  try {
    var raw = localStorage.getItem(LOC_KEY);
    var o = raw ? JSON.parse(raw) : null;
    return (o && typeof o.lat === "number" && typeof o.lon === "number") ? o : null;
  } catch (e) { return null; }
}

var hasLocation = false;
var ticking = false;

// The clock ticks every second regardless of location. Prayer-time updates
// only run once a location is available.
function startClock() {
  if (ticking) return;
  ticking = true;

  var lastMinute = -1;
  setInterval(function () {
    var now = new Date();
    updateClock();
    if (hasLocation) {
      setCurrentNextPrayer();
      makeAzan();
    }
    if (now.getMinutes() !== lastMinute) {
      lastMinute = now.getMinutes();
      updateDates();
      if (hasLocation) updatePrayerTime();
    }
  }, 1000);
}

function makeAzan() {
  if (localStorage.getItem("autoAzan") !== "true") return;
  var now = new Date();
  var hours = now.getHours();
  var mins = now.getMinutes();
  for (var i = 0; i < PRAYERS.length; i++) {
    var name = PRAYERS[i];
    var t = dailyWS[name].split(":");
    if (parseInt(t[0], 10) === hours && parseInt(t[1], 10) === mins && lastAzan !== name) {
      (name === "fajr" ? fazanAudio : azanAudio).play().catch(function () {});
      lastAzan = name;
    }
  }
}

document.getElementById("cmethod").addEventListener("change", function () {
  localStorage.setItem(this.id, this.value);
  if (hasLocation) { updatePrayerTime(); setCurrentNextPrayer(); }
});
document.getElementById("casr").addEventListener("change", function () {
  localStorage.setItem(this.id, this.value);
  if (hasLocation) { updatePrayerTime(); setCurrentNextPrayer(); }
});
document.getElementById("autoAzan").addEventListener("change", function () {
  localStorage.setItem(this.id, this.checked);
});

main();
