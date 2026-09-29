'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase, Topic, ProgressRecord, Lesson, Subject } from '@/lib/supabase-client';
import { useAuth } from '@/components/auth-provider';
import { ArrowLeft, Printer, Loader as Loader2 } from 'lucide-react';
import { LogoMark } from '@/components/brand/Logo';

/**
 * The "PDF" in "data export as CSV/PDF": rather than add an untested PDF
 * library (jsPDF and similar have real font-embedding complexity, and
 * this build environment has no way to verify one actually renders
 * correctly), this is a print-optimized page. The browser's own "Save as
 * PDF" print destination — available with zero added dependencies in
 * every modern browser — produces the actual PDF. Light/paper-toned
 * throughout rather than the app's usual dark chalkboard theme, since a
 * printed page shouldn't try to lay down a full dark background: it
 * wastes ink and most printers/PDF viewers don't render it well anyway.
 */
export default function ProgressReportPage() {
  const { profile } = useAuth();
  const router = useRouter();
  const [topics, setTopics] = useState<Topic[]>([]);
  const [progress, setProgress] = useState<ProgressRecord[]>([]);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!profile) return;
    (async () => {
      const topicIds = (await supabase.from('topics').select('id').eq('grade', profile.grade)).data?.map((t: { id: string }) => t.id) || [];
      const [topicsRes, progressRes, lessonsRes, subjectsRes] = await Promise.all([
        supabase.from('topics').select('*').eq('grade', profile.grade).order('display_order'),
        supabase.from('progress_records').select('*').eq('user_id', profile.id),
        supabase.from('lessons').select('*').in('topic_id', topicIds),
        supabase.from('subjects').select('*').order('display_order'),
      ]);
      setTopics((topicsRes.data as Topic[]) || []);
      setProgress((progressRes.data as ProgressRecord[]) || []);
      setLessons((lessonsRes.data as Lesson[]) || []);
      setSubjects(((subjectsRes.data as Subject[]) || []).filter((s) => s.grades.includes(profile.grade)));
      setLoading(false);
    })();
  }, [profile]);

  if (loading || !profile) {
    return <div className="flex h-72 items-center justify-center bg-paper"><Loader2 className="h-8 w-8 animate-spin text-ink/40" /></div>;
  }

  const overallMastery = progress.length > 0
    ? Math.round(progress.reduce((s, p) => s + Number(p.mastery_percentage), 0) / progress.length)
    : 0;
  const totalAttempts = progress.reduce((s, p) => s + p.total_attempts, 0);
  const totalCorrect = progress.reduce((s, p) => s + p.correct_attempts, 0);
  const completedLessons = progress.reduce((s, p) => s + p.lessons_completed, 0);
  const accuracy = totalAttempts > 0 ? Math.round((totalCorrect / totalAttempts) * 100) : 0;
  const generatedDate = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });

  return (
    <div className="min-h-screen bg-paper text-ink">
      {/* Screen-only controls — hidden entirely when printing */}
      <div className="print:hidden sticky top-0 bg-paper border-b border-ink/10 px-6 py-3 flex items-center justify-between">
        <button onClick={() => router.push('/progress')} className="flex items-center gap-1.5 text-sm text-ink/60 hover:text-ink transition-colors">
          <ArrowLeft className="h-4 w-4" /> Back to Progress
        </button>
        <button onClick={() => window.print()} className="flex items-center gap-1.5 text-sm font-semibold bg-gold text-ink rounded-lg px-4 py-2">
          <Printer className="h-4 w-4" /> Print / Save as PDF
        </button>
      </div>

      <div className="max-w-3xl mx-auto px-8 py-10 print:py-0">
        <div className="flex items-center gap-2 mb-1">
          <LogoMark size={28} />
          <span className="font-display text-lg font-semibold">
            <span className="text-gold-deep">SmartClass</span> Zambia
          </span>
        </div>
        <p className="text-xs text-ink/50 mb-8">Powered by ZedCode Technologies &middot; Progress Report generated {generatedDate}</p>

        <h1 className="font-display text-2xl font-bold mb-1">{profile.full_name}</h1>
        <p className="text-sm text-ink/60 mb-8">
          Form {profile.grade}{profile.school ? ` · ${profile.school}` : ''}
        </p>

        {/* Summary */}
        <div className="grid grid-cols-4 gap-4 mb-10 pb-8 border-b border-ink/10">
          <SummaryStat value={`${overallMastery}%`} label="Overall Mastery" />
          <SummaryStat value={`${completedLessons}/${lessons.length}`} label="Lessons Completed" />
          <SummaryStat value={String(totalAttempts)} label="Questions Answered" />
          <SummaryStat value={totalAttempts > 0 ? `${accuracy}%` : '—'} label="Accuracy" />
        </div>

        {/* Per-subject tables */}
        {subjects.map((subject) => {
          const subjectTopics = topics.filter((t) => t.subject_id === subject.id);
          if (subjectTopics.length === 0) return null;
          return (
            <div key={subject.id} className="mb-8 break-inside-avoid">
              <h2 className="font-display text-base font-bold mb-3" style={{ color: subject.color }}>
                {subject.name}
              </h2>
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="border-b-2 border-ink/20 text-left text-xs uppercase tracking-wide text-ink/50">
                    <th className="py-2 pr-2">Topic</th>
                    <th className="py-2 px-2 text-right">Mastery</th>
                    <th className="py-2 px-2 text-right">Lessons</th>
                    <th className="py-2 pl-2 text-right">Accuracy</th>
                  </tr>
                </thead>
                <tbody>
                  {subjectTopics.map((topic) => {
                    const tp = progress.find((p) => p.topic_id === topic.id);
                    const mastery = tp ? Number(tp.mastery_percentage) : 0;
                    const tl = lessons.filter((l) => l.topic_id === topic.id);
                    const att = tp?.total_attempts || 0;
                    const cor = tp?.correct_attempts || 0;
                    return (
                      <tr key={topic.id} className="border-b border-ink/10">
                        <td className="py-2 pr-2">{topic.name}</td>
                        <td className="py-2 px-2 text-right font-mono-sc">{mastery}%</td>
                        <td className="py-2 px-2 text-right font-mono-sc">{tp?.lessons_completed || 0}/{tl.length}</td>
                        <td className="py-2 pl-2 text-right font-mono-sc">{att > 0 ? `${Math.round((cor / att) * 100)}%` : '—'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          );
        })}

        <p className="text-xs text-ink/40 mt-10 pt-4 border-t border-ink/10">
          This report reflects mastery and activity recorded on SmartClass Zambia as of {generatedDate}.
        </p>
      </div>
    </div>
  );
}

function SummaryStat({ value, label }: { value: string; label: string }) {
  return (
    <div>
      <div className="font-mono-sc text-xl font-bold">{value}</div>
      <div className="text-xs text-ink/50 mt-0.5">{label}</div>
    </div>
  );
}
