// Lightweight service worker for PrayerTime app
self.addEventListener('install', event => {
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(self.clients.claim());
});

// Show notification when message received from page
self.addEventListener('message', event => {
  try{
    const data = event.data || {};
    if(data && data.type === 'azan' && data.title){
      const title = data.title;
      const opts = {
        body: data.body || '',
        tag: data.tag || 'azan',
        renotify: true,
        data: data
      };
      self.registration.showNotification(title, opts);
    }
  }catch(e){console.error(e)}
});

self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  event.waitUntil(clients.matchAll({type:'window',includeUncontrolled:true}).then(windowClients => {
    for (var i = 0; i < windowClients.length; i++) {
      var client = windowClients[i];
      if (client.url && 'focus' in client) return client.focus();
    }
    if (clients.openWindow) return clients.openWindow('/');
  }));
});

// Simple fetch handler: serve from network by default
self.addEventListener('fetch', function(event){
  // noop - default network behavior
});
