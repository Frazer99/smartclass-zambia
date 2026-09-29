'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { TriangleAlert } from 'lucide-react';
import { logClientError } from '@/lib/logError';

/**
 * The common case — Next.js's error.tsx convention, catching rendering
 * errors within the normal layout (unlike global-error.tsx, which only
 * fires for catastrophic errors in the root layout itself and has to
 * render its own <html>/<body>). Logs to app_error_log the same way.
 */
export default function ErrorBoundary({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    logClientError('frontend:page', error, { digest: error.digest });
  }, [error]);

  return (
    <div className="min-h-screen bg-board text-chalk flex items-center justify-center px-4">
      <div className="max-w-sm text-center">
        <TriangleAlert className="h-10 w-10 text-rust mx-auto mb-4" />
        <h1 className="font-display text-xl font-semibold mb-2">Something went wrong</h1>
        <p className="text-sm text-muted-board mb-6">
          This has been logged. Try again, or head back to your dashboard.
        </p>
        <div className="flex gap-3 justify-center">
          <button onClick={reset} className="btn-gold px-4 py-2 text-sm">Try again</button>
          <Link href="/dashboard" className="border border-white/15 text-chalk px-4 py-2 text-sm rounded-lg hover:bg-white/5 transition-colors">
            Go to Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
