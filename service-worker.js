self.addEventListener("install", e => {
    e.waitUntil(
      caches.open("cycle-tracker").then(cache => {
        return cache.addAll([
          "./",
          "./index.html",
          "./styles.css",
          "./script.js",
          "./manifest.json"
          // Include icons here if you want offline support
        ]);
      })
    );
  });
  
  self.addEventListener("fetch", e => {
    e.respondWith(
      caches.match(e.request).then(response => {
        return response || fetch(e.request);
      })
    );
  });
  