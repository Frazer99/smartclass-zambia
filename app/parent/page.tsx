'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/auth-provider';
import { supabase } from '@/lib/supabase-client';
import { Loader as Loader2, Users, TrendingUp, ChevronDown, ChevronUp, CalendarDays, ClipboardCheck, CreditCard, ExternalLink } from 'lucide-react';
import { Wordmark } from '@/components/brand/Logo';

interface Child {
  child_id: string;
  full_name: string;
  grade: number;
  school: string | null;
}

interface ChildProgressRow {
  topic_id: string;
  topic_name: string;
  subject_name: string;
  mastery_percentage: number;
  lessons_completed: number;
  total_attempts: number;
  correct_attempts: number;
}

interface ChildActivity {
  lesson_sessions: number;
  completed_lessons: number;
  active_days: number;
  last_attended: string | null;
  practice_attempts: number;
  practice_correct: number;
}

interface ChildResult {
  result_id: string;
  result_type: 'practice' | 'past_paper';
  title: string;
  subject_name: string;
  topic_name: string | null;
  submitted_answer: string;
  is_correct: boolean;
  occurred_at: string;
}

interface BillingRecord {
  record_type: 'subscription' | 'payment';
  status: string;
  amount: number | null;
  currency: string;
  plan_type: string | null;
  payment_method: string | null;
  provider: string | null;
  reference: string | null;
  started_at: string;
  expires_at: string | null;
  completed_at: string | null;
}

