'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/components/auth-provider';
import { toast } from 'sonner';
import {
  supabase,
  Topic,
  Lesson,
  ProgressRecord,
  LessonSession,
  Subject,
  SearchResult,
  Announcement,
} from '@/lib/supabase-client';
import { analyzeWeakAreas, recommendNextLesson, RecentAttempt, WeakArea } from '@/lib/adaptiveLearning';
import {
  ArrowRight,
  BookOpen,
  Search,
  Calculator,
  FlaskConical,
  Atom,
  TestTube,
  GraduationCap,
  CalendarClock,
  Megaphone,
} from 'lucide-react';

const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  Calculator,
  FlaskConical,
  Atom,
  TestTube,
};

export default function DashboardPage() {
  const { user, profile, loading: authLoading } = useAuth();
  const router = useRouter();

  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [activeSubjectId, setActiveSubjectId] = useState<string>('');
  const [topics, setTopics] = useState<Topic[]>([]);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [progress, setProgress] = useState<ProgressRecord[]>([]);
  const [recentAttempts, setRecentAttempts] = useState<RecentAttempt[]>([]);
  const [activeSession, setActiveSession] = useState<LessonSession | null>(null);
  const [examDates, setExamDates] = useState<Record<string, string>>({});
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const fetchInFlight = useRef(false);

  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    if (authLoading || !profile) return;
    fetchData();
  }, [authLoading, profile]);

  useEffect(() => {
    if (!profile) return;
    const refreshWhenVisible = () => {
      if (document.visibilityState === 'visible') fetchData(true);
    };
    window.addEventListener('focus', refreshWhenVisible);
    document.addEventListener('visibilitychange', refreshWhenVisible);
    return () => {
      window.removeEventListener('focus', refreshWhenVisible);
      document.removeEventListener('visibilitychange', refreshWhenVisible);
    };
  }, [profile]);

  useEffect(() => {
    if (!profile) return;
    const announcementTimer = window.setInterval(() => fetchData(true), 15000);
    return () => window.clearInterval(announcementTimer);
  }, [profile]);

  useEffect(() => {
    if (!authLoading && user && !profile) {
      router.replace('/onboarding');
    }
  }, [authLoading, profile, router, user]);

  const fetchData = async (background = false) => {
    if (!profile) return;
    if (fetchInFlight.current) return;
    fetchInFlight.current = true;
    if (!background) setLoading(true);
    setLoadError(null);

    try {
      const grade = profile.grade;

      const [announcementsRes, subjectsRes, topicsRes, progressRes, sessionRes, attemptsRes, pastPaperAttemptsRes, examDatesRes, lessonsRes] = await Promise.all([
      supabase.from('announcements').select('*').eq('is_active', true).order('created_at', { ascending: false }).limit(3),
      supabase.from('subjects').select('*').order('display_order'),
      supabase.from('topics').select('*').eq('grade', grade).not('source_material_id', 'is', null).order('display_order'),
      supabase.from('progress_records').select('*').eq('user_id', profile.id),
      supabase
        .from('lesson_sessions')
        .select('*, lesson:lessons(id, topic_id, title, difficulty, display_order)')
        .eq('user_id', profile.id)
        .eq('status', 'in_progress')
        .order('started_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
      // Recent practice history, joined to its topic, feeds the adaptive
      // learning engine's "recently struggling" signal (SRS 12.10).
      supabase
        .from('practice_attempts')
        .select('is_correct, created_at, question:practice_questions(topic_id)')
        .eq('user_id', profile.id)
        .order('created_at', { ascending: false })
        .limit(150),
      // Past-paper attempts count too, for questions an admin has tagged
      // with a topic_id — untagged questions simply don't contribute.
      supabase
        .from('past_paper_attempts')
        .select('is_correct, created_at, question:past_paper_questions(topic_id)')
        .eq('user_id', profile.id)
        .order('created_at', { ascending: false })
        .limit(150),
        supabase.from('exam_dates').select('subject_id, exam_date').eq('student_id', profile.id),
        supabase.from('lessons').select('id, topic_id, title, difficulty, display_order').order('display_order'),
    ]);

    const practiceAttempts: RecentAttempt[] = (attemptsRes.data || [])
      .filter((a: any) => a.question?.topic_id)
      .map((a: any) => ({
        topic_id: a.question.topic_id as string,
        is_correct: a.is_correct as boolean,
        created_at: a.created_at as string,
      }));
    const pastPaperAttempts: RecentAttempt[] = (pastPaperAttemptsRes.data || [])
      .filter((a: any) => a.question?.topic_id)
      .map((a: any) => ({
        topic_id: a.question.topic_id as string,
        is_correct: a.is_correct as boolean,
        created_at: a.created_at as string,
      }));
    setRecentAttempts([...practiceAttempts, ...pastPaperAttempts]);
    setAnnouncements((announcementsRes.data || []) as Announcement[]);


    const subs = subjectsRes.data as Subject[] || [];
    const tops = topicsRes.data as Topic[] || [];
    const gradeSubjects = subs.filter((s) => s.grades.includes(grade));

    setSubjects(gradeSubjects);
    setTopics(tops);
    setProgress(progressRes.data as ProgressRecord[] || []);
    setActiveSession(sessionRes.data as LessonSession | null);
    setExamDates(Object.fromEntries((examDatesRes.data || []).map((row: any) => [row.subject_id, row.exam_date])));

    if (gradeSubjects.length > 0) {
      setActiveSubjectId(gradeSubjects[0].id);
    }

    setLessons((lessonsRes.data as Lesson[] || []).filter((lesson) => tops.some((topic) => topic.id === lesson.topic_id)));

      setLoading(false);
    } catch (error) {
      console.error('Dashboard data request failed:', error);
      setLoadError('We could not load your dashboard. Please try again.');
      setLoading(false);
    } finally {
      fetchInFlight.current = false;
    }
  };

  // Debounced search
  useEffect(() => {
    if (!searchQuery.trim() || !profile) {
      setSearchResults([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    const timer = setTimeout(async () => {
      const q = searchQuery.trim();
      const { data } = await supabase
        .from('search_index')
        .select('*')
        .eq('grade', profile.grade)
        .ilike('searchable_text', `%${q}%`)
        .limit(20);
      setSearchResults(data as SearchResult[] || []);
      setSearching(false);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery, profile]);

  const startLesson = useCallback(async (lessonId: string) => {
    const { data: session } = await supabase
      .from('lesson_sessions')
      .insert({ lesson_id: lessonId })
      .select()
      .single();
    if (session) router.push(`/lesson/${session.id}`);
  }, [router]);

  if (authLoading || loading || !profile) {
    return (
      <div className="flex h-72 items-center justify-center text-muted-board">
        {loadError || 'Loading your dashboard...'}
      </div>
    );
  }

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const firstName = profile.full_name.split(' ')[0];

  const overallMastery =
    progress.length > 0
      ? Math.round(progress.reduce((s, p) => s + Number(p.mastery_percentage), 0) / progress.length)
      : 0;
  const completedLessons = progress.reduce((s, p) => s + p.lessons_completed, 0);
  const totalAttempts = progress.reduce((s, p) => s + p.total_attempts, 0);
  const correctAttempts = progress.reduce((s, p) => s + p.correct_attempts, 0);
  const accuracy = totalAttempts > 0 ? Math.round((correctAttempts / totalAttempts) * 100) : 0;

  // Filter topics by active subject (still used for the topic grid below)
  const subjectTopics = topics.filter((t) => t.subject_id === activeSubjectId);

  // Adaptive recommendation runs across ALL of the pupil's topics for their
  // grade, not just the active subject tab — a real tutor doesn't forget
  // you're behind in Science just because you're looking at Mathematics.
  const recommendation = recommendNextLesson(topics, lessons, progress, recentAttempts);
  const nextLesson = recommendation.lesson;
  const weakAreas = analyzeWeakAreas(topics, progress, recentAttempts).slice(0, 3);

  const heroTopic = activeSession
    ? (activeSession as any).lesson?.title
    : nextLesson?.title || 'Select a lesson to begin';
  const heroReason = !activeSession && nextLesson ? recommendation.reason : null;

  const heroPct = overallMastery;
  const circumference = 2 * Math.PI * 27;
  const dashOffset = circumference - (circumference * heroPct) / 100;

  const activeSubject = subjects.find((s) => s.id === activeSubjectId);

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Greeting */}
      <p className="text-muted-board text-sm">
        <b className="text-chalk">{greeting}, {firstName}.</b>{' '}
        {activeSession ? 'Ready to continue where you left off?' : 'Ready to start learning?'}
      </p>

        {announcements.length > 0 && (
          <div className="card-board border-gold/50 p-5">
            <div className="flex items-start gap-3">
              <Megaphone className="h-5 w-5 text-gold shrink-0 mt-0.5" />
              <div className="space-y-3 min-w-0">
                {announcements.map((announcement) => (
                  <article key={announcement.id}>
                    <p className="text-xs uppercase tracking-widest text-gold font-semibold">Announcement</p>
                    <h2 className="font-display text-lg font-semibold text-chalk mt-1">{announcement.title}</h2>
                    <p className="text-sm text-muted-board mt-1 whitespace-pre-wrap">{announcement.body}</p>
                  </article>
                ))}
              </div>
            </div>
          </div>
        )}

      {/* Search bar */}
      <div className="relative">
        <div className="card-board px-4 py-3 flex items-center gap-3">
          <Search className="h-5 w-5 text-gold shrink-0" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search topics, subtopics, or terms across all subjects..."
            className="flex-1 bg-transparent text-chalk placeholder:text-muted-board text-sm focus:outline-none"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="text-xs text-muted-board hover:text-chalk transition-colors"
            >
              Clear
            </button>
          )}
        </div>

        {/* Search results dropdown */}
        {searchQuery.trim() && (
          <div className="absolute top-full left-0 right-0 mt-2 card-board z-30 max-h-80 overflow-y-auto scrollbar-thin">
            {searching ? (
              <div className="p-4 text-sm text-muted-board text-center">Searching...</div>
            ) : searchResults.length === 0 ? (
              <div className="p-4 text-sm text-muted-board text-center">
                No results found for &ldquo;{searchQuery}&rdquo;
              </div>
            ) : (
              <div className="p-2 space-y-1">
                {searchResults.map((r) => {
                  const subj = subjects.find((s) => s.id === r.subject_id);
                  return (
                    <button
                      key={r.id}
                      onClick={() => {
                        if (r.item_type === 'topic' && r.topic_id) {
                          router.push(`/topic/${r.topic_id}`);
                        } else if (r.item_type === 'lesson' && r.topic_id) {
                          router.push(`/topic/${r.topic_id}`);
                        }
                        setSearchQuery('');
                      }}
                      className="w-full text-left rounded-lg px-3 py-2 hover:bg-white/5 transition-colors flex items-center gap-3"
                    >
                      <span
                        className="text-xs font-bold rounded-full px-2 py-0.5 shrink-0"
                        style={{
                          background: subj ? `${subj.color}30` : 'rgba(255,255,255,0.1)',
                          color: subj?.color || '#fff',
                        }}
                      >
                        {subj?.name || '—'}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-chalk font-medium truncate">{r.display_title}</p>
                        {r.description && (
                          <p className="text-xs text-muted-board truncate">{r.description}</p>
                        )}
                      </div>
                      <span className="text-xs text-muted-board capitalize shrink-0">{r.item_type}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Hero continue card */}
      <div className="card-board p-6 flex flex-col sm:flex-row items-center gap-5">
        {/* Sketch icon */}
        <svg width="76" height="76" viewBox="0 0 76 76" fill="none" className="shrink-0">
          <path d="M8 60 Q 38 6, 68 60" stroke="hsl(41 76% 60%)" strokeWidth="3" strokeLinecap="round" />
          <line x1="6" y1="62" x2="70" y2="62" stroke="hsl(158 15% 60%)" strokeWidth="2" />
          <circle cx="38" cy="60" r="3.5" fill="hsl(46 27% 94%)" />
        </svg>
        <div className="flex-1 text-center sm:text-left">
          <p className="text-xs uppercase tracking-widest text-gold font-semibold mb-1">
            {activeSession ? 'Continue learning' : 'Start learning'}
          </p>
          <h3 className="font-display text-xl font-semibold text-chalk mb-1">{heroTopic}</h3>
          <p className="font-hand text-muted-board text-lg mb-4">
            {heroReason
              ? `"${heroReason} — let's work on it."`
              : '"Let\'s pick up right where we stopped, step by step."'}
          </p>
          <div className="flex items-center gap-4 justify-center sm:justify-start">
            {/* Ring */}
            <div className="relative w-14 h-14 shrink-0">
              <svg width="56" height="56" viewBox="0 0 64 64">
                <circle cx="32" cy="32" r="27" stroke="hsl(40 35% 74%)" strokeWidth="6" fill="none" opacity=".3" />
                <circle
                  cx="32" cy="32" r="27"
                  stroke="hsl(41 76% 60%)"
                  strokeWidth="6"
                  fill="none"
                  strokeDasharray={circumference}
                  strokeDashoffset={dashOffset}
                  strokeLinecap="round"
                  transform="rotate(-90 32 32)"
                  style={{ transition: 'stroke-dashoffset 0.5s ease' }}
                />
              </svg>
              <span className="absolute inset-0 flex items-center justify-center font-mono-sc text-xs font-bold text-chalk">
                {heroPct}%
              </span>
            </div>
            {activeSession ? (
              <button
                onClick={() => router.push(`/lesson/${activeSession.id}`)}
                className="btn-gold"
              >
                Resume lesson →
              </button>
            ) : nextLesson ? (
              <button onClick={() => startLesson(nextLesson.id)} className="btn-gold">
                Start lesson →
              </button>
            ) : (
              <Link href="/dashboard">
                <button className="btn-gold">Browse topics →</button>
              </Link>
            )}
          </div>
        </div>
      </div>

      <ExamCountdown
        subjects={subjects}
        examDates={examDates}
        studentId={profile.id}
        onSaved={(subjectId, examDate) => setExamDates((current) => ({ ...current, [subjectId]: examDate }))}
      />

      {/* Focus Areas — adaptive learning analysis (SRS 12.9/12.10) */}
      {weakAreas.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-display text-lg font-semibold text-chalk">Focus areas</h2>
            <span className="text-xs text-muted-board">Based on your recent practice</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {weakAreas.map((area) => (
              <FocusAreaCard key={area.topicId} area={area} subjects={subjects} />
            ))}
          </div>
        </div>
      )}

      {/* Subject tabs */}
      <div className="flex gap-2 flex-wrap">
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
      </div>

      {/* Topics for active subject */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-display text-lg font-semibold text-chalk">
            {activeSubject?.name} Topics
          </h2>
          <span className="text-xs text-muted-board font-mono-sc">
            Form {profile.grade} &middot; {subjectTopics.length} topics
          </span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {subjectTopics.length === 0 ? (
            <div className="col-span-full card-board p-8 text-center text-muted-board text-sm">
              No topics available for this subject yet.
            </div>
          ) : (
            subjectTopics.map((topic) => {
              const tp = progress.find((p) => p.topic_id === topic.id);
              const mastery = tp ? Number(tp.mastery_percentage) : 0;
              const topicLessons = lessons.filter((l) => l.topic_id === topic.id);
              const done = tp?.lessons_completed || 0;
              const color =
                mastery >= 70 ? 'hsl(163 34% 36%)' :
                mastery >= 40 ? 'hsl(41 76% 60%)' :
                'hsl(17 59% 45%)';

              return (
                <div key={topic.id} className="card-topic p-4">
                  <div className="flex items-start justify-between mb-2">
                    <div className="min-w-0">
                      <span className="font-semibold text-ink text-sm">{topic.name}</span>
                      {topic.source_material_id && (
                        <span className="block text-[10px] text-ink/50 mt-0.5">From uploaded syllabus</span>
                      )}
                    </div>
                    <span className="w-2.5 h-2.5 rounded-full shrink-0 mt-1" style={{ background: color }} />
                  </div>
                  <p className="text-xs text-ink/50 mb-2 line-clamp-2">{topic.description}</p>
                  <div className="track mb-1">
                    <div className="track-fill" style={{ width: `${mastery}%`, background: color }} />
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="font-mono-sc text-xs text-ink/50">{mastery}% mastered</span>
                    <span className="text-xs text-ink/40">{done}/{topicLessons.length} lessons</span>
                  </div>
                  <div className="flex gap-2 mt-3">
                    <Link href={`/topic/${topic.id}`} className="flex-1">
                      <button className="w-full text-xs border-2 border-ink rounded-lg py-1.5 font-semibold text-ink hover:bg-ink hover:text-chalk transition-colors flex items-center justify-center gap-1">
                        <BookOpen className="h-3 w-3" /> Lessons
                      </button>
                    </Link>
                    <Link href={`/practice/${topic.id}`} className="flex-1">
                      <button className="w-full text-xs border-2 border-ink rounded-lg py-1.5 font-semibold text-ink hover:bg-ink hover:text-chalk transition-colors flex items-center justify-center gap-1">
                        Practice <ArrowRight className="h-3 w-3" />
                      </button>
                    </Link>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Stats — pinned notes */}
      <div>
        <h2 className="font-display text-lg font-semibold text-chalk mb-3">This month</h2>
        <div className="flex gap-4 flex-wrap">
          <StatNote value={String(completedLessons)} label="Lessons completed" />
          <StatNote value={`${overallMastery}%`} label="Overall mastery" />
          <StatNote value={totalAttempts > 0 ? `${accuracy}%` : '—'} label="Practice accuracy" />
          <StatNote value={String(topics.length)} label="Topics" />
        </div>
      </div>
    </div>
  );
}

function StatNote({ value, label }: { value: string; label: string }) {
  return (
    <div className="card-note px-5 py-4 min-w-[130px]">
      <div className="note-pin" />
      <div className="font-mono-sc text-2xl font-bold text-ink">{value}</div>
      <div className="text-xs text-ink/60 mt-0.5">{label}</div>
    </div>
  );
}

function FocusAreaCard({ area, subjects }: { area: WeakArea; subjects: Subject[] }) {
  const subject = subjects.find((s) => s.id === area.subjectId);
  const severityColor =
    area.severity === 'high' ? 'hsl(17 59% 45%)' : area.severity === 'medium' ? 'hsl(41 76% 60%)' : 'hsl(158 15% 60%)';

  return (
    <div className="card-topic p-4">
      <div className="flex items-start justify-between mb-1.5">
        <span className="font-semibold text-ink text-sm">{area.topicName}</span>
        <span className="w-2.5 h-2.5 rounded-full shrink-0 mt-1" style={{ background: severityColor }} />
      </div>
      {subject && (
        <span
          className="inline-block text-[11px] font-bold rounded-full px-2 py-0.5 mb-2"
          style={{ background: `${subject.color}30`, color: subject.color }}
        >
          {subject.name}
        </span>
      )}
      <p className="text-xs text-ink/60 mb-3">{area.reason}</p>
      <Link href={`/practice/${area.topicId}`}>
        <button className="w-full text-xs border-2 border-ink rounded-lg py-1.5 font-semibold text-ink hover:bg-ink hover:text-chalk transition-colors flex items-center justify-center gap-1">
          Practice this <ArrowRight className="h-3 w-3" />
        </button>
      </Link>
    </div>
  );
}

function ExamCountdown({
  subjects,
  examDates,
  studentId,
  onSaved,
}: {
  subjects: Subject[];
  examDates: Record<string, string>;
  studentId: string;
  onSaved: (subjectId: string, examDate: string) => void;
}) {
  const [subjectId, setSubjectId] = useState(subjects[0]?.id || '');
  const [examDate, setExamDate] = useState('');
  const [saving, setSaving] = useState(false);
  const [today, setToday] = useState(() => new Date());

  useEffect(() => {
    if (!subjectId && subjects[0]) setSubjectId(subjects[0].id);
  }, [subjectId, subjects]);

  useEffect(() => {
    setExamDate(examDates[subjectId] || '');
  }, [examDates, subjectId]);

  useEffect(() => {
    const timer = window.setInterval(() => setToday(new Date()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  const selectedSubject = subjects.find((subject) => subject.id === subjectId);
  const daysRemaining = examDate
    ? Math.ceil((new Date(`${examDate}T23:59:59`).getTime() - today.getTime()) / 86_400_000)
    : null;

  const saveExamDate = async () => {
    if (!subjectId || !examDate) return;
    setSaving(true);
    const { error } = await supabase.from('exam_dates').upsert(
      { student_id: studentId, subject_id: subjectId, exam_date: examDate, updated_at: new Date().toISOString() },
      { onConflict: 'student_id,subject_id' },
    );
    setSaving(false);
    if (error) {
      toast.error('The exam date could not be saved.');
      return;
    }
    onSaved(subjectId, examDate);
    toast.success('Exam countdown updated.');
  };

  return (
    <div className="card-board p-5 flex flex-col gap-4 sm:flex-row sm:items-center">
      <div className="flex items-center gap-3 flex-1">
        <div className="rounded-xl bg-gold/15 p-3 text-gold"><CalendarClock className="h-6 w-6" /></div>
        <div>
          <p className="text-xs uppercase tracking-widest text-gold font-semibold">Exam countdown</p>
          <p className="text-sm text-chalk mt-1">
            {daysRemaining === null
              ? 'Set a date to plan your revision.'
              : daysRemaining > 0
                ? `${daysRemaining} day${daysRemaining === 1 ? '' : 's'} until ${selectedSubject?.name || 'your exam'}`
                : daysRemaining === 0
                  ? `${selectedSubject?.name || 'Your exam'} is today`
                  : `${selectedSubject?.name || 'Your exam'} date has passed`}
          </p>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <select
          value={subjectId}
          onChange={(event) => setSubjectId(event.target.value)}
          className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-chalk focus:outline-none focus:ring-1 focus:ring-gold"
          aria-label="Exam subject"
        >
          {subjects.map((subject) => <option key={subject.id} value={subject.id} className="bg-board text-chalk">{subject.name}</option>)}
        </select>
        <input
          type="date"
          value={examDate}
          min={new Date().toISOString().slice(0, 10)}
          onChange={(event) => setExamDate(event.target.value)}
          className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-chalk focus:outline-none focus:ring-1 focus:ring-gold"
          aria-label="Exam date"
        />
        <button onClick={saveExamDate} disabled={!examDate || saving} className="btn-gold px-3 py-2 text-sm disabled:opacity-40">
          {saving ? 'Saving...' : 'Set date'}
        </button>
      </div>
    </div>
  );
}
