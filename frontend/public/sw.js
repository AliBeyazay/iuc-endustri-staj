const CACHE_VERSION = 'iuc-staj-pwa-v1'
const OFFLINE_URL = '/offline'
const CORE_ASSETS = ['/', '/listings', OFFLINE_URL, '/logo.png']

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) => cache.addAll(CORE_ASSETS))
  )
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_VERSION)
          .map((key) => caches.delete(key))
      )
    )
  )
  self.clients.claim()
})

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return
  const requestUrl = new URL(event.request.url)

  if (event.request.mode === 'navigate') {
    event.respondWith(
      (async () => {
        try {
          const networkResponse = await fetch(event.request)
          const cache = await caches.open(CACHE_VERSION)
          cache.put(event.request, networkResponse.clone())
          return networkResponse
        } catch {
          const cachedPage = await caches.match(event.request)
          if (cachedPage) return cachedPage
          const offlinePage = await caches.match(OFFLINE_URL)
          if (offlinePage) return offlinePage
          return new Response('Offline', { status: 503, statusText: 'Offline' })
        }
      })()
    )
    return
  }

  // Cache static same-origin assets for faster repeat visits.
  if (
    requestUrl.origin === self.location.origin &&
    (requestUrl.pathname.startsWith('/_next/static/') ||
      requestUrl.pathname.endsWith('.css') ||
      requestUrl.pathname.endsWith('.js') ||
      requestUrl.pathname.endsWith('.png') ||
      requestUrl.pathname.endsWith('.svg'))
  ) {
    event.respondWith(
      caches.match(event.request).then((cached) => {
        if (cached) return cached
        return fetch(event.request).then((response) => {
          const cloned = response.clone()
          caches.open(CACHE_VERSION).then((cache) => cache.put(event.request, cloned))
          return response
        })
      })
    )
  }
})