export default function ParentDashboard() {
  const { user, profile, loading, signOut } = useAuth();
  const router = useRouter();
  const [children, setChildren] = useState<Child[]>([]);
  const [childrenLoading, setChildrenLoading] = useState(true);
  const [expandedChild, setExpandedChild] = useState<string | null>(null);
  const [progressByChild, setProgressByChild] = useState<Record<string, ChildProgressRow[]>>({});
  const [progressLoading, setProgressLoading] = useState<string | null>(null);
  const [activityByChild, setActivityByChild] = useState<Record<string, ChildActivity>>({});
  const [resultsByChild, setResultsByChild] = useState<Record<string, ChildResult[]>>({});
  const [billingByChild, setBillingByChild] = useState<Record<string, BillingRecord[]>>({});

  useEffect(() => {
    if (!loading && !user) router.replace('/login');
    if (!loading && profile && profile.role !== 'parent') router.replace('/dashboard');
  }, [user, profile, loading, router]);

  useEffect(() => {
    if (!user || profile?.role !== 'parent') return;
    (async () => {
      const { data } = await supabase.rpc('get_my_children');
      setChildren(data || []);
      setChildrenLoading(false);
    })();
  }, [user, profile]);

  const toggleChild = async (childId: string) => {
    if (expandedChild === childId) {
      setExpandedChild(null);
      return;
    }
    setExpandedChild(childId);
    if (!progressByChild[childId]) {
      setProgressLoading(childId);
      const [progress, activity, results, billing] = await Promise.all([
        supabase.rpc('get_child_progress', { p_child_id: childId }),
        supabase.rpc('get_parent_child_activity', { p_child_id: childId }),
        supabase.rpc('get_parent_child_results', { p_child_id: childId }),
        supabase.rpc('get_parent_child_billing', { p_child_id: childId }),
      ]);
      if (!progress.error) setProgressByChild((previous) => ({ ...previous, [childId]: progress.data || [] }));
      if (!activity.error) setActivityByChild((previous) => ({ ...previous, [childId]: activity.data?.[0] || { lesson_sessions: 0, completed_lessons: 0, active_days: 0, last_attended: null, practice_attempts: 0, practice_correct: 0 } }));
      if (!results.error) setResultsByChild((previous) => ({ ...previous, [childId]: results.data || [] }));
      if (!billing.error) setBillingByChild((previous) => ({ ...previous, [childId]: billing.data || [] }));
      setProgressLoading(null);
    }
  };

  if (loading || !user || !profile || profile.role !== 'parent') {
    return <div className="min-h-screen bg-board flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-gold" /></div>;
  }

  return (
    <div className="min-h-screen bg-board text-chalk">
      <div className="chalk-noise" />
      <header className="relative z-20 border-b border-white/10 bg-board-deep/60 backdrop-blur">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between">
          <Wordmark size="md" />
          <div className="flex items-center gap-3">
            <span className="text-sm text-muted-board">{profile.full_name}</span>
            <button onClick={signOut} className="text-sm border border-white/15 text-muted-board hover:text-chalk rounded-lg px-3 py-1.5 transition-colors">Sign out</button>
          </div>
        </div>
      </header>
      <main className="max-w-3xl mx-auto px-4 py-8 space-y-6">
        <div>
          <h1 className="font-display text-2xl font-semibold text-chalk mb-1">Your Children</h1>
          <p className="text-sm text-muted-board">Real progress, updated as they learn.</p>
        </div>
        {childrenLoading ? (
          <div className="flex h-48 items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-gold" /></div>
        ) : children.length === 0 ? (
          <div className="card-board p-6 text-center">
            <Users className="h-8 w-8 text-muted-board mx-auto mb-3" />
            <p className="text-sm text-chalk font-semibold mb-1">No children linked yet</p>
            <p className="text-sm text-muted-board">Ask your child to add your email address as their parent or guardian email in Account settings.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {children.map((child) => (
              <div key={child.child_id} className="card-board overflow-hidden">
                <button onClick={() => toggleChild(child.child_id)} className="w-full p-4 flex items-center justify-between text-left">
                  <div>
                    <p className="font-display text-base font-semibold text-chalk">{child.full_name}</p>
                    <p className="text-xs text-muted-board">Form {child.grade} · {child.school || 'No school set'}</p>
                  </div>
                  {expandedChild === child.child_id ? <ChevronUp className="h-4 w-4 text-muted-board" /> : <ChevronDown className="h-4 w-4 text-muted-board" />}
                </button>
                {expandedChild === child.child_id && (
                  <div className="border-t border-white/10 p-4">
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-5">
                      <div className="rounded-lg border border-white/10 p-3"><p className="text-xs text-muted-board">Lessons attended</p><p className="font-mono-sc text-lg text-chalk">{activityByChild[child.child_id]?.lesson_sessions ?? '—'}</p></div>
                      <div className="rounded-lg border border-white/10 p-3"><p className="text-xs text-muted-board">Active days</p><p className="font-mono-sc text-lg text-chalk">{activityByChild[child.child_id]?.active_days ?? '—'}</p></div>
                      <div className="rounded-lg border border-white/10 p-3"><p className="text-xs text-muted-board">Tasks correct</p><p className="font-mono-sc text-lg text-teal">{activityByChild[child.child_id]?.practice_correct ?? '—'}</p></div>
                      <div className="rounded-lg border border-white/10 p-3"><p className="text-xs text-muted-board">Tasks attempted</p><p className="font-mono-sc text-lg text-chalk">{activityByChild[child.child_id]?.practice_attempts ?? '—'}</p></div>
                    </div>
                    <div className="space-y-2 mb-5">
                      <h3 className="flex items-center gap-2 font-display text-sm font-semibold text-chalk"><CalendarDays className="h-4 w-4 text-gold" /> Attendance</h3>
                      <p className="text-sm text-muted-board">{activityByChild[child.child_id]?.last_attended ? `Last attended ${new Date(activityByChild[child.child_id].last_attended!).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}.` : 'No lesson attendance recorded yet.'} {activityByChild[child.child_id]?.completed_lessons ?? 0} lessons completed.</p>
                    </div>
                    {progressLoading === child.child_id ? <div className="flex h-24 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-gold" /></div> : (progressByChild[child.child_id]?.length ?? 0) === 0 ? <p className="text-sm text-muted-board">No progress recorded yet.</p> : <div className="space-y-2">
                      <h3 className="flex items-center gap-2 font-display text-sm font-semibold text-chalk mb-2"><TrendingUp className="h-4 w-4 text-gold" /> Topic progress</h3>
                      {progressByChild[child.child_id].map((row) => <div key={row.topic_id} className="flex items-center gap-3 text-sm"><TrendingUp className="h-3.5 w-3.5 text-muted-board" /><span className="text-chalk flex-1">{row.topic_name}</span><span className="text-xs text-muted-board">{row.subject_name}</span><span className={`font-mono-sc font-semibold w-12 text-right ${row.mastery_percentage < 40 ? 'text-rust' : row.mastery_percentage < 70 ? 'text-gold' : 'text-teal'}`}>{row.mastery_percentage}%</span></div>)}
                    </div>}
                    <div className="mt-6 space-y-2"><h3 className="flex items-center gap-2 font-display text-sm font-semibold text-chalk"><ClipboardCheck className="h-4 w-4 text-gold" /> Task and test results</h3>{(resultsByChild[child.child_id]?.length ?? 0) === 0 ? <p className="text-sm text-muted-board">No task or test results recorded yet.</p> : <div className="space-y-1.5 max-h-72 overflow-y-auto">{resultsByChild[child.child_id].map((result) => <div key={result.result_id} className="flex items-center gap-2 text-sm border-b border-white/5 pb-1.5"><span className={result.is_correct ? 'text-teal' : 'text-rust'}>{result.is_correct ? 'Correct' : 'Incorrect'}</span><span className="text-chalk flex-1">{result.title}{result.topic_name ? ` · ${result.topic_name}` : ''}</span><span className="text-xs text-muted-board">{new Date(result.occurred_at).toLocaleDateString('en-GB')}</span></div>)}</div>}</div>
                    <div className="mt-6 space-y-2"><div className="flex items-center justify-between"><h3 className="flex items-center gap-2 font-display text-sm font-semibold text-chalk"><CreditCard className="h-4 w-4 text-gold" /> Payments and subscription</h3><a href={`/subscribe?child=${child.child_id}`} className="inline-flex items-center gap-1.5 text-xs text-gold hover:text-chalk"><ExternalLink className="h-3.5 w-3.5" /> Pay for child</a></div>{(billingByChild[child.child_id]?.length ?? 0) === 0 ? <p className="text-sm text-muted-board">No payment records yet.</p> : <div className="space-y-1.5">{billingByChild[child.child_id].map((record, index) => <div key={`${record.record_type}-${record.started_at}-${index}`} className="flex items-center gap-2 text-sm border-b border-white/5 pb-1.5"><span className="text-chalk capitalize">{record.record_type}</span><span className="text-muted-board">{record.status}</span><span className="text-chalk ml-auto">{record.amount == null ? '—' : `${record.currency} ${record.amount}`}</span><span className="text-xs text-muted-board">{new Date(record.started_at).toLocaleDateString('en-GB')}</span></div>)}</div>}</div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
