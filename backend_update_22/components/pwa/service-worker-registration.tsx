'use client';

import { useEffect } from 'react';

/**
 * Registers public/sw.js on mount. A no-op (not an error) in any
 * environment without service worker support, or during local
 * development where the extra caching layer usually just gets in the
 * way of seeing fresh changes — only registers outside development.
 */
export function ServiceWorkerRegistration() {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production') return;
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;

    navigator.serviceWorker.register('/sw.js').catch((err) => {
      console.error('Service worker registration failed (non-fatal):', err);
    });
  }, []);

  return null;
}
