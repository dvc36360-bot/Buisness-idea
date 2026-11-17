self.addEventListener("push", event => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (_) {
    data = { body: event.data ? event.data.text() : "" };
  }

  const title = data.title || "JACT Motorcycle";
  const options = {
    body: data.body || "You have a new JACT update.",
    icon: new URL("jact-icon.svg", self.registration.scope).href,
    badge: new URL("jact-icon.svg", self.registration.scope).href,
    data: { url: data.url || "admin/dashboard.html" },
    tag: data.tag || "jact-update",
    renotify: true
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", event => {
  event.notification.close();
  const target = new URL(event.notification.data?.url || "admin/dashboard.html", self.registration.scope);
  event.waitUntil((async () => {
    const windows = await clients.matchAll({ type: "window", includeUncontrolled: true });
    for (const client of windows) {
      if (new URL(client.url).origin === target.origin) {
        await client.navigate(target.href);
        return client.focus();
      }
    }
    return clients.openWindow(target.href);
  })());
});
