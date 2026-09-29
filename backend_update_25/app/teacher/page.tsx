'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/auth-provider';
import { supabase } from '@/lib/supabase-client';
import { Loader as Loader2, GraduationCap, MessageSquareWarning, Clock } from 'lucide-react';
import { Wordmark } from '@/components/brand/Logo';

const FORMS = [1, 2, 3, 4, 5, 6];

interface TopicAnalyticsRow {
  subject_name: string;
  topic_id: string;
  topic_name: string;
  pupil_count: number;
  avg_mastery: number | null;
  min_mastery: number | null;
  max_mastery: number | null;
}

interface MisconceptionRow {
  topic_name: string;
  detected_mistake: string;
  occurrence_count: number;
}

/**
 * Same underlying data and RPCs as the admin School Analytics tab
 * (get_school_topic_analytics, get_common_misconceptions — migration
 * 20260725080000, extended for teacher access in 20260803080000), but
 * standalone rather than reusing SchoolAnalyticsTab directly: an admin
 * picks which school to view from a dropdown across every school; a
 * teacher has exactly one, their own, with no dropdown needed at all.
 * Forcing one component to handle both shapes would have meant a
 * confusing half-admin, half-teacher prop surface for no real benefit.
 *
 * The school passed to both RPCs is always profile.school — the
 * functions themselves also re-check this server-side (a teacher
 * passing a different school string gets rejected), so this isn't
 * relying on the frontend alone to enforce the boundary.
 */
export default function TeacherDashboard() {
  const { user, profile, loading, signOut } = useAuth();
  const router = useRouter();
  const [gradeFilter, setGradeFilter] = useState<number | null>(null);
  const [topicAnalytics, setTopicAnalytics] = useState<TopicAnalyticsRow[]>([]);
  const [misconceptions, setMisconceptions] = useState<MisconceptionRow[]>([]);
  const [dataLoading, setDataLoading] = useState(true);
  const [approvalChecked, setApprovalChecked] = useState(false);
  const [isApproved, setIsApproved] = useState(false);

  useEffect(() => {
    if (!loading && !user) router.push('/login');
  }, [user, loading, router]);

  useEffect(() => {
    if (!profile) return;
    setIsApproved(!!profile.teacher_approved);
    setApprovalChecked(true);
  }, [profile]);

  useEffect(() => {
    if (!profile?.school || !isApproved) { setDataLoading(false); return; }
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
  }, [profile, isApproved, gradeFilter]);

  if (loading || !user || !approvalChecked) {
    return <div className="min-h-screen bg-board flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-gold" /></div>;
  }

  return (
    <div className="min-h-screen bg-board text-chalk">
      <div className="chalk-noise" />
      <header className="relative z-20 border-b border-white/10 bg-board-deep/60 backdrop-blur">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
          <Wordmark size="md" />
          <div className="flex items-center gap-3">
            <span className="text-sm text-muted-board">{profile?.full_name}</span>
            <button onClick={signOut} className="text-sm border border-white/15 text-muted-board hover:text-chalk rounded-lg px-3 py-1.5 transition-colors">
              Sign out
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
        {!isApproved ? (
          <div className="card-board p-6 text-center">
            <Clock className="h-8 w-8 text-gold mx-auto mb-3" />
            <p className="text-sm text-chalk font-semibold mb-1">Pending admin approval</p>
            <p className="text-sm text-muted-board">
              Your teacher account for {profile?.school || 'your school'} hasn&apos;t been approved yet. Check
              back once an admin has reviewed it.
            </p>
          </div>
        ) : (
          <>
            <div>
              <h1 className="font-display text-2xl font-semibold text-chalk mb-1">{profile?.school}</h1>
              <p className="text-sm text-muted-board">Aggregated mastery and common misconceptions across your school&apos;s pupils.</p>
            </div>

            <div className="flex gap-1.5">
              <button
                onClick={() => setGradeFilter(null)}
                className={`text-xs px-3 py-2 rounded-lg border transition-colors ${gradeFilter === null ? 'border-gold text-gold bg-gold/10' : 'border-white/10 text-muted-board hover:text-chalk'}`}
              >
                All Forms
              </button>
              {FORMS.map((g) => (
                <button
                  key={g}
                  onClick={() => setGradeFilter(g)}
                  className={`text-xs px-3 py-2 rounded-lg border transition-colors ${gradeFilter === g ? 'border-gold text-gold bg-gold/10' : 'border-white/10 text-muted-board hover:text-chalk'}`}
                >
                  Form {g}
                </button>
              ))}
            </div>

            {dataLoading ? (
              <div className="flex h-48 items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-gold" /></div>
            ) : (
              <>
                <div className="card-board p-5">
                  <div className="flex items-center gap-2 mb-4">
                    <GraduationCap className="h-5 w-5 text-gold" />
                    <h3 className="font-display text-base font-semibold text-chalk">Topic Mastery</h3>
                    <span className="text-xs text-muted-board ml-auto">Sorted lowest mastery first</span>
                  </div>
                  {topicAnalytics.length === 0 ? (
                    <p className="text-sm text-muted-board">No mastery data yet for this filter.</p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="text-left text-xs uppercase tracking-wide text-muted-board border-b border-white/10">
                            <th className="py-2 pr-3">Subject</th>
                            <th className="py-2 pr-3">Topic</th>
                            <th className="py-2 pr-3 text-right">Pupils</th>
                            <th className="py-2 pl-3 text-right">Avg Mastery</th>
                          </tr>
                        </thead>
                        <tbody>
                          {topicAnalytics.map((row) => (
                            <tr key={row.topic_id} className="border-b border-white/5">
                              <td className="py-2.5 pr-3 text-muted-board">{row.subject_name}</td>
                              <td className="py-2.5 pr-3 text-chalk font-medium">{row.topic_name}</td>
                              <td className="py-2.5 pr-3 text-right font-mono-sc text-muted-board">{row.pupil_count}</td>
                              <td className="py-2.5 pl-3 text-right font-mono-sc">
                                <span className={(row.avg_mastery ?? 0) < 40 ? 'text-rust font-semibold' : (row.avg_mastery ?? 0) < 70 ? 'text-gold font-semibold' : 'text-teal font-semibold'}>
                                  {row.avg_mastery ?? '—'}%
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                <div className="card-board p-5">
                  <div className="flex items-center gap-2 mb-1">
                    <MessageSquareWarning className="h-5 w-5 text-gold" />
                    <h3 className="font-display text-base font-semibold text-chalk">Common Misconceptions</h3>
                  </div>
                  <p className="text-xs text-muted-board mb-4">Grouped by exact wording — similar mistakes described differently won&apos;t merge into one count.</p>
                  {misconceptions.length === 0 ? (
                    <p className="text-sm text-muted-board">No misconceptions detected yet for this filter.</p>
                  ) : (
                    <div className="space-y-2">
                      {misconceptions.map((m, i) => (
                        <div key={i} className="flex items-center gap-3 text-sm">
                          <span className="text-xs text-gold font-mono-sc w-20 shrink-0">{m.topic_name}</span>
                          <span className="text-chalk flex-1">{m.detected_mistake}</span>
                          <span className="text-xs text-muted-board font-mono-sc shrink-0">×{m.occurrence_count}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
