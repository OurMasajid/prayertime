var pos = {
    "lat": 0,
    "lon": 0
}
var nextPrayerName= "";
var currentPrayerName= "";
var nextPrayerSpan = "";
var currentPrayerSpan = "";
var daily = "";
var dailyWS = "";
var azanAudio = new Audio('../azan/azan.mp3');
var fazanAudio = new Audio('../azan/fazan.mp3');
var lastAzan = "";

function main(){
    if(!localStorage.getItem("cmethod")){
        localStorage.setItem("cmethod", "ISNA");
    }
    if(!localStorage.getItem("casr")){
        localStorage.setItem("casr", "Standard");
    }
    if(!localStorage.getItem("autoAzan")){
        localStorage.setItem("autoAzan", "false");
    }
    document.getElementById("cmethod").value = localStorage.getItem("cmethod");
    document.getElementById("casr").value = localStorage.getItem("casr");
    document.getElementById("autoAzan").checked = localStorage.getItem("autoAzan") === "true";
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
document.getElementById("autoAzan").addEventListener("change", function () {
    localStorage.setItem(this.id, this.checked);
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

    // calculating current and next spans
    currentPrayerSpan = new Date();
    currentPrayerSpan = new Date(currentPrayerSpan.setHours(dailyWS[currentPrayerName].split(":")[0]));
    currentPrayerSpan = new Date(currentPrayerSpan.setMinutes(dailyWS[currentPrayerName].split(":")[1]));
    currentPrayerSpan = new Date(currentPrayerSpan.setSeconds(0));
    currentPrayerSpan = new Date(new Date().getTime() - currentPrayerSpan.getTime());

    nextPrayerSpan = new Date();
    nextPrayerSpan = new Date(nextPrayerSpan.setHours(dailyWS[nextPrayerName].split(":")[0]));
    nextPrayerSpan = new Date(nextPrayerSpan.setMinutes(dailyWS[nextPrayerName].split(":")[1]));
    nextPrayerSpan = new Date(nextPrayerSpan.setSeconds(0));
    nextPrayerSpan = new Date(nextPrayerSpan.getTime() - new Date().getTime());


    document.getElementById("currentPrayer").innerHTML = currentPrayerName;
    document.getElementById("currentPrayerTime").innerHTML = daily[currentPrayerName];
    document.getElementById("currentPrayerSpan").innerHTML = "+ "+currentPrayerSpan.getUTCHours() +":"+ currentPrayerSpan.getMinutes();// +":"+currentPrayerSpan.getSeconds();

    document.getElementById("nextPrayer").innerHTML = nextPrayerName;
    document.getElementById("nextPrayerTime").innerHTML = daily[nextPrayerName];
    document.getElementById("nextPrayerSpan").innerHTML = "- "+nextPrayerSpan.getUTCHours() +":"+ nextPrayerSpan.getMinutes();// +":"+nextPrayerSpan.getSeconds();
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
    updatePrayerTime();
    setNextPrayerMessage();
    clock.innerHTML = new Date().toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" }).toString().split(' ')[0];
    setInterval(() => {
        updatePrayerTime();
        setNextPrayerMessage();
        makeAzan();
        clock.innerHTML = new Date().toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" }).toString().split(' ')[0];
    }, 1000);
}

function makeAzan(){
    if(localStorage.getItem("autoAzan") === "true"){
        let date = new Date();
        let hours = date.getHours();
        let mins = date.getMinutes();
        let prayernames = ["fajr", "dhuhr", "asr", "maghrib", "isha"];
        for (let i = 0; i < prayernames.length; i++) {
            let element = prayernames[i];
            let eleHour = parseInt(dailyWS[element].split(":")[0]);
            let eleMin = parseInt(dailyWS[element].split(":")[1]);
            if (eleHour == hours && eleMin == mins && lastAzan != element) {
                if(element === "fajr"){
                    fazanAudio.play();
                }else{
                    azanAudio.play();
                }
                lastAzan = element;
            }
        }
    }
}

function getuserTimezone() {
    var offset = new Date().getTimezoneOffset();
    if (offset < 0)
        return offset / -60;
    else
        return offset / -60;
}
setTimeout(main(), 0);