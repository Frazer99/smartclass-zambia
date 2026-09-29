import { MessageSquare, Loader as Loader2 } from 'lucide-react';
import { UserFeedback } from '@/lib/supabase-client';

type FeedbackWithProfile = UserFeedback & { profile?: { full_name: string } | null; audio_url?: string | null };

const CATEGORY_LABELS: Record<UserFeedback['category'], string> = {
  complaint: 'Complaint',
  suggestion: 'Suggestion',
  system_performance: 'System performance',
  other: 'Other concern',
};

export function FeedbackTab({ feedback, loading }: { feedback: FeedbackWithProfile[]; loading: boolean }) {
  if (loading) return <div className="flex h-72 items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-gold" /></div>;

  return (
    <div className="space-y-5">
      <div>
        <div className="flex items-center gap-2 mb-1">
          <MessageSquare className="h-5 w-5 text-gold" />
          <h2 className="font-display text-lg font-semibold text-chalk">User feedback</h2>
        </div>
        <p className="text-sm text-muted-board">Review suggestions, complaints, and reports about system performance.</p>
      </div>

      {feedback.length === 0 ? (
        <div className="card-board p-8 text-center text-muted-board text-sm">No feedback has been submitted yet.</div>
      ) : (
        <div className="space-y-3">
          {feedback.map((item) => (
            <article key={item.id} className="card-board p-4 sm:p-5">
              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2 mb-3">
                <div>
                  <p className="text-sm font-semibold text-chalk">{item.profile?.full_name || 'Unknown pupil'}</p>
                  <p className="text-xs text-muted-board mt-0.5">{new Date(item.created_at).toLocaleString('en-GB')}</p>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs text-gold border border-gold/40 rounded-full px-2 py-1">
                    {CATEGORY_LABELS[item.category]}
                  </span>
                  <span className="text-xs text-muted-board border border-white/15 rounded-full px-2 py-1 capitalize">
                    {item.status.replace('_', ' ')}
                  </span>
                </div>
              </div>
              <p className="text-sm text-chalk/90 bg-white/5 rounded-lg p-3 whitespace-pre-wrap">{item.message}</p>
              {item.audio_url && (
                <div className="mt-3 rounded-lg border border-teal/30 bg-teal/5 p-3">
                  <p className="text-xs text-teal font-semibold mb-2">Voice recording</p>
                  <audio controls src={item.audio_url} className="w-full h-9" />
                </div>
              )}
              <p className="text-xs text-muted-board mt-3">
                {item.contact_allowed ? 'The user agreed to be contacted.' : 'The user did not request follow-up.'}
              </p>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}