const SHELL = 'vns-shell-v1'
const DATA = 'vns-data-v1'

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(SHELL).then((cache) => cache.addAll(['/', '/manifest.webmanifest', '/icon.svg'])))
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((key) => ![SHELL, DATA].includes(key)).map((key) => caches.delete(key)))))
  self.clients.claim()
})

self.addEventListener('fetch', (event) => {
  const request = event.request
  const url = new URL(request.url)
  if (request.method !== 'GET' || url.origin !== location.origin || url.pathname.startsWith('/ws')) return
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) caches.open(DATA).then((cache) => cache.put(request, response.clone()))
          return response
        })
        .catch(() => caches.match(request).then((cached) => cached || new Response(JSON.stringify({ detail: 'Немає з’єднання з інтернетом, а збережених даних для цієї сторінки немає' }), { status: 503, headers: { 'content-type': 'application/json' } })))
    )
    return
  }
  if (request.mode === 'navigate') {
    event.respondWith(fetch(request).catch(() => caches.match('/')))
    return
  }
  event.respondWith(
    caches.match(request).then((cached) => cached || fetch(request).then((response) => {
      if (response.ok) caches.open(SHELL).then((cache) => cache.put(request, response.clone()))
      return response
    }))
  )
})
