// Lets phones show Jade Physio's notifications: Android Chrome only shows them through a service worker.
// Nothing is cached; every request goes to the network as usual.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));

// Tapping a notification brings the app to the front (or opens it).
self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  e.waitUntil(
    (async () => {
      const open = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      if (open[0]) return open[0].focus();
      return self.clients.openWindow("/");
    })(),
  );
});
