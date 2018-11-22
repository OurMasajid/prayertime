var pos = {
    "lat": 0,
    "lon": 0
}
var next = "";
var current = "";
var daily = "";
var dailyWS = "";
function updatePrayerTime() {
    let dst = 0;/*day light saving*/
    prayTimes.setMethod(document.getElementById("cmethod").value);
    prayTimes.adjust({ asr: document.getElementById("casr").value });
    daily = prayTimes.getTimes(new Date(), [pos.lat, pos.lon], getuserTimezone(), dst, "12hNS");

    f.innerHTML = daily.fajr;
    s.innerHTML = daily.sunrise;
    d.innerHTML = daily.dhuhr;
    a.innerHTML = daily.asr;
    m.innerHTML = daily.maghrib;
    i.innerHTML = daily.isha;
    M.toast({ html: 'Prayer time has been update!' });
    setTimeout(getNextPrayerTime(), 0);
    return;
}
document.getElementById("cmethod").addEventListener("change", function () {
    setTimeout(updatePrayerTime, 0);
});
document.getElementById("casr").addEventListener("change", function () {
    setTimeout(updatePrayerTime, 0);
});

function getNextPrayerTime() {
    dailyWS = prayTimes.getTimes(new Date(), [pos.lat, pos.lon], getuserTimezone(), 0, "24h");
    let date = new Date();
    let hours = date.getHours();
    let mins = date.getMinutes();
    let prayernames = ["fajr", "dhuhr", "asr", "maghrib", "isha"];
    next = prayernames[0];
    current = prayernames[prayernames.length-1];
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
    nextPrayer.innerHTML = "It's time for "+ current;
}
function getLocation() {
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(showPosition);
    } else {
        alert("Geolocation is not supported by this browser.");
    }
}
function showPosition(position) {
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
setTimeout(getLocation(), 0);