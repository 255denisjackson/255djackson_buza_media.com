/* Buza Media — service worker: shows story notifications on the phone and opens the story when tapped. */
self.addEventListener('install', function () { self.skipWaiting(); });
self.addEventListener('activate', function (e) { e.waitUntil(self.clients.claim()); });

self.addEventListener('push', function (event) {
  var d = {};
  try { d = event.data ? event.data.json() : {}; }
  catch (err) { d = { title: 'Buza Media', body: event.data ? event.data.text() : '' }; }
  var options = {
    body: d.body || 'Habari mpya kwenye Buza Media',
    icon: d.icon || undefined,
    badge: d.icon || undefined,
    image: d.image || undefined,
    tag: d.tag || 'buza-news',
    data: { url: d.url || self.registration.scope }
  };
  event.waitUntil(self.registration.showNotification(d.title || 'Buza Media', options));
});

self.addEventListener('notificationclick', function (event) {
  event.notification.close();
  var url = (event.notification.data && event.notification.data.url) || self.registration.scope;
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (list) {
      for (var i = 0; i < list.length; i++) {
        var c = list[i];
        if (c.url.indexOf(self.registration.scope) === 0 && 'focus' in c) {
          if ('navigate' in c) c.navigate(url);
          return c.focus();
        }
      }
      return self.clients.openWindow(url);
    })
  );
});
