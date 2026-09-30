'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase, Topic, ProgressRecord, Lesson, Subject } from '@/lib/supabase-client';
import { useAuth } from '@/components/auth-provider';
import { ArrowRight, Award, Target, Loader as Loader2, Calculator, FlaskConical, Atom, TestTube, GraduationCap, Download, Printer } from 'lucide-react';
import { buildCsv, downloadCsv } from '@/lib/exportCsv';

const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  Calculator, FlaskConical, Atom, TestTube,
};

export default function ProgressPage() {
  const { profile } = useAuth();
  const router = useRouter();
  const [topics, setTopics] = useState<Topic[]>([]);
  const [progress, setProgress] = useState<ProgressRecord[]>([]);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [activeSubjectId, setActiveSubjectId] = useState<string>('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!profile) return;
    fetchData();
  }, [profile]);

  const fetchData = async () => {
    if (!profile) return;
    const topicIds = (await supabase.from('topics').select('id').eq('grade', profile.grade).not('source_material_id', 'is', null)).data?.map((t: { id: string }) => t.id) || [];
    const [topicsRes, progressRes, lessonsRes, subjectsRes] = await Promise.all([
      supabase.from('topics').select('*, subject:subjects(*)').eq('grade', profile.grade).not('source_material_id', 'is', null).order('display_order'),
      supabase.from('progress_records').select('*').eq('user_id', profile.id),
      supabase.from('lessons').select('*').in('topic_id', topicIds),
      supabase.from('subjects').select('*').order('display_order'),
    ]);
    const tops = topicsRes.data as Topic[] || [];
    const subs = (subjectsRes.data as Subject[] || [])
      .filter((s) => s.grades.includes(profile.grade))
      .filter((s) => tops.some((topic) => topic.subject_id === s.id));
    setTopics(tops);
    setProgress(progressRes.data as ProgressRecord[] || []);
    setLessons(lessonsRes.data as Lesson[] || []);
    setSubjects(subs);
    if (subs.length > 0) setActiveSubjectId(subs[0].id);
    setLoading(false);
  };

  const handleExportCsv = () => {
    if (!profile) return;
    const rows = topics.map((topic) => {
      const item = progress.find((entry) => entry.topic_id === topic.id);
      const subject = subjects.find((entry) => entry.id === topic.subject_id);
      return [subject?.name || '', topic.name, item ? Number(item.mastery_percentage) : 0,
        item?.lessons_completed || 0, item?.total_attempts || 0, item?.correct_attempts || 0,
        item?.total_attempts ? Math.round(((item.correct_attempts || 0) / item.total_attempts) * 100) : ''];
    });
    const csv = buildCsv(['Subject', 'Topic', 'Mastery %', 'Lessons Completed', 'Questions Answered', 'Correct Answers', 'Accuracy %'], rows);
    downloadCsv(`smartclass-progress-${profile.full_name.replace(/\s+/g, '-').toLowerCase()}-${new Date().toISOString().slice(0, 10)}.csv`, csv);
  };

  if (loading) return <div className="flex h-72 items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-gold" /></div>;

  const overallMastery = progress.length > 0
    ? Math.round(progress.reduce((s, p) => s + Number(p.mastery_percentage), 0) / progress.length)
    : 0;
  const totalAttempts = progress.reduce((s, p) => s + p.total_attempts, 0);
  const totalCorrect = progress.reduce((s, p) => s + p.correct_attempts, 0);
  const completedLessons = progress.reduce((s, p) => s + p.lessons_completed, 0);
  const accuracy = totalAttempts > 0 ? Math.round((totalCorrect / totalAttempts) * 100) : 0;

  const sorted = [...progress].sort((a, b) => Number(b.mastery_percentage) - Number(a.mastery_percentage));
  const strongest = sorted[0];
  const weakest = sorted[sorted.length - 1];

  const subjectTopics = topics.filter((t) => t.subject_id === activeSubjectId);
  const activeSubject = subjects.find((s) => s.id === activeSubjectId);

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="font-display text-2xl font-semibold text-chalk">My Progress</h1>
          <p className="text-muted-board text-sm mt-1">Form {profile?.grade} &middot; All subjects</p>
      </div>
        <div className="flex gap-2">
          <button onClick={handleExportCsv} className="flex items-center gap-1.5 text-xs border border-chalk/20 text-chalk rounded-lg px-3 py-2 hover:bg-white/5"><Download className="h-3.5 w-3.5" /> Download CSV</button>
          <Link href="/progress/report"><button className="flex items-center gap-1.5 text-xs border border-gold/30 text-gold rounded-lg px-3 py-2 hover:bg-gold/10"><Printer className="h-3.5 w-3.5" /> Print / Save as PDF</button></Link>
        </div>

      {/* Stat notes */}
      <div className="flex gap-4 flex-wrap">
        <StatNote value={`${overallMastery}%`} label="Overall mastery" />
        <StatNote value={`${completedLessons}/${lessons.length}`} label="Lessons done" />
        <StatNote value={String(totalAttempts)} label="Questions answered" />
        <StatNote value={totalAttempts > 0 ? `${accuracy}%` : '—'} label="Accuracy" />
      </div>

      {/* Strongest / Focus */}
      {(strongest || weakest) && (
        <div className="grid gap-3 sm:grid-cols-2">
          {strongest && (
            <div className="card-board border-teal/40 p-4">
              <div className="flex items-center gap-2 text-teal text-xs font-semibold uppercase tracking-widest mb-2">
                <Award className="h-4 w-4" /> Strongest Topic
              </div>
              <p className="font-semibold text-chalk">{topics.find((t) => t.id === strongest.topic_id)?.name}</p>
              <p className="text-muted-board text-sm font-mono-sc">{strongest.mastery_percentage}% mastery</p>
            </div>
          )}
          {weakest && Number(weakest.mastery_percentage) < 100 && (
            <div className="card-board border-gold/40 p-4">
              <div className="flex items-center gap-2 text-gold text-xs font-semibold uppercase tracking-widest mb-2">
                <Target className="h-4 w-4" /> Focus Area
              </div>
              <p className="font-semibold text-chalk">{topics.find((t) => t.id === weakest.topic_id)?.name}</p>
              <p className="text-muted-board text-sm">
                <span className="font-mono-sc">{weakest.mastery_percentage}%</span> mastery — keep practising!
              </p>
            </div>
          )}
        </div>
      )}

      {/* Subject tabs */}
      {subjects.length > 0 && <div className="flex gap-2 flex-wrap">
        {subjects.map((s) => {
          const Icon = iconMap[s.icon] || GraduationCap;
          const isActive = s.id === activeSubjectId;
          return (
            <button
              key={s.id}
              onClick={() => setActiveSubjectId(s.id)}
              className={`flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold border-2 transition-all ${
                isActive
                  ? 'border-transparent text-ink'
                  : 'border-white/10 text-muted-board hover:text-chalk hover:border-white/20'
              }`}
              style={isActive ? { background: s.color } : undefined}
            >
              <Icon className="h-4 w-4" />
              {s.name}
            </button>
          );
        })}
      </div>}

      {/* Topic breakdown for active subject */}
      {subjects.length > 0 && <div>
        <h2 className="font-display text-lg font-semibold text-chalk mb-3">
          {activeSubject?.name} Topics
        </h2>
        <div className="space-y-3">
          {subjectTopics.map((topic) => {
              const tp = progress.find((p) => p.topic_id === topic.id);
              const mastery = tp ? Number(tp.mastery_percentage) : 0;
              const tl = lessons.filter((l) => l.topic_id === topic.id);
              const done = tp?.lessons_completed || 0;
              const att = tp?.total_attempts || 0;
              const cor = tp?.correct_attempts || 0;
              const color = mastery >= 70 ? 'hsl(163 34% 36%)' : mastery >= 40 ? 'hsl(41 76% 60%)' : 'hsl(17 59% 45%)';

              return (
                <div key={topic.id} className="card-board p-5">
                  <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-0.5">
                        <h3 className="font-semibold text-chalk">{topic.name}</h3>
                        <span className="text-xs border border-chalk/20 text-muted-board rounded-full px-2 py-0.5">{topic.category}</span>
                      </div>
                      <p className="text-muted-board text-xs mb-2">{topic.description}</p>
                      <div className="flex gap-4 text-xs text-muted-board font-mono-sc">
                        <span>{done}/{tl.length} lessons</span>
                        <span>{att} questions</span>
                        {att > 0 && <span>{Math.round((cor / att) * 100)}% accuracy</span>}
                      </div>
                    </div>
                    <div className="sm:w-44 shrink-0">
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-muted-board">Mastery</span>
                        <span className="font-mono-sc font-bold text-chalk">{mastery}%</span>
                      </div>
                      <div className="track">
                        <div className="track-fill" style={{ width: `${mastery}%`, background: color }} />
                      </div>
                      <div className="flex gap-2 mt-3">
                        <button
                          onClick={() => router.push(`/topic/${topic.id}`)}
                          className="flex-1 text-xs border border-chalk/20 text-chalk rounded-lg py-1.5 hover:bg-white/5 transition-colors"
                        >
                          Lessons
                        </button>
                        <button
                          onClick={() => router.push(`/practice/${topic.id}`)}
                          className="flex-1 text-xs border border-gold/30 text-gold rounded-lg py-1.5 hover:bg-gold/10 transition-colors flex items-center justify-center gap-1"
                        >
                          Practice <ArrowRight className="h-3 w-3" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
        </div>
      </div>}
    </div>
  );
}

function StatNote({ value, label }: { value: string; label: string }) {
  return (
    <div className="card-note px-5 py-4 min-w-[120px]">
      <div className="note-pin" />
      <div className="font-mono-sc text-2xl font-bold text-ink">{value}</div>
      <div className="text-xs text-ink/60 mt-0.5">{label}</div>
    </div>
  );
}
