'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/auth-provider';
import { supabase } from '@/lib/supabase-client';
import { Loader as Loader2, GraduationCap, MessageSquareWarning, Clock } from 'lucide-react';
import { Wordmark } from '@/components/brand/Logo';

const FORMS = [1, 2, 3, 4, 5, 6];
interface TopicAnalyticsRow { subject_name: string; topic_id: string; topic_name: string; pupil_count: number; avg_mastery: number | null; }
interface MisconceptionRow { topic_name: string; detected_mistake: string; occurrence_count: number; }

export default function TeacherDashboard() {
  const { user, profile, loading, signOut } = useAuth();
  const router = useRouter();
  const [gradeFilter, setGradeFilter] = useState<number | null>(null);
  const [topicAnalytics, setTopicAnalytics] = useState<TopicAnalyticsRow[]>([]);
  const [misconceptions, setMisconceptions] = useState<MisconceptionRow[]>([]);
  const [dataLoading, setDataLoading] = useState(true);
  const [approvalChecked, setApprovalChecked] = useState(false);

  useEffect(() => {
    if (!loading && !user) router.replace('/login');
    if (!loading && profile && profile.role !== 'teacher') router.replace('/dashboard');
  }, [user, profile, loading, router]);

  useEffect(() => {
    if (!profile) return;
    setApprovalChecked(true);
    if (!profile.school || !profile.teacher_approved) {
      setDataLoading(false);
      return;
    }
    (async () => {
      setDataLoading(true);
      const [topicRes, mistakesRes] = await Promise.all([
        supabase.rpc('get_school_topic_analytics', { p_school: profile.school, p_grade: gradeFilter }),
        supabase.rpc('get_common_misconceptions', { p_school: profile.school, p_grade: gradeFilter, p_topic_id: null }),
      ]);
      setTopicAnalytics(topicRes.data || []);
      setMisconceptions(mistakesRes.data || []);
      setDataLoading(false);
    })();
  }, [profile, gradeFilter]);

  if (loading || !user || !profile || profile.role !== 'teacher' || !approvalChecked) {
    return <div className="min-h-screen bg-board flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-gold" /></div>;
  }

  const approved = !!profile.teacher_approved;
  return (
    <div className="min-h-screen bg-board text-chalk">
      <div className="chalk-noise" />
      <header className="relative z-20 border-b border-white/10 bg-board-deep/60 backdrop-blur">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between"><Wordmark size="md" /><div className="flex items-center gap-3"><span className="text-sm text-muted-board">{profile.full_name}</span><button onClick={signOut} className="text-sm border border-white/15 text-muted-board hover:text-chalk rounded-lg px-3 py-1.5 transition-colors">Sign out</button></div></div>
      </header>
      <main className="max-w-4xl mx-auto px-4 py-8 space-y-6">
        {!approved ? <div className="card-board p-6 text-center"><Clock className="h-8 w-8 text-gold mx-auto mb-3" /><p className="text-sm text-chalk font-semibold mb-1">Pending admin approval</p><p className="text-sm text-muted-board">Your teacher account for {profile.school || 'your school'} has not been approved yet.</p></div> : <>
          <div><h1 className="font-display text-2xl font-semibold text-chalk mb-1">{profile.school}</h1><p className="text-sm text-muted-board">Aggregated mastery and common misconceptions across your school&apos;s pupils.</p></div>
          <div className="flex flex-wrap gap-1.5"><button onClick={() => setGradeFilter(null)} className={`text-xs px-3 py-2 rounded-lg border ${gradeFilter === null ? 'border-gold text-gold bg-gold/10' : 'border-white/10 text-muted-board'}`}>All Forms</button>{FORMS.map((form) => <button key={form} onClick={() => setGradeFilter(form)} className={`text-xs px-3 py-2 rounded-lg border ${gradeFilter === form ? 'border-gold text-gold bg-gold/10' : 'border-white/10 text-muted-board'}`}>Form {form}</button>)}</div>
          {dataLoading ? <div className="flex h-48 items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-gold" /></div> : <>
            <section className="card-board p-5"><div className="flex items-center gap-2 mb-4"><GraduationCap className="h-5 w-5 text-gold" /><h2 className="font-display text-base font-semibold text-chalk">Topic Mastery</h2></div>{topicAnalytics.length === 0 ? <p className="text-sm text-muted-board">No mastery data yet for this filter.</p> : <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="text-left text-xs uppercase tracking-wide text-muted-board border-b border-white/10"><th className="py-2 pr-3">Subject</th><th className="py-2 pr-3">Topic</th><th className="py-2 pr-3 text-right">Pupils</th><th className="py-2 pl-3 text-right">Avg Mastery</th></tr></thead><tbody>{topicAnalytics.map((row) => <tr key={row.topic_id} className="border-b border-white/5"><td className="py-2.5 pr-3 text-muted-board">{row.subject_name}</td><td className="py-2.5 pr-3 text-chalk font-medium">{row.topic_name}</td><td className="py-2.5 pr-3 text-right text-muted-board">{row.pupil_count}</td><td className="py-2.5 pl-3 text-right text-gold font-semibold">{row.avg_mastery ?? '—'}%</td></tr>)}</tbody></table></div>}</section>
            <section className="card-board p-5"><div className="flex items-center gap-2 mb-1"><MessageSquareWarning className="h-5 w-5 text-gold" /><h2 className="font-display text-base font-semibold text-chalk">Common Misconceptions</h2></div>{misconceptions.length === 0 ? <p className="text-sm text-muted-board">No misconceptions detected yet for this filter.</p> : <div className="space-y-2">{misconceptions.map((mistake, index) => <div key={index} className="flex items-center gap-3 text-sm"><span className="text-xs text-gold w-20 shrink-0">{mistake.topic_name}</span><span className="text-chalk flex-1">{mistake.detected_mistake}</span><span className="text-xs text-muted-board">×{mistake.occurrence_count}</span></div>)}</div>}</section>
          </>}
        </>}
      </main>
    </div>
  );
}
