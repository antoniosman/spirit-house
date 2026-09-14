const CACHE = "spirit-house-v9";
const ASSETS = [
  "./",
  "index.html",
  "style.css",
  "app.js",
  "engine.js",
  "manifest.webmanifest",
  "version.json",
  "icon.svg",
  "apple-touch-icon.png",
  "intro_music.mp3",
  ...[
    "Alex.webp",
    "Billy.webp",
    "Catherine.png",
    "demarin.webp",
    "elisa.webp",
    "Eva.png",
    "Evaggelia.png",
    "evelyn.webp",
    "hope.webp",
    "Ian.png",
    "irene.png",
    "Jasmine.png",
    "Luna.webp",
    "pauline.webp",
    "Paul.png",
    "phillip.webp",
    "rino.webp",
    "sargenie.jpeg",
    "smaragda.jpeg",
    "Sorina.png",
    "tony.webp",
    "vicky.jpg",
    "Vincent.jpg",
    "Violet.png",
    "zoe.jpeg",
    "Ester.png",
  ].map((x) => "characters/" + x),
];
self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)));
  self.skipWaiting();
});
self.addEventListener("message", (e) => {
  if (e.data === "SKIP_WAITING") self.skipWaiting();
});
self.addEventListener("activate", (e) =>
  e.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((k) => k.startsWith("spirit-house-") && k !== CACHE)
            .map((k) => caches.delete(k)),
        ),
      )
      .then(() => self.clients.claim()),
  ),
);
self.addEventListener("fetch", (e) => {
  if (
    e.request.method !== "GET" ||
    new URL(e.request.url).origin !== self.location.origin
  )
    return;
  const url = new URL(e.request.url);
  if (e.request.mode === "navigate" || url.pathname.endsWith("version.json")) {
    e.respondWith(
      fetch(e.request)
        .then((response) => {
          if (e.request.mode === "navigate") {
            const copy = response.clone();
            caches.open(CACHE).then((cache) => cache.put("./", copy));
          }
          return response;
        })
        .catch(() =>
          caches
            .match(e.request)
            .then((cached) => cached || caches.match("./")),
        ),
    );
    return;
  }
  e.respondWith(
    caches.match(e.request).then((cached) => {
      const refresh = fetch(e.request)
        .then((response) => {
          if (response.ok)
            caches
              .open(CACHE)
              .then((cache) => cache.put(e.request, response.clone()));
          return response;
        })
        .catch(() => cached);
      return cached || refresh;
    }),
  );
});
