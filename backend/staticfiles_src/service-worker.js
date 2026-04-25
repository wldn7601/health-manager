const CACHE = 'health-manager-v1'

// 설치 시 앱 셸만 캐시
self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(['/', '/record']))
  )
  self.skipWaiting()
})

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    )
  )
  self.clients.claim()
})

self.addEventListener('fetch', (e) => {
  const { request } = e
  const url = new URL(request.url)

  // API 요청은 캐시 안 함
  if (url.pathname.startsWith('/api/')) return

  // 정적 에셋(해시 포함)은 캐시 우선
  if (url.pathname.startsWith('/static/')) {
    e.respondWith(
      caches.match(request).then((cached) => cached || fetch(request).then((res) => {
        const clone = res.clone()
        caches.open(CACHE).then((c) => c.put(request, clone))
        return res
      }))
    )
    return
  }

  // 네비게이션 요청: 네트워크 우선, 실패 시 캐시된 / 반환
  if (request.mode === 'navigate') {
    e.respondWith(
      fetch(request).catch(() => caches.match('/'))
    )
  }
})
