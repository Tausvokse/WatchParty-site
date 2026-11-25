const scope = new URL(self.registration.scope)
const cachePrefix = `watchparty-offline|${scope.pathname}|`
const cacheName = `${cachePrefix}0d83725382ed3f4e`
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

const notificationText = {
  uk: { joined: 'Партнер зайшов у кімнату', chat: 'Нове повідомлення від партнера', room: 'Кімната' },
  en: { joined: 'Your partner opened the room', chat: 'New message from your partner', room: 'Room' },
}
const roomId = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

self.addEventListener('push', (event) => {
  let data
  try {
    data = event.data?.json()
  } catch {
    return
  }
  if (!data || !roomId.test(String(data.room)) || !['joined', 'chat'].includes(data.kind)) return
  const text = notificationText[data.locale === 'en' ? 'en' : 'uk']
  const title = typeof data.title === 'string' && data.title ? data.title.slice(0, 80) : text.room
  const body = data.kind === 'chat' && typeof data.text === 'string' ? `${text.chat}: ${data.text.slice(0, 140)}` : text[data.kind]
  event.waitUntil((async () => {
    // An open room already shows the same thing.
    const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
    if (windows.some((client) => client.visibilityState === 'visible' && new URL(client.url).hash.includes(data.room))) return
    await self.registration.showNotification(title, {
      body, tag: `${data.room}:${data.kind}`, icon: new URL('icons/icon-192.png', scope).href,
      data: { url: new URL(`#/rooms/${data.room}`, scope).href },
    })
  })())
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const target = event.notification.data?.url
  if (typeof target !== 'string' || !target.startsWith(scope.href)) return
  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
    const open = windows.find((client) => client.url.startsWith(scope.href))
    if (open) {
      await open.focus()
      await open.navigate(target).catch(() => undefined)
    } else {
      await self.clients.openWindow(target)
    }
  })())
})
