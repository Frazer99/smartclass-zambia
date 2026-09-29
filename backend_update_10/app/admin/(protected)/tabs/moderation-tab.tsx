'use client';

import { TriangleAlert, CircleCheck as CheckCircle2, Loader as Loader2 } from 'lucide-react';

interface ModerationFlag {
  id: string;
  user_id: string | null;
  message: string;
  categories: Record<string, boolean>;
  severity: 'self_harm' | 'other';
  reviewed: boolean;
  created_at: string;
  profile?: { full_name: string } | null;
}

interface ModerationTabProps {
  flags: ModerationFlag[];
  loading: boolean;
  onMarkReviewed: (id: string) => void;
}

/**
 * Reviews messages OpenAI's Moderation API flagged before they reached
 * the teaching LLM (see ai-teacher-chat's moderateMessage()). This is
 * real safeguarding surface, not a generic content list — self_harm
 * severity is visually distinct and sorted first, since that's the
 * category that most needs a human's attention, not just a content-policy
 * note.
 */
export function ModerationTab({ flags, loading, onMarkReviewed }: ModerationTabProps) {
  if (loading) {
    return <div className="flex h-72 items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-gold" /></div>;
  }

  const unreviewed = flags.filter((f) => !f.reviewed);
  const selfHarmUnreviewed = unreviewed.filter((f) => f.severity === 'self_harm');

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display text-lg font-semibold text-chalk mb-1">Moderation</h2>
        <p className="text-sm text-muted-board">
          Messages OpenAI's Moderation API flagged before they reached the teaching AI — screened out of the normal
          lesson chat entirely, never sent to RAG or the teaching model.
        </p>
      </div>

      {selfHarmUnreviewed.length > 0 && (
        <div className="border-2 border-rust bg-rust/10 rounded-lg p-4 flex items-start gap-3">
          <TriangleAlert className="h-5 w-5 text-rust shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-rust">
              {selfHarmUnreviewed.length} self-harm-related {selfHarmUnreviewed.length === 1 ? 'flag needs' : 'flags need'} review
            </p>
            <p className="text-xs text-muted-board mt-1">
              These pupils were shown a response pointing them to a trusted adult and Lifeline/Childline Zambia's 116
              Child Helpline. Reviewing here is about your school's own follow-up, not undoing that response.
            </p>
          </div>
        </div>
      )}

      {flags.length === 0 ? (
        <div className="card-board p-8 text-center text-muted-board text-sm">No flagged messages yet.</div>
      ) : (
        <div className="space-y-2">
          {flags.map((flag) => (
            <div
              key={flag.id}
              className={`card-board p-4 ${flag.severity === 'self_harm' ? 'border-rust/50' : ''} ${flag.reviewed ? 'opacity-60' : ''}`}
            >
              <div className="flex items-start justify-between gap-3 mb-2">
                <div className="flex items-center gap-2">
                  {flag.severity === 'self_harm' && (
                    <span className="text-xs font-bold uppercase tracking-wide text-rust border border-rust/40 rounded-full px-2 py-0.5">
                      Self-harm signal
                    </span>
                  )}
                  <span className="text-sm font-semibold text-chalk">{flag.profile?.full_name || 'Unknown pupil'}</span>
                </div>
                <span className="text-xs text-muted-board font-mono-sc shrink-0">
                  {new Date(flag.created_at).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
              <p className="text-sm text-chalk/90 bg-white/5 rounded-lg p-3 mb-2 whitespace-pre-wrap">{flag.message}</p>
              <div className="flex items-center justify-between">
                <div className="flex flex-wrap gap-1.5">
                  {Object.entries(flag.categories)
                    .filter(([, v]) => v)
                    .map(([category]) => (
                      <span key={category} className="text-xs text-muted-board border border-white/10 rounded-full px-2 py-0.5">
                        {category}
                      </span>
                    ))}
                </div>
                {flag.reviewed ? (
                  <span className="flex items-center gap-1 text-xs text-teal">
                    <CheckCircle2 className="h-3.5 w-3.5" /> Reviewed
                  </span>
                ) : (
                  <button
                    onClick={() => onMarkReviewed(flag.id)}
                    className="text-xs border border-white/15 text-muted-board hover:text-chalk rounded-lg px-3 py-1.5 transition-colors"
                  >
                    Mark reviewed
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
