/**
 * SmartClass Zambia service worker.
 *
 * WHAT THIS ACTUALLY MAKES WORK OFFLINE:
 *   - The app shell itself (so opening the app with no connection shows
 *     the real interface, not a browser error page)
 *   - Previously-viewed lesson/topic/subject/past-paper content (GET
 *     requests to Supabase's REST API) — a pupil who already opened a
 *     lesson can re-read it later with no connection
 *
 * WHAT THIS DELIBERATELY DOES NOT PRETEND TO MAKE WORK OFFLINE:
 *   - AI chat (ai-teacher-chat), the live video avatar, greetings,
 *     payments, sign-in — anything under /functions/v1/ or /auth/v1/ is
 *     NEVER cached and always goes straight to the network. These
 *     categorically require a live connection (a real OpenAI/LiveAvatar/
 *     DPO call cannot be faked from a cache), and caching a stale
 *     "successful" response for one of these would be actively
 *     misleading, not helpful.
 *
 * No build-time precache list — Next.js gives every JS/CSS chunk a
 * content hash that changes on every deploy, so a hardcoded list of
 * asset URLs would go stale the moment the app is redeployed. Runtime
 * caching (cache what's actually requested, as it's requested) instead.
 */

const CACHE_VERSION = 'smartclass-v1';
const STATIC_CACHE = `${CACHE_VERSION}-static`;
const DATA_CACHE = `${CACHE_VERSION}-data`;

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key.startsWith('smartclass-') && key !== STATIC_CACHE && key !== DATA_CACHE)
          .map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = request.url;

  // Never intercept anything that isn't a plain GET — a service worker
  // cannot meaningfully cache a POST/PUT/PATCH/DELETE, and trying to
  // would just risk replaying a stale mutation.
  if (request.method !== 'GET') return;

  // Never cache anything AI-, auth-, or payment-related — these must
  // always be live. Let a failed fetch here fail normally; the app's own
  // UI (not this service worker) is responsible for showing a clear
  // "you're offline" message for these.
  if (url.includes('/functions/v1/') || url.includes('/auth/v1/')) {
    return;
  }

  // Supabase REST API reads (topics, lessons, subjects, past papers,
  // etc.) — cache-first for instant offline reads of anything the pupil
  // has already loaded once, but always refresh the cache from the
  // network in the background so the next load gets current data. This
  // is the actual "offline lesson content" feature.
  if (url.includes('/rest/v1/')) {
    event.respondWith(staleWhileRevalidate(request, DATA_CACHE));
    return;
  }

  // Same-origin static assets (Next.js's hashed JS/CSS chunks, fonts,
  // icons) — cache-first. Safe to cache aggressively since Next.js's own
  // content-hashed filenames mean a changed file is a NEW url, never a
  // silently-stale one.
  if (url.startsWith(self.location.origin) && /\.(js|css|woff2?|png|svg|ico)$/.test(new URL(url).pathname)) {
    event.respondWith(cacheFirst(request, STATIC_CACHE));
    return;
  }

  // HTML page navigations — network-first (prefer the current page),
  // falling back to whatever was last cached if there's no connection,
  // so the app shell still loads instead of a browser error page.
  if (request.mode === 'navigate') {
    event.respondWith(networkFirst(request, STATIC_CACHE));
    return;
  }

  // Anything else (third-party requests, etc.) — let the browser handle
  // it normally, no interception.
});

async function cacheFirst(request, cacheName) {
  const cached = await caches.match(request);
  if (cached) return cached;
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, response.clone());
    }
    return response;
  } catch (e) {
    // Nothing cached and no network — genuinely nothing this service
    // worker can do; let the browser show its own offline error for
    // this specific asset rather than pretending to have a fallback.
    throw e;
  }
}

async function networkFirst(request, cacheName) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, response.clone());
    }
    return response;
  } catch (e) {
    const cached = await caches.match(request);
    if (cached) return cached;
    throw e;
  }
}

async function staleWhileRevalidate(request, cacheName) {
  const cached = await caches.match(request);
  const networkPromise = fetch(request)
    .then((response) => {
      if (response.ok) {
        caches.open(cacheName).then((cache) => cache.put(request, response.clone()));
      }
      return response;
    })
    .catch(() => null);

  // Serve the cached version immediately if we have one (instant, works
  // offline); otherwise wait for the network — nothing to fall back to
  // for data that's never been fetched before.
  return cached || (await networkPromise) || new Response(JSON.stringify({ error: 'offline', data: null }), {
    status: 503,
    headers: { 'Content-Type': 'application/json' },
  });
}
