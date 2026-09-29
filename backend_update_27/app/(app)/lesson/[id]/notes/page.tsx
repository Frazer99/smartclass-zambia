'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase, LessonSession, Lesson, Topic } from '@/lib/supabase-client';
import { ArrowLeft, Printer, Loader as Loader2 } from 'lucide-react';
import { LogoMark } from '@/components/brand/Logo';

/**
 * Same print-optimized approach as /progress/report and the past paper
 * solutions page — the browser's own "Save as PDF," not an added PDF
 * library. Route param is the lesson SESSION id, matching the main
 * lesson page's own convention (a session belongs to one lesson, not
 * the other way around), so this fetches the same
 * lesson_sessions -> lessons -> topics join already used there.
 *
 * "Teaching notes" here is the lesson's own structured curriculum
 * content (intro, steps with board work, examples, summary) — the
 * actual material the AI teacher works from — not a transcript of the
 * specific chat conversation that happened in this session, which
 * would vary pupil to pupil and isn't the reusable "notes to revise
 * from" a pupil is really asking to print.
 */
export default function LessonNotesPage() {
  const params = useParams();
  const router = useRouter();
  const [lesson, setLesson] = useState<(Lesson & { topic?: Topic }) | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const sessionId = params.id as string;
      const { data } = await supabase
        .from('lesson_sessions')
        .select('*, lesson:lessons(*, topic:topics(*))')
        .eq('id', sessionId)
        .maybeSingle();
      if (data) setLesson((data as LessonSession & { lesson: Lesson & { topic: Topic } }).lesson);
      setLoading(false);
    })();
  }, [params.id]);

  if (loading || !lesson) {
    return <div className="flex h-72 items-center justify-center bg-paper"><Loader2 className="h-8 w-8 animate-spin text-ink/40" /></div>;
  }

  const content = lesson.content;
  const generatedDate = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });

  return (
    <div className="min-h-screen bg-paper text-ink">
      <div className="print:hidden sticky top-0 bg-paper border-b border-ink/10 px-6 py-3 flex items-center justify-between">
        <button onClick={() => router.back()} className="flex items-center gap-1.5 text-sm text-ink/60 hover:text-ink transition-colors">
          <ArrowLeft className="h-4 w-4" /> Back to Lesson
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
        <p className="text-xs text-ink/50 mb-8">Powered by ZedCode Technologies &middot; Teaching Notes generated {generatedDate}</p>

        <h1 className="font-display text-2xl font-bold mb-1">{lesson.title}</h1>
        {lesson.topic && (
          <p className="text-sm text-ink/60 mb-8">{lesson.topic.name} · Form {lesson.topic.grade}</p>
        )}

        {content.intro && (
          <p className="text-sm text-ink/80 mb-8 leading-relaxed">{content.intro}</p>
        )}

        {content.steps && content.steps.length > 0 && (
          <div className="mb-8">
            <h2 className="font-display text-base font-bold mb-3">Working Through It</h2>
            <div className="space-y-4">
              {content.steps.map((step, i) => (
                <div key={i} className="break-inside-avoid">
                  <p className="text-sm font-semibold mb-1">{i + 1}. {step.title}</p>
                  <p className="text-sm text-ink/70 mb-2 ml-4">{step.body}</p>
                  {step.board && (
                    <div className="ml-4 bg-ink/5 rounded-lg px-3 py-2 font-mono-sc text-sm">
                      {step.board}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {content.examples && content.examples.length > 0 && (
          <div className="mb-8">
            <h2 className="font-display text-base font-bold mb-3">Worked Examples</h2>
            <div className="space-y-3">
              {content.examples.map((ex, i) => (
                <div key={i} className="break-inside-avoid bg-teal/5 border-l-2 border-teal rounded-r-lg px-3 py-2">
                  <p className="text-sm font-medium mb-1">{ex.problem}</p>
                  <p className="text-sm text-ink/70">{ex.solution}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {content.summary && (
          <div className="mb-4">
            <h2 className="font-display text-base font-bold mb-2">Summary</h2>
            <p className="text-sm text-ink/70 leading-relaxed">{content.summary}</p>
          </div>
        )}

        <p className="text-xs text-ink/40 mt-10 pt-4 border-t border-ink/10">
          Teaching notes from SmartClass Zambia, aligned to the Zambian Curriculum. Generated {generatedDate}.
        </p>
      </div>
    </div>
  );
}
