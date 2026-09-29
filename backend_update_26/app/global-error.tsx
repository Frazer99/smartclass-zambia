'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { TriangleAlert } from 'lucide-react';
import { logClientError } from '@/lib/logError';

/**
 * Next.js's native error boundary convention (error.tsx) — catches any
 * rendering error not caught by a more specific error.tsx further down
 * the route tree. Logs to app_error_log (the same real, queryable error
 * record the Edge Functions write to) so a rendering crash is actually
 * visible somewhere, not just a blank screen for whoever hit it.
 */
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    logClientError('frontend:root', error, { digest: error.digest });
  }, [error]);

  return (
    <html lang="en">
      <body className="bg-board text-chalk min-h-screen flex items-center justify-center px-4">
        <div className="max-w-sm text-center">
          <TriangleAlert className="h-10 w-10 text-rust mx-auto mb-4" />
          <h1 className="font-display text-xl font-semibold mb-2">Something went wrong</h1>
          <p className="text-sm text-muted-board mb-6">
            This has been logged. Try again, or head back to the homepage.
          </p>
          <div className="flex gap-3 justify-center">
            <button onClick={reset} className="btn-gold px-4 py-2 text-sm">Try again</button>
            <Link href="/" className="border border-white/15 text-chalk px-4 py-2 text-sm rounded-lg hover:bg-white/5 transition-colors">
              Go home
            </Link>
          </div>
        </div>
      </body>
    </html>
  );
}
