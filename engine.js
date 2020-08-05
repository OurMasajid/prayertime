var pos = {
    "lat": 0,
    "lon": 0
}
var nextPrayerName= "";
var currentPrayerName= "";
var daily = "";
var dailyWS = "";

function main(){
    if(!localStorage.getItem("cmethod")){
        localStorage.setItem("cmethod", "ISNA");
    }
    if(!localStorage.getItem("casr")){
        localStorage.setItem("casr", "Standard");
    }
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
}
function setCurrentNextPrayer() {
    let date = new Date();
    let hours = date.getHours();
    let mins = date.getMinutes();
    let prayernames = ["fajr", "dhuhr", "asr", "maghrib", "isha"];
    nextPrayerName= prayernames[0];
    currentPrayerName= prayernames[prayernames.length - 1];
    for (let i = 0; i < prayernames.length; i++) {
        let element = prayernames[i];

        let eleHour = parseInt(dailyWS[element].split(":")[0]);
        let eleMin = parseInt(dailyWS[element].split(":")[1]);
        if (eleHour > hours) {
            nextPrayerName= element;
            if (i == 0) { currentPrayerName= prayernames[prayernames.length - 1]; }
            else { currentPrayerName= prayernames[i - 1]; }
            break;
        }
        if (eleHour == hours && eleMin > mins) {
            nextPrayerName= element;
            if (i == 0) { currentPrayerName= prayernames[prayernames.length - 1]; }
            else { currentPrayerName= prayernames[i - 1]; }
            break;
        }
    };
    document.getElementById("currentPrayer").innerHTML = currentPrayerName;
    document.getElementById("currentPrayerTime").innerHTML = daily[currentPrayerName];

    document.getElementById("nextPrayer").innerHTML = nextPrayerName;
    document.getElementById("nextPrayerTime").innerHTML = daily[nextPrayerName];
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
    setInterval(() => {
        updatePrayerTime();
        setNextPrayerMessage();
        clock.innerHTML = new Date().toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" }).toString().split(' ')[0];
    }, 1000);
}
function getuserTimezone() {
    var offset = new Date().getTimezoneOffset();
    if (offset < 0)
        return offset / -60;
    else
        return offset / -60;
}
setTimeout(main(), 0);