'use client';

import { useState } from 'react';
import { TriangleAlert, CircleCheck as CheckCircle2, Loader as Loader2, UserX, MessageSquareWarning } from 'lucide-react';

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

interface CleanupLogEntry {
  id: string;
  run_at: string;
  days_to_keep: number;
  self_harm_included: boolean;
  rows_deleted: number;
  severity_breakdown: Record<string, number>;
}

interface ModerationTabProps {
  flags: ModerationFlag[];
  loading: boolean;
  onMarkReviewed: (id: string) => void;
  cleanupLog: CleanupLogEntry[];
  onIssueWarning: (userId: string, reason: string, flagId?: string) => void;
  onDeleteAccount: (userId: string, reason: string) => void;
  moderationPage: number;
  setModerationPage: (p: number) => void;
  reviewedTotalCount: number;
  pageSize: number;
}

/**
 * Reviews messages OpenAI's Moderation API flagged before they reached
 * the teaching LLM (see ai-teacher-chat's moderateMessage()). This is
 * real safeguarding surface, not a generic content list — self_harm
 * severity is visually distinct and sorted first, since that's the
 * category that most needs a human's attention, not just a content-policy
 * note.
 */
/**
 * Pre-drafts a warning reason from the flag's OpenAI Moderation
 * categories — a template lookup, not another LLM call. The categories
 * are already clean, structured labels (sexual, hate, harassment,
 * violence, etc.); re-interpreting them with a second AI call would add
 * cost and latency for no real benefit over a direct mapping. The admin
 * still reviews and can edit before sending — this drafts the first
 * pass, it doesn't decide unilaterally.
 *
 * NEVER called for self_harm severity — that path has no "suggest a
 * warning" button at all, checked in the render logic below, not just
 * left out of this function's inputs. A kid in distress should never be
 * treated as a rule-breaker; that's a decision this function can't be
 * allowed to accidentally make by omission.
 */
function suggestWarningReason(categories: Record<string, boolean>): string {
  const flagged = Object.entries(categories).filter(([, v]) => v).map(([k]) => k);

  if (flagged.some((c) => c.startsWith('sexual'))) {
    return 'Your message included sexual content, which isn\'t appropriate for SmartClass Zambia. Please keep your messages appropriate for a learning platform.';
  }
  if (flagged.some((c) => c.startsWith('hate'))) {
    return 'Your message included language that could be hurtful to others based on who they are. Please be respectful in your messages.';
  }
  if (flagged.some((c) => c.startsWith('harassment'))) {
    return 'Your message included language that could be hurtful or harassing to others. Please keep your messages respectful.';
  }
  if (flagged.some((c) => c.startsWith('violence'))) {
    return 'Your message included violent language, which isn\'t appropriate for SmartClass Zambia. Please keep your messages appropriate for a learning platform.';
  }
  return 'Your message didn\'t follow SmartClass Zambia\'s guidelines for respectful, appropriate messages. Please keep future messages focused on your lessons.';
}

