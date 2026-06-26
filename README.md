# PrayerTime

A lightweight, frontend-only prayer times app with Qibla direction, compass guidance, and Azan notifications.

## Features

- **Prayer Times Calculation** — Uses [Adhan.js](https://github.com/batoulapps/Adhan_JS) for accurate Islamic prayer time calculations
- **Live Countdown** — Real-time countdown to the next prayer with auto-updating "Next"/"Now" highlights
- **Hijri Date** — Shows the current Islamic (Umm al-Qura) date
- **Place Names** — Reverse-geocodes coordinates to a readable location (with graceful fallback)
- **Qibla Direction** — Computes the direction to Mecca with mathematical precision
- **Device Compass** — Shows live compass-guided alignment to Qibla (mobile devices)
- **Azan Notifications** — Browser notifications with optional custom audio playback
- **Location Auto-Detection** — Geolocation API integration with manual override
- **Settings Persistence** — localStorage-based calculation method and madhab preferences
- **Offline-Ready** — Service Worker support for offline functionality

## Architecture

```
index.html           — Semantic markup
css/
  styles.css         — App styles (dark theme, compass, responsive)
js/
  main.js            — Application logic (DOMContentLoaded entry point)
  vendor/
    adhan.umd.min.js — Adhan.js library (bundled UMD)
sw.js                — Service Worker for offline & notifications
manifest.json        — PWA manifest (icons under images/icons/)
```

## Setup

1. **Clone or download** this repository
2. **Open** `index.html` in a modern web browser
3. **Allow permissions** for geolocation (automatic) and notifications (click "Enable Azan")

## Configuration

### Custom Adhan Audio

Place an MP3 file named `adhan.mp3` in the project root:

```
PrayerTime/
├── index.html
├── adhan.mp3          ← Add here (or per-prayer files: fajr.mp3, dhuhr.mp3, …)
└── js/
```

The app plays a prayer-specific file (e.g. `fajr.mp3`) if present, otherwise falls back to `adhan.mp3` on each prayer time. If playback fails (browser autoplay restrictions), it falls back to Speech Synthesis or a system beep.

### Settings

Click **Settings** to choose:
- **Calculation Method**: Muslim World League, North America (ISNA), Egyptian, Umm Al-Qura, Karachi, Tehran
- **Asr Method**: Standard (Shafi'i) or Hanafi
- **24-hour time**: Toggle between 12-hour and 24-hour clock display

Settings are saved to `localStorage` and persist across sessions.

## Browser Support

- **Modern Chromium** (Chrome, Edge, Brave)
- **Firefox 60+**
- **Safari 12+** (iOS 13+)

Requires:
- ES6+ JavaScript support
- Geolocation API
- localStorage
- Notification API (optional, for alerts)
- Device Orientation API (mobile compass)

## Deployment

### Local Development

```bash
# Using Python 3
python -m http.server 8000

# Using Node.js http-server
npx http-server

# Using PHP
php -S localhost:8000
```

Open `http://localhost:8000`

### Production

1. Deploy to any static hosting (Vercel, Netlify, GitHub Pages, AWS S3 + CloudFront)
2. For notifications over HTTP, use HTTPS
3. Ensure `index.html`, `js/`, and `sw.js` are all accessible

### HTTPS Requirement (Notifications)

Notifications require the page to be served over HTTPS (or localhost). Service Worker registration also works best on HTTPS.

## Notes

- Prayer times are calculated locally using Adhan.js (no server dependency)
- Qibla computation uses the [Haversine formula](https://en.wikipedia.org/wiki/Haversine_formula) and forward azimuth bearing
- Compass guidance requires device motion sensors (mobile only)
- Geolocation fallback: manually enter coordinates (latitude, longitude) if auto-detection fails or is denied

## License

MIT. See individual library licenses (Adhan.js is Apache 2.0)