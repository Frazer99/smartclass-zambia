'use client';

import { useEffect, useState } from 'react';
import { WifiOff } from 'lucide-react';

/**
 * Shown only when the browser reports no network connection at all —
 * intentionally specific about what won't work rather than a vague
 * "you're offline" message, since some things genuinely still work
 * (previously-viewed lessons, via the service worker's cached Supabase
 * reads) and some categorically can't (AI chat, the live avatar,
 * payments, signing in). A pupil deserves to know which is which rather
 * than assume the whole app is broken.
 */
export function OfflineBanner() {
  const [isOffline, setIsOffline] = useState(false);

  useEffect(() => {
    setIsOffline(!navigator.onLine);
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  if (!isOffline) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-50 bg-rust text-chalk text-xs sm:text-sm px-4 py-2 flex items-center justify-center gap-2 text-center">
      <WifiOff className="h-3.5 w-3.5 shrink-0" />
      <span>
        You&apos;re offline. Lessons you&apos;ve already opened are still available, but AI chat, saving new
        progress, and payments need a connection.
      </span>
    </div>
  );
}
