const cacheVersion = 'az-ivos-jatek-v7';
const appShell = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/maskable-192.png',
  './icons/maskable-512.png',
  './icons/apple-touch-icon.png',
];

async function cacheCurrentBuild(cache) {
  const indexResponse = await fetch('./index.html', { cache: 'reload' });
  if (!indexResponse.ok) return;

  const html = await indexResponse.clone().text();
  await cache.put('./index.html', indexResponse);

  const assetUrls = Array.from(html.matchAll(/(?:href|src)="([^"]+)"/g))
    .map((match) => match[1])
    .filter((url) => url.includes('/assets/') || url.includes('assets/'))
    .map((url) => new URL(url, self.location.href).toString());

  await Promise.all(assetUrls.map((url) => cache.add(url).catch(() => undefined)));
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(cacheVersion)
      .then(async (cache) => {
        await cache.addAll(appShell);
        await cacheCurrentBuild(cache);
      })
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((key) => key !== cacheVersion).map((key) => caches.delete(key))),
      )
      .then(() => self.clients.claim()),
  );
});

async function networkFirst(request) {
  const cache = await caches.open(cacheVersion);

  try {
    const response = await fetch(request);
    if (response.ok) {
      await cache.put(request, response.clone());
    }
    return response;
  } catch {
    return (await cache.match(request)) || (await cache.match('./index.html')) || (await cache.match('./'));
  }
}

async function cacheFirst(request) {
  const cachedResponse = await caches.match(request);
  if (cachedResponse) return cachedResponse;

  const response = await fetch(request);
  if (response.ok) {
    const cache = await caches.open(cacheVersion);
    await cache.put(request, response.clone());
  }
  return response;
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === 'navigate') {
    event.respondWith(networkFirst(request));
    return;
  }

  event.respondWith(cacheFirst(request));
});
