// Service Worker Version: 1.2
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
  const notifPref = data.notification_preference || 'text_and_sound';
  const isSilent = notifPref === 'silent' || Boolean(data.silent);
  const isVibrate = notifPref === 'vibrate';

  const options = {
    body: data.body || 'You have a scheduled task starting now.',
    icon: data.icon || (self.location.origin + '/pwa-192x192.png'),
    badge: data.badge || (self.location.origin + '/badge.png'),
    vibrate: isSilent ? [] : (data.vibrate || (isVibrate ? [500, 250, 500, 250, 500] : [300, 150, 300])),
    silent: isSilent,
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
      if (!isSilent && notifPref !== 'vibrate') {
        clientList.forEach(function(client) {
          client.postMessage({
            type: 'PLAY_ALARM',
            title: title,
            body: options.body,
            notification_preference: notifPref
          });
        });
      }
      return self.registration.showNotification(title, options);
    })
  );
});

self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: 'window' }).then(windowClients => {
      // Send STOP_ALARM signal to active tabs when notification is clicked
      for (var i = 0; i < windowClients.length; i++) {
        var client = windowClients[i];
        client.postMessage({ type: 'STOP_ALARM' });
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
