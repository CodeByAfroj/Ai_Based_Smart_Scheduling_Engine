// Service Worker Version: 1.1
self.addEventListener('push', function(event) {
  let data = {};
  if (event.data) {
    try {
      data = event.data.json();
    } catch(e) {
      data = { body: event.data.text() };
    }
  }

  const title = data.title || 'TaskPulse Reminder';
  const options = {
    body: data.body || 'You have a scheduled task starting now.',
    icon: data.icon || (self.location.origin + '/pwa-192x192.png'),
    badge: data.badge || (self.location.origin + '/badge.png'),
    vibrate: [500, 250, 500, 250, 500],
    requireInteraction: data.requireInteraction !== undefined ? data.requireInteraction : true,
    renotify: true,
    tag: data.tag || 'taskpulse-alarm',
    data: { url: data.url || '/' },
    actions: [
      { action: 'open', title: '⏰ Open Task' }
    ]
  };

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(clientList) {
      clientList.forEach(function(client) {
        client.postMessage({
          type: 'PLAY_ALARM',
          title: title,
          body: options.body
        });
      });
      return self.registration.showNotification(title, options);
    })
  );
});

self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: 'window' }).then(windowClients => {
      // Check if there is already a window/tab open with the target URL
      for (var i = 0; i < windowClients.length; i++) {
        var client = windowClients[i];
        if (client.url === event.notification.data.url && 'focus' in client) {
          return client.focus();
        }
      }
      // If not, open a new window/tab
      if (clients.openWindow) {
        return clients.openWindow(event.notification.data.url);
      }
    })
  );
});
