'use client';

import { Activity, Loader as Loader2, TriangleAlert } from 'lucide-react';

export interface ErrorLogEntry {
  id: string;
  source: string;
  error_message: string;
  error_context: Record<string, unknown>;
  severity: 'error' | 'warning';
  created_at: string;
  user_id: string | null;
}

export function SystemHealthTab({ errors, loading }: { errors: ErrorLogEntry[]; loading: boolean }) {
  if (loading) return <div className="flex h-72 items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-gold" /></div>;

  const last24h = errors.filter((entry) => Date.now() - new Date(entry.created_at).getTime() < 24 * 60 * 60 * 1000);
  const sourceCounts = last24h.reduce<Record<string, number>>((counts, entry) => {
    counts[entry.source] = (counts[entry.source] || 0) + 1;
    return counts;
  }, {});
  const topSources = Object.entries(sourceCounts).sort((a, b) => b[1] - a[1]).slice(0, 5);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display text-lg font-semibold text-chalk mb-1">System Health</h2>
        <p className="text-sm text-muted-board">Recent application errors recorded by the active error log.</p>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="card-board p-4"><div className="flex items-center gap-1.5 text-xs text-muted-board mb-1"><Activity className="h-3.5 w-3.5" /> Last 24 hours</div><div className="font-mono-sc text-xl font-bold text-chalk">{last24h.length}</div></div>
        <div className="card-board p-4"><div className="flex items-center gap-1.5 text-xs text-muted-board mb-1"><TriangleAlert className="h-3.5 w-3.5" /> Total logged</div><div className="font-mono-sc text-xl font-bold text-chalk">{errors.length}</div></div>
      </div>
      {topSources.length > 0 && <div className="card-board p-5"><h3 className="font-display text-sm font-semibold text-chalk mb-3">Most common sources</h3><div className="space-y-1.5">{topSources.map(([source, count]) => <div key={source} className="flex items-center justify-between text-sm"><span className="text-chalk font-mono-sc text-xs">{source}</span><span className="text-muted-board">{count}</span></div>)}</div></div>}
      <div className="card-board p-5"><h3 className="font-display text-sm font-semibold text-chalk mb-3">Recent errors</h3>{errors.length === 0 ? <p className="text-sm text-muted-board">No errors have been logged.</p> : <div className="space-y-2 max-h-[600px] overflow-y-auto">{errors.map((entry) => <div key={entry.id} className="border-b border-white/5 pb-2"><div className="flex items-center gap-2 text-xs"><span className={`font-mono-sc ${entry.severity === 'error' ? 'text-rust' : 'text-gold'}`}>{entry.source}</span><span className="text-muted-board ml-auto shrink-0">{new Date(entry.created_at).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</span></div><p className="text-sm text-chalk mt-0.5">{entry.error_message}</p></div>)}</div>}</div>
    </div>
  );
}