export function ModerationTab({
  flags, loading, onMarkReviewed, cleanupLog, onIssueWarning, onDeleteAccount,
  moderationPage, setModerationPage, reviewedTotalCount, pageSize,
}: ModerationTabProps) {
  const [warningTarget, setWarningTarget] = useState<{ userId: string; flagId: string } | null>(null);
  const [warningReason, setWarningReason] = useState('');
  const [directWarnUserId, setDirectWarnUserId] = useState('');
  const [directWarnReason, setDirectWarnReason] = useState('');
  const [deleteUserId, setDeleteUserId] = useState('');
  const [deleteReason, setDeleteReason] = useState('');
  const [deleteConfirmText, setDeleteConfirmText] = useState('');


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

      <div className="card-board p-5">
        <h3 className="font-display text-sm font-semibold text-chalk mb-2">Data Retention</h3>
        <p className="text-xs text-muted-board mb-3">
          <code className="text-gold">cleanup_old_moderation_flags()</code> exists in the database but is
          <strong className="text-chalk"> not scheduled to run automatically</strong> — deleting flagged messages,
          especially anything self-harm-related, is a policy decision for your team to make explicitly (with real
          legal/safeguarding guidance) before any automatic deletion starts. Self-harm-flagged rows are never
          touched by this function unless a future decision explicitly opts into that. See the migration
          <code className="text-gold"> 20260726080000</code> for how to actually enable a schedule once that
          decision is made.
        </p>
        {cleanupLog.length === 0 ? (
          <p className="text-xs text-muted-board italic">No cleanup runs recorded yet — expected, since none are scheduled.</p>
        ) : (
          <div className="space-y-1.5">
            {cleanupLog.map((entry) => (
              <div key={entry.id} className="flex items-center gap-3 text-xs">
                <span className="text-muted-board font-mono-sc w-32 shrink-0">
                  {new Date(entry.run_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                </span>
                <span className="text-chalk">{entry.rows_deleted} rows deleted</span>
                <span className="text-muted-board">(kept {entry.days_to_keep} days, self-harm {entry.self_harm_included ? 'included' : 'excluded'})</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="card-board p-5">
        <div className="flex items-center gap-2 mb-2">
          <MessageSquareWarning className="h-5 w-5 text-gold" />
          <h3 className="font-display text-sm font-semibold text-chalk">Issue a Warning Directly</h3>
        </div>
        <p className="text-xs text-muted-board mb-3">
          The pupil will see this warning (transparency matters — a warning they never see can't change behaviour).
          Not tied to a specific flagged message — use the &quot;Warn pupil&quot; button on a flag above for that.
        </p>
        <div className="flex flex-wrap gap-2">
          <input
            type="text" value={directWarnUserId} onChange={(e) => setDirectWarnUserId(e.target.value)}
            placeholder="Pupil user ID"
            className="flex-1 min-w-[180px] bg-white/5 border border-white/15 rounded-lg px-3 py-2 text-sm text-chalk placeholder:text-muted-board focus:outline-none focus:ring-1 focus:ring-gold"
          />
          <input
            type="text" value={directWarnReason} onChange={(e) => setDirectWarnReason(e.target.value)}
            placeholder="Reason"
            className="flex-1 min-w-[180px] bg-white/5 border border-white/15 rounded-lg px-3 py-2 text-sm text-chalk placeholder:text-muted-board focus:outline-none focus:ring-1 focus:ring-gold"
          />
          <button
            onClick={() => {
              if (directWarnUserId.trim() && directWarnReason.trim()) {
                onIssueWarning(directWarnUserId.trim(), directWarnReason.trim());
                setDirectWarnUserId(''); setDirectWarnReason('');
              }
            }}
            className="btn-gold text-sm px-4 py-2"
          >
            Send Warning
          </button>
        </div>
      </div>

      <div className="card-board p-5 border-2 border-rust/30">
        <div className="flex items-center gap-2 mb-2">
          <UserX className="h-5 w-5 text-rust" />
          <h3 className="font-display text-sm font-semibold text-chalk">Delete Account</h3>
        </div>
        <p className="text-xs text-muted-board mb-3">
          <strong className="text-rust">Permanent and irreversible.</strong> Deletes the pupil's real account, not
          just a flag — all their progress, lessons, and history go with it. Meant for repeat, confirmed rule
          violations, not a first offence. Type <code className="text-gold">DELETE</code> below to enable the button.
        </p>
        <div className="space-y-2">
          <input
            type="text" value={deleteUserId} onChange={(e) => setDeleteUserId(e.target.value)}
            placeholder="Pupil user ID"
            className="w-full bg-white/5 border border-white/15 rounded-lg px-3 py-2 text-sm text-chalk placeholder:text-muted-board focus:outline-none focus:ring-1 focus:ring-rust"
          />
          <input
            type="text" value={deleteReason} onChange={(e) => setDeleteReason(e.target.value)}
            placeholder="Reason (required — kept in the audit log after the account is gone)"
            className="w-full bg-white/5 border border-white/15 rounded-lg px-3 py-2 text-sm text-chalk placeholder:text-muted-board focus:outline-none focus:ring-1 focus:ring-rust"
          />
          <div className="flex gap-2">
            <input
              type="text" value={deleteConfirmText} onChange={(e) => setDeleteConfirmText(e.target.value)}
              placeholder='Type "DELETE" to confirm'
              className="flex-1 bg-white/5 border border-rust/40 rounded-lg px-3 py-2 text-sm text-chalk placeholder:text-muted-board focus:outline-none focus:ring-1 focus:ring-rust"
            />
            <button
              onClick={() => {
                if (deleteConfirmText === 'DELETE' && deleteUserId && deleteReason.trim()) {
                  onDeleteAccount(deleteUserId, deleteReason.trim());
                  setDeleteUserId(''); setDeleteReason(''); setDeleteConfirmText('');
                }
              }}
              disabled={deleteConfirmText !== 'DELETE' || !deleteUserId || !deleteReason.trim()}
              className="bg-rust text-chalk text-sm font-semibold px-4 py-2 rounded-lg disabled:opacity-30 disabled:cursor-not-allowed shrink-0"
            >
              Delete Account
            </button>
          </div>
        </div>
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
                  <div className="flex items-center gap-2">
                    {flag.user_id && flag.severity !== 'self_harm' && (
                      <button
                        onClick={() => {
                          setWarningTarget({ userId: flag.user_id!, flagId: flag.id });
                          setWarningReason(suggestWarningReason(flag.categories));
                        }}
                        className="text-xs border border-gold/40 text-gold hover:bg-gold/10 rounded-lg px-3 py-1.5 transition-colors"
                      >
                        Warn pupil
                      </button>
                    )}
                    <button
                      onClick={() => onMarkReviewed(flag.id)}
                      className="text-xs border border-white/15 text-muted-board hover:text-chalk rounded-lg px-3 py-1.5 transition-colors"
                    >
                      Mark reviewed
                    </button>
                  </div>
                )}
              </div>
              {warningTarget?.flagId === flag.id && (
                <div className="mt-3 pt-3 border-t border-white/10">
                  <p className="text-xs text-muted-board mb-1.5">Suggested from this flag's category — review, edit if needed, then send.</p>
                  <div className="flex gap-2">
                    <input
                      type="text" value={warningReason} onChange={(e) => setWarningReason(e.target.value)}
                      placeholder="Reason for this warning (the pupil will see this)"
                      className="flex-1 bg-white/5 border border-white/15 rounded-lg px-3 py-1.5 text-xs text-chalk placeholder:text-muted-board focus:outline-none focus:ring-1 focus:ring-gold"
                    />
                    <button
                      onClick={() => {
                        if (!warningReason.trim()) return;
                        onIssueWarning(warningTarget.userId, warningReason.trim(), warningTarget.flagId);
                        setWarningTarget(null);
                      }}
                      className="btn-gold text-xs px-3 py-1.5 shrink-0"
                    >
                      Send warning
                    </button>
                    <button onClick={() => setWarningTarget(null)} className="text-xs text-muted-board px-2 shrink-0">Cancel</button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {reviewedTotalCount > 0 && (
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-board">
            {reviewedTotalCount} reviewed flag{reviewedTotalCount === 1 ? '' : 's'} in history — unreviewed flags above are always shown in full, never paginated
          </span>
          <div className="flex gap-2">
            <button
              onClick={() => setModerationPage(Math.max(0, moderationPage - 1))}
              disabled={moderationPage === 0}
              className="border border-white/15 text-chalk text-xs px-3 py-1.5 rounded-lg hover:bg-white/5 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              Previous
            </button>
            <button
              onClick={() => setModerationPage(moderationPage + 1)}
              disabled={(moderationPage + 1) * pageSize >= reviewedTotalCount}
              className="border border-white/15 text-chalk text-xs px-3 py-1.5 rounded-lg hover:bg-white/5 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
