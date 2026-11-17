/* JACT admin Web Push registration. Requires HTTPS and a supported browser. */
(function () {
  function decodeVapidKey(base64String) {
    const padding = "=".repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
    const raw = atob(base64);
    return Uint8Array.from([...raw].map(char => char.charCodeAt(0)));
  }

  async function registerAdminPush() {
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
      throw new Error("This browser does not support web push notifications.");
    }
    if (!window.JACT_CONFIG?.vapidPublicKey) {
      throw new Error("The public VAPID key is missing from config.js.");
    }

    const client = await getSupabase();
    const { data: sessionData, error: sessionError } = await client.auth.getSession();
    if (sessionError) throw sessionError;
    const token = sessionData.session?.access_token;
    if (!token) throw new Error("Please sign in to the JACT admin account first.");

    const workerUrl = new URL("../sw.js", location.href);
    const scopeUrl = new URL("../", location.href);
    const registration = await navigator.serviceWorker.register(workerUrl.pathname, {
      scope: scopeUrl.pathname
    });
    await navigator.serviceWorker.ready;

    const permission = await Notification.requestPermission();
    if (permission !== "granted") {
      throw new Error("Notification permission was not granted. Check browser settings.");
    }

    let subscription = await registration.pushManager.getSubscription();
    if (!subscription) {
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: decodeVapidKey(window.JACT_CONFIG.vapidPublicKey)
      });
    }

    const response = await fetch(
      window.JACT_CONFIG.supabaseUrl + "/functions/v1/send-push",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "apikey": window.JACT_CONFIG.supabaseAnonKey,
          "Authorization": "Bearer " + token
        },
        body: JSON.stringify({
          action: "subscribe",
          subscription: subscription.toJSON()
        })
      }
    );

    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.error || "Could not save this device subscription.");
    return "Notifications are enabled on this device.";
  }

  window.enableJactAdminPush = function () {
    const header = document.querySelector(".admin-header-right");
    if (!header || document.getElementById("enable-jact-push")) return;

    const button = document.createElement("button");
    button.id = "enable-jact-push";
    button.type = "button";
    button.className = "button button-ghost button-small";
    button.textContent = "Enable notifications";
    button.addEventListener("click", async () => {
      button.disabled = true;
      const original = button.textContent;
      button.textContent = "Enabling...";
      try {
        const message = await registerAdminPush();
        button.textContent = "✓ Notifications on";
        button.title = message;
      } catch (error) {
        button.textContent = original;
        alert(error.message || "Could not enable notifications.");
      } finally {
        button.disabled = false;
      }
    });
    header.insertBefore(button, header.firstChild);
  };
})();
