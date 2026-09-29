'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase, Topic, Lesson, LessonSession, Subject } from '@/lib/supabase-client';
import { useAuth } from '@/components/auth-provider';
import { ArrowLeft, Play, CircleCheck as CheckCircle2, Loader as Loader2, RotateCcw, ArrowRight, ClipboardCheck, Calculator, FlaskConical, Atom, TestTube, GraduationCap } from 'lucide-react';

const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  Calculator, FlaskConical, Atom, TestTube,
};

export default function TopicPage() {
  const params = useParams();
  const router = useRouter();
  const { profile } = useAuth();
  const topicId = params.id as string;

  const [topic, setTopic] = useState<Topic | null>(null);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [sessions, setSessions] = useState<LessonSession[]>([]);
  const [subject, setSubject] = useState<Subject | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!profile) return;
    fetchData();
  }, [profile, topicId]);

  const fetchData = async () => {
    if (!profile) return;
    const lessonIds = (await supabase.from('lessons').select('id').eq('topic_id', topicId)).data?.map((l: { id: string }) => l.id) || [];

    const [topicRes, lessonsRes, sessionsRes] = await Promise.all([
      supabase.from('topics').select('*, subject:subjects(*)').eq('id', topicId).maybeSingle(),
      supabase.from('lessons').select('*').eq('topic_id', topicId).order('display_order'),
      supabase.from('lesson_sessions').select('*').eq('user_id', profile.id).in('lesson_id', lessonIds),
    ]);

    setTopic(topicRes.data as Topic);
    if (topicRes.data?.subject) setSubject(topicRes.data.subject as Subject);
    setLessons(lessonsRes.data as Lesson[] || []);
    setSessions(sessionsRes.data as LessonSession[] || []);
    setLoading(false);
  };

  const startLesson = async (lessonId: string) => {
    const existing = sessions.find((s) => s.lesson_id === lessonId && s.status === 'in_progress');
    if (existing) { router.push(`/lesson/${existing.id}`); return; }
    const { data: session } = await supabase.from('lesson_sessions').insert({ lesson_id: lessonId }).select().single();
    if (session) router.push(`/lesson/${session.id}`);
  };

  if (loading) {
    return (
      <div className="flex h-72 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-gold" />
      </div>
    );
  }

  if (!topic) {
    return (
      <div className="flex h-72 flex-col items-center justify-center gap-3">
        <p className="text-muted-board">Topic not found.</p>
        <button onClick={() => router.push('/dashboard')} className="btn-gold px-5 py-2 text-sm">
          Back to Dashboard
        </button>
      </div>
    );
  }

  const completedIds = sessions.filter((s) => s.status === 'completed').map((s) => s.lesson_id);

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <button
          onClick={() => router.push('/dashboard')}
          className="flex items-center gap-1.5 text-sm text-muted-board hover:text-chalk mb-3 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" /> Back to Dashboard
        </button>
        <div className="flex items-center gap-2 mb-1">
          {subject && (
            <span
              className="text-xs font-semibold rounded-full px-2.5 py-0.5"
              style={{ background: `${subject.color}25`, color: subject.color }}
            >
              {subject.name}
            </span>
          )}
          <span className="border border-chalk/20 text-chalk/60 text-xs rounded-full px-2.5 py-0.5">{topic.category}</span>
          <span className="border border-gold/30 text-gold text-xs rounded-full px-2.5 py-0.5">Form {topic.grade}</span>
        </div>
        <h1 className="font-display text-2xl font-semibold text-chalk">{topic.name}</h1>
        <p className="text-muted-board text-sm mt-1">{topic.description}</p>
      </div>

      {/* Lessons */}
      <div className="space-y-2">
        {lessons.length === 0 && (
          <div className="card-board p-5 text-sm text-muted-board">
            This syllabus topic is ready, but its lesson is still being prepared. Please check again shortly.
          </div>
        )}
        {lessons.map((lesson, index) => {
          const done = completedIds.includes(lesson.id);
          const inProgress = sessions.find((s) => s.lesson_id === lesson.id && s.status === 'in_progress');

          return (
            <div key={lesson.id} className="card-board px-5 py-4 flex items-center justify-between gap-3 animate-slide-up">
              <div className="flex items-center gap-3">
                <div
                  className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${
                    done
                      ? 'bg-teal/20 text-teal'
                      : inProgress
                      ? 'bg-gold/20 text-gold'
                      : 'bg-white/5 text-muted-board'
                  }`}
                >
                  {done ? <CheckCircle2 className="h-4 w-4" /> : <span className="font-mono-sc text-xs font-bold">{index + 1}</span>}
                </div>
                <div>
                  <p className="text-chalk text-sm font-semibold">{lesson.title}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-xs text-muted-board capitalize">{lesson.difficulty}</span>
                    {inProgress && (
                      <span className="text-xs bg-gold/20 text-gold rounded-full px-2 py-0.5">In Progress</span>
                    )}
                  </div>
                </div>
              </div>
              <button
                onClick={() => startLesson(lesson.id)}
                className={`btn-gold flex items-center gap-1.5 text-xs px-3 py-2 shrink-0 ${done ? 'opacity-70' : ''}`}
              >
                {inProgress ? <><RotateCcw className="h-3 w-3" /> Resume</> : done ? <>Review <ArrowRight className="h-3 w-3" /></> : <><Play className="h-3 w-3" /> Start</>}
              </button>
            </div>
          );
        })}
      </div>

      {/* Practice CTA */}
      <div className="card-board border-gold/40 p-5 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div>
          <p className="font-semibold text-chalk">Ready to test your knowledge?</p>
          <p className="text-muted-board text-sm">Practice {topic.name} questions with instant feedback.</p>
        </div>
        <button onClick={() => router.push(`/practice/${topic.id}`)} className="btn-gold flex items-center gap-2 shrink-0">
          Start Practice <ArrowRight className="h-4 w-4" />
        </button>
      </div>

      <div className="card-board border-teal/40 p-5 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div>
          <p className="font-semibold text-chalk flex items-center gap-2"><ClipboardCheck className="h-4 w-4 text-teal" /> Test yourself</p>
          <p className="text-muted-board text-sm">Take a topic test, answer online, or upload a PDF or image for marking.</p>
        </div>
        <button onClick={() => router.push(`/test/${topic.id}`)} className="border border-teal/50 text-teal rounded-lg px-4 py-2 text-sm font-semibold hover:bg-teal/10 transition-colors shrink-0">
          Request a test <ArrowRight className="inline h-4 w-4 ml-1" />
        </button>
      </div>
    </div>
  );
}
