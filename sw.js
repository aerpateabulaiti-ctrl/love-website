// Cache only versioned public thumbnails. HTML, API records and original photos stay network-driven.
const THUMBNAIL_CACHE = 'love-photo-previews-v2';
const CACHE_PREFIX = 'love-photo-previews-';
const THUMBNAIL_ORIGIN = 'https://okpcwsianqkouitdwhvx.supabase.co';
const THUMBNAIL_PATH = '/storage/v1/object/public/photos/thumbnails/v1/';
const LOCAL_THUMBNAIL_PATH = '/media/photos/thumbnails/v1/';
const MAX_PREVIEWS = 160;
self.addEventListener('install', event => event.waitUntil(self.skipWaiting()));
self.addEventListener('activate', event => {
    event.waitUntil((async () => {
        const names = await caches.keys();
        await Promise.all(names.filter(name => name.startsWith(CACHE_PREFIX) && name !== THUMBNAIL_CACHE).map(name => caches.delete(name)));
        await self.clients.claim();
    })());
});
async function cachedThumbnail(request) {
    let cache;
    try {
        cache = await caches.open(THUMBNAIL_CACHE);
        const cached = await cache.match(request);
        if (cached) return cached;
    } catch (_) { /* Browsers with restricted storage still use the network. */ }
    const response = await fetch(request);
    if (response.ok && cache) {
        try {
            await cache.put(request, response.clone());
            const keys = await cache.keys();
            if (keys.length > MAX_PREVIEWS) await cache.delete(keys[0]);
        } catch (_) { /* Caching is optional; never discard a successfully fetched image. */ }
    }
    return response;
}
self.addEventListener('fetch', event => {
    const url = new URL(event.request.url);
    const remoteThumbnail = url.origin === THUMBNAIL_ORIGIN && url.pathname.startsWith(THUMBNAIL_PATH);
    const localThumbnail = url.origin === self.location.origin && url.pathname.startsWith(LOCAL_THUMBNAIL_PATH);
    if (event.request.method !== 'GET' || (!remoteThumbnail && !localThumbnail)) return;
    event.respondWith(cachedThumbnail(event.request));
});
