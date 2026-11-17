
const CACHE_NAME = "jact-v1";

self.addEventListener("install", event => {
  self.skipWaiting();
});

self.addEventListener("activate", event => {
  event.waitUntil(self.clients.claim());
});

// Receive push notifications
self.addEventListener("push", event => {
  let data = {};

  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = {
      title: "JACT Motorcycle",
      body: event.data ? event.data.text() : "You have a new notification."
    };
  }

  const title = data.title || "JACT Motorcycle";

  const options = {
    body: data.body || "You have a new update.",
    icon: data.icon || undefined,
    badge: data.badge || undefined,
    tag: data.tag || "jact-notification",
    renotify: true,
    silent: false,
    data: {
      url: data.url || "/Buisness-idea/admin/dashboard.html"
    }
  };

  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

// Open the correct page when notification is tapped
self.addEventListener("notificationclick", event => {
  event.notification.close();

  const target = new URL(
    event.notification.data.url,
    self.location.origin
  );

  event.waitUntil(
    self.clients.matchAll({
      type: "window",
      includeUncontrolled: true
    }).then(clients => {
      for (const client of clients) {
        if (client.url.startsWith(self.location.origin)) {
          return client.navigate(target.href).then(() => client.focus());
        }
      }

      return self.clients.openWindow(target.href);
    })
  );
});
