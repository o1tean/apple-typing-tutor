// VERSION and PRECACHE are generated from the finished build.
const scope = new URL(self.registration.scope);
const prefix = `typeflow-offline:${scope.href}:`;
const cacheName = prefix + VERSION;
const indexURL = new URL('index.html', scope).href;
const requests = PRECACHE.map(({ url, integrity }) => new Request(new URL(url, scope), {
    cache: 'reload',
    integrity
}));
const assetURLs = new Set(requests.map(request => request.url));

self.addEventListener('install', event => {
    event.waitUntil(caches.open(cacheName).then(cache => cache.addAll(requests)));
});

self.addEventListener('activate', event => {
    event.waitUntil(caches.keys().then(names => Promise.all(
        names.filter(name => name.startsWith(prefix) && name !== cacheName)
        .map(name => caches.delete(name))
    )));
});

self.addEventListener('fetch', event => {
    const request = event.request;
    const url = new URL(request.url);
    if (request.method !== 'GET' || url.origin !== scope.origin) return;

    const appNavigation = request.mode === 'navigate' &&
        (url.pathname === scope.pathname || url.pathname === new URL(indexURL).pathname);
    const cachedURL = appNavigation ? indexURL : url.href;
    if (!assetURLs.has(cachedURL)) return;

    event.respondWith(caches.open(cacheName)
        .then(cache => cache.match(cachedURL))
        .then(response => response || fetch(request)));
});
