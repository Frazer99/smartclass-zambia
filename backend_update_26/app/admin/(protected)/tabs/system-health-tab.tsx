'use client';

import { Loader as Loader2, TriangleAlert, Activity } from 'lucide-react';

interface ErrorLogEntry {
  id: string;
  source: string;
  error_message: string;
  error_context: Record<string, unknown>;
  severity: 'error' | 'warning';
  created_at: string;
  user_id: string | null;
}

interface SystemHealthTabProps {
  errors: ErrorLogEntry[];
  loading: boolean;
}

/**
 * The actually-buildable part of "production observability" from this
 * environment — not a replacement for a real third-party service like
 * Sentry (which needs an account this build environment can't create),
 * but a genuine, queryable record of what broke, when, and where,
 * living in the same database as everything else. Reads app_error_log
 * (migration 20260804080000), written to by every edge function's
 * catch-all error handler and the frontend's error.tsx boundaries.
 */
export function SystemHealthTab({ errors, loading }: SystemHealthTabProps) {
  if (loading) {
    return <div className="flex h-72 items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-gold" /></div>;
  }

  const last24h = errors.filter((e) => Date.now() - new Date(e.created_at).getTime() < 24 * 60 * 60 * 1000);
  const bySource: Record<string, number> = {};
  for (const e of last24h) bySource[e.source] = (bySource[e.source] || 0) + 1;
  const topSources = Object.entries(bySource).sort((a, b) => b[1] - a[1]).slice(0, 5);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display text-lg font-semibold text-chalk mb-1">System Health</h2>
        <p className="text-sm text-muted-board">
          Real error visibility, not a replacement for a dedicated service like Sentry — a genuine, queryable
          record of what broke, when, and where. Written by every Edge Function&apos;s catch-all handler and the
          app&apos;s own error boundaries.
        </p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <div className="card-board p-4">
          <div className="flex items-center gap-1.5 text-xs text-muted-board mb-1"><Activity className="h-3.5 w-3.5" /> Last 24 hours</div>
          <div className="font-mono-sc text-xl font-bold text-chalk">{last24h.length}</div>
        </div>
        <div className="card-board p-4">
          <div className="flex items-center gap-1.5 text-xs text-muted-board mb-1"><TriangleAlert className="h-3.5 w-3.5" /> Total logged</div>
          <div className="font-mono-sc text-xl font-bold text-chalk">{errors.length}</div>
        </div>
      </div>

      {topSources.length > 0 && (
        <div className="card-board p-5">
          <h3 className="font-display text-sm font-semibold text-chalk mb-3">Most common sources (last 24h)</h3>
          <div className="space-y-1.5">
            {topSources.map(([source, count]) => (
              <div key={source} className="flex items-center justify-between text-sm">
                <span className="text-chalk font-mono-sc text-xs">{source}</span>
                <span className="text-muted-board">{count}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="card-board p-5">
        <h3 className="font-display text-sm font-semibold text-chalk mb-3">Recent Errors</h3>
        {errors.length === 0 ? (
          <p className="text-sm text-muted-board">No errors logged — either everything&apos;s working, or nothing&apos;s calling logError() yet for a given path.</p>
        ) : (
          <div className="space-y-2 max-h-[600px] overflow-y-auto">
            {errors.map((e) => (
              <div key={e.id} className="border-b border-white/5 pb-2">
                <div className="flex items-center gap-2 text-xs">
                  <span className={`font-mono-sc ${e.severity === 'error' ? 'text-rust' : 'text-gold'}`}>{e.source}</span>
                  <span className="text-muted-board ml-auto shrink-0">
                    {new Date(e.created_at).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
                <p className="text-sm text-chalk mt-0.5">{e.error_message}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
