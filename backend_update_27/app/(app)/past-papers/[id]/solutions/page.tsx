'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase, PastPaper, PastPaperQuestion } from '@/lib/supabase-client';
import { ArrowLeft, Printer, Loader as Loader2 } from 'lucide-react';
import { LogoMark } from '@/components/brand/Logo';

/**
 * Same print-optimized approach as /progress/report — the browser's own
 * "Save as PDF" print destination, not an added PDF library (no way to
 * verify one actually renders correctly from this build environment).
 * Light/paper-toned, nav hidden entirely when printing.
 *
 * "AI past paper solutions" here means the explanation already
 * attached to each past_paper_questions row — the same curriculum-
 * aligned content the platform already has, not a fresh LLM call made
 * specifically for this page. That's a deliberate choice: the
 * explanation field is already real, reviewed content; generating a
 * new one on top of it would cost an API call for no clear benefit
 * over what's already there.
 */
export default function PastPaperSolutionsPage() {
  const params = useParams();
  const router = useRouter();
  const [paper, setPaper] = useState<PastPaper | null>(null);
  const [questions, setQuestions] = useState<PastPaperQuestion[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const paperId = params.id as string;
      const [paperRes, questionsRes] = await Promise.all([
        supabase.from('past_papers').select('*, subject:subjects(name, color)').eq('id', paperId).maybeSingle(),
        supabase.from('past_paper_questions').select('*').eq('past_paper_id', paperId).order('question_number'),
      ]);
      setPaper(paperRes.data as PastPaper);
      setQuestions((questionsRes.data as PastPaperQuestion[]) || []);
      setLoading(false);
    })();
  }, [params.id]);

  if (loading || !paper) {
    return <div className="flex h-72 items-center justify-center bg-paper"><Loader2 className="h-8 w-8 animate-spin text-ink/40" /></div>;
  }

  const generatedDate = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });

  return (
    <div className="min-h-screen bg-paper text-ink">
      <div className="print:hidden sticky top-0 bg-paper border-b border-ink/10 px-6 py-3 flex items-center justify-between">
        <button onClick={() => router.push(`/past-papers/${paper.id}`)} className="flex items-center gap-1.5 text-sm text-ink/60 hover:text-ink transition-colors">
          <ArrowLeft className="h-4 w-4" /> Back to Paper
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
        <p className="text-xs text-ink/50 mb-8">Powered by ZedCode Technologies &middot; Solutions generated {generatedDate}</p>

        <h1 className="font-display text-2xl font-bold mb-1">{paper.title}</h1>
        <p className="text-sm text-ink/60 mb-8">
          {paper.subject?.name} · Form {paper.grade} · {paper.year}{paper.term ? ` Term ${paper.term}` : ''} · {questions.length} questions
        </p>

        <div className="space-y-8">
          {questions.map((q) => (
            <div key={q.id} className="break-inside-avoid pb-6 border-b border-ink/10">
              <div className="flex items-start gap-3 mb-2">
                <span className="font-mono-sc text-sm font-bold text-ink/50 shrink-0">Q{q.question_number}</span>
                <p className="text-sm font-medium flex-1">{q.question_text}</p>
                <span className="text-xs text-ink/40 shrink-0">{q.marks} mark{q.marks === 1 ? '' : 's'}</span>
              </div>
              {q.options && q.options.length > 0 && (
                <ul className="ml-8 mb-2 text-xs text-ink/60 space-y-0.5">
                  {q.options.map((opt, i) => (
                    <li key={i}>{String.fromCharCode(65 + i)}. {opt}</li>
                  ))}
                </ul>
              )}
              <div className="ml-8 bg-teal/5 border-l-2 border-teal rounded-r-lg px-3 py-2">
                <p className="text-xs uppercase tracking-widest text-teal font-semibold mb-1">Answer</p>
                <p className="text-sm font-medium mb-2">{q.answer_key}</p>
                {q.explanation && (
                  <>
                    <p className="text-xs uppercase tracking-widest text-ink/40 font-semibold mb-1">Explanation</p>
                    <p className="text-sm text-ink/70">{q.explanation}</p>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>

        <p className="text-xs text-ink/40 mt-10 pt-4 border-t border-ink/10">
          Solutions and explanations provided by SmartClass Zambia, aligned to the Zambian Curriculum. Generated {generatedDate}.
        </p>
      </div>
    </div>
  );
}
