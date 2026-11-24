const scope = new URL(self.registration.scope)
const cachePrefix = `watchparty-offline|${scope.pathname}|`
const cacheName = `${cachePrefix}3f0d6801920440da`
const offlinePage = new URL('offline.html', scope).href
const offlineResources = new Map([
  [new URL('offline.css', scope).href, 'style'],
  [new URL('offline.js', scope).href, 'script'],
])

self.addEventListener('install', (event) => {
  const assets = [offlinePage, ...offlineResources.keys()].map((url) => new Request(url, {
    cache: 'reload', credentials: 'omit', redirect: 'error',
  }))
  event.waitUntil(caches.open(cacheName).then((cache) => cache.addAll(assets)))
})

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const names = await caches.keys()
    await Promise.all(names.filter((name) => name.startsWith(cachePrefix) && name !== cacheName)
      .map((name) => caches.delete(name)))
    await self.clients.claim()
  })())
})

self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET' || request.headers.has('Authorization')) return
  const url = new URL(request.url)
  if (url.origin !== scope.origin) return

  // Only the app entry can fall back to the public offline document. Never cache its live response.
  if (request.mode === 'navigate' && (url.pathname === scope.pathname || url.pathname === `${scope.pathname}index.html`)) {
    event.respondWith(fetch(request).catch(async () => {
      const cache = await caches.open(cacheName)
      return (await cache.match(offlinePage)) ?? Response.error()
    }))
  } else if (offlineResources.get(url.href) === request.destination) {
    event.respondWith(caches.open(cacheName).then(async (cache) => (await cache.match(url.href)) ?? fetch(request)))
  }
})
