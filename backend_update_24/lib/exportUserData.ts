import { supabase } from './supabase-client';

/**
 * Real data portability, not just the progress export already on
 * /progress — this pulls together everything a pupil's own account
 * actually owns across the platform: profile, mastery, subscription,
 * payment history, and their own interaction/chat history. RLS already
 * scopes every one of these queries to the calling pupil's own rows
 * (each table's SELECT policy checks auth.uid() = student_id/user_id),
 * so this function doesn't need to do its own authorization — it's
 * calling the same tables the app already reads from, as the pupil
 * themselves, nothing more privileged than that.
 *
 * Deliberately excludes moderation_flags and user_warnings — surfacing
 * those back to the pupil who was flagged/warned is a separate, more
 * sensitive product decision (do they see the exact flagged message? the
 * exact warning reason, unfiltered?) than "export my own learning data,"
 * and isn't decided by this function.
 */
export async function exportAllUserData(userId: string): Promise<Record<string, unknown>> {
  const [
    profileRes,
    progressRes,
    masteryRes,
    subscriptionsRes,
    paymentsRes,
    practiceAttemptsRes,
    pastPaperAttemptsRes,
    interactionsRes,
  ] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', userId).maybeSingle(),
    supabase.from('progress_records').select('*').eq('user_id', userId),
    supabase.from('student_topic_mastery').select('*').eq('student_id', userId),
    supabase.from('subscriptions').select('*').eq('user_id', userId),
    supabase.from('payments').select('*').eq('user_id', userId),
    supabase.from('practice_attempts').select('*').eq('user_id', userId),
    supabase.from('past_paper_attempts').select('*').eq('user_id', userId),
    supabase.from('student_interactions').select('*').eq('student_id', userId),
  ]);

  return {
    exported_at: new Date().toISOString(),
    profile: profileRes.data || null,
    progress_records: progressRes.data || [],
    topic_mastery: masteryRes.data || [],
    subscriptions: subscriptionsRes.data || [],
    payments: paymentsRes.data || [],
    practice_attempts: practiceAttemptsRes.data || [],
    past_paper_attempts: pastPaperAttemptsRes.data || [],
    chat_and_practice_interactions: interactionsRes.data || [],
  };
}

export function downloadJson(filename: string, data: unknown) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
