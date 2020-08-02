var pos = {
    "lat": 0,
    "lon": 0
}
var next = "";
var current = "";
var daily = "";
var dailyWS = "";

function main(){
    document.getElementById("cmethod").value = localStorage.getItem("cmethod");
    document.getElementById("casr").value = localStorage.getItem("casr");
    getLocation();//will call setLocation, which will call updatePrayerTime
}

function updatePrayerTime() {
    let dst = 0;/*day light saving*/
    prayTimes.setMethod(localStorage.getItem("cmethod"));
    prayTimes.adjust({ asr: localStorage.getItem("casr") });
    daily = prayTimes.getTimes(new Date(), [pos.lat, pos.lon], getuserTimezone(), dst, "12hNS");

    f.innerHTML = daily.fajr;
    s.innerHTML = daily.sunrise;
    d.innerHTML = daily.dhuhr;
    a.innerHTML = daily.asr;
    m.innerHTML = daily.maghrib;
    i.innerHTML = daily.isha;
    mid.innerHTML = daily.midnight;
    console.log('Prayer time has been update!');
    setTimeout(setNextPrayerMessage(), 0);
    return;
}
document.getElementById("cmethod").addEventListener("change", function () {
    localStorage.setItem(this.id, this.value);
    setTimeout(updatePrayerTime, 0);
});
document.getElementById("casr").addEventListener("change", function () {
    localStorage.setItem(this.id, this.value);
    setTimeout(updatePrayerTime, 0);
});

function setNextPrayerMessage() {
    dailyWS = prayTimes.getTimes(new Date(), [pos.lat, pos.lon], getuserTimezone(), 0, "24h");
    setCurrentNextPrayer();
    console.log("It's time for " + current);
}
function setCurrentNextPrayer() {
    let date = new Date();
    let hours = date.getHours();
    let mins = date.getMinutes();
    let prayernames = ["fajr", "dhuhr", "asr", "maghrib", "isha"];
    next = prayernames[0];
    current = prayernames[prayernames.length - 1];
    for (let i = 0; i < prayernames.length; i++) {
        let element = prayernames[i];

        let eleHour = parseInt(dailyWS[element].split(":")[0]);
        let eleMin = parseInt(dailyWS[element].split(":")[1]);
        if (eleHour > hours) {
            next = element;
            if (i == 0) { current = prayernames[prayernames.length - 1]; }
            else { current = prayernames[i - 1]; }
            break;
        }
        if (eleHour == hours && eleMin > mins) {
            next = element;
            if (i == 0) { current = prayernames[prayernames.length - 1]; }
            else { current = prayernames[i - 1]; }
            break;
        }
    };
}
function getLocation() {
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(setPosition);
    } else {
        alert("Geolocation is not supported by this browser.");
    }
}
function setPosition(position) {
    pos.lat = position.coords.latitude;
    pos.lon = position.coords.longitude;
    setTimeout(updatePrayerTime, 0);
}
function getuserTimezone() {
    var offset = new Date().getTimezoneOffset();
    if (offset < 0)
        return offset / -60;
    else
        return offset / -60;
}
setTimeout(main(), 0);
// if ('serviceWorker' in navigator) {
//     navigator.serviceWorker
//         .register('./sw.js')
//         .then(function () { console.log('Service Worker Registered'); });
// }