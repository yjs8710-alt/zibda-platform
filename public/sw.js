// Self-unregistering no-op service worker.
// Previously this SW intercepted every fetch with `cache: "no-store"`, which
// disabled all browser/HTTP caching and made initial loads very slow.
self.addEventListener("install", () => self.skipWaiting());

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      try {
        const keys = await caches.keys();
        await Promise.all(keys.map((key) => caches.delete(key)));
      } catch {
        // ignore
      }
      try {
        await self.registration.unregister();
      } catch {
        // ignore
      }
    })()
  );
});

// No fetch handler — let the browser handle requests with normal HTTP caching.
