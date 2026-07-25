// Tab Memo ver1.3.0 Service Worker
// - キャッシュ対象はローカルアセットのみ
// - 外部リクエスト（api等）はキャッシュしない

const CACHE_NAME = "tab-memo-v1-3-0";
const ASSETS = [
  "./",
  "./index.html",
  "./style.css",
  "./app.js",
  "./manifest.json",
  "./icon.svg",
  "./icon-maskable.svg"
];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE_NAME).then(c => c.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", e => {
  const url = new URL(e.request.url);

  if (url.pathname.startsWith("/api/")) return;

  // 外部リクエスト（別オリジン）はキャッシュせずそのまま通す
  if (url.origin !== self.location.origin) {
    e.respondWith(fetch(e.request));
    return;
  }

  // ローカルサーバー利用時は更新を優先し、オフライン時だけキャッシュを使う
  e.respondWith(
    fetch(e.request)
      .then(response => {
        const copy = response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(e.request, copy));
        return response;
      })
      .catch(() => caches.match(e.request))
  );
});
