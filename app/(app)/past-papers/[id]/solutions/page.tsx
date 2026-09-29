'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Loader as Loader2, Printer } from 'lucide-react';
import { supabase, PastPaper, PastPaperQuestion } from '@/lib/supabase-client';

export default function PastPaperSolutionsPage() {
  const params = useParams();
  const router = useRouter();
  const paperId = params.id as string;
  const [paper, setPaper] = useState<(PastPaper & { subject?: { name: string } }) | null>(null);
  const [questions, setQuestions] = useState<PastPaperQuestion[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const [paperResult, questionResult] = await Promise.all([
        supabase.from('past_papers').select('*, subject:subjects(name)').eq('id', paperId).maybeSingle(),
        supabase.from('past_paper_questions').select('*').eq('past_paper_id', paperId).order('question_number'),
      ]);
      setPaper(paperResult.data as typeof paper);
      setQuestions((questionResult.data || []) as PastPaperQuestion[]);
      setLoading(false);
    })();
  }, [paperId]);

  if (loading) return <div className="flex h-72 items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-gold" /></div>;
  if (!paper) return <div className="py-20 text-center text-muted-board">Past paper not found.</div>;

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex items-center justify-between gap-3">
        <button onClick={() => router.push(`/past-papers/${paperId}`)} className="flex items-center gap-1.5 text-sm text-muted-board hover:text-chalk">
          <ArrowLeft className="h-4 w-4" /> {paper.title}
        </button>
        <button onClick={() => window.print()} className="flex items-center gap-2 rounded-lg border border-gold/40 px-3 py-2 text-sm text-gold hover:bg-gold/10">
          <Printer className="h-4 w-4" /> Print / Save PDF
        </button>
      </div>

      <div>
        <p className="text-xs uppercase tracking-widest text-gold">{paper.subject?.name} · Form {paper.grade} · {paper.year}</p>
        <h1 className="mt-1 font-display text-2xl font-semibold text-chalk">{paper.title} solutions</h1>
        <p className="mt-2 text-sm text-muted-board">Official answers and explanations uploaded by the administrator. No AI teacher is used on this page.</p>
      </div>

      <div className="space-y-4">
        {questions.map((question) => (
          <article key={question.id} className="card-board p-5 break-inside-avoid">
            <div className="flex items-start gap-3">
              <span className="shrink-0 font-mono-sc text-sm font-bold text-gold">Q{question.question_number}</span>
              <p className="flex-1 text-sm font-medium leading-relaxed text-chalk">{question.question_text}</p>
              <span className="shrink-0 text-xs text-muted-board">{question.marks} mark{question.marks === 1 ? '' : 's'}</span>
            </div>
            {question.options?.length ? <ul className="ml-8 mt-3 space-y-1 text-xs text-muted-board">{question.options.map((option) => <li key={option}>{option}</li>)}</ul> : null}
            <div className="mt-4 rounded-lg border-l-2 border-teal bg-teal/10 px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-widest text-teal">Answer</p>
              <p className="mt-1 text-sm text-chalk">{question.answer_key || 'No answer uploaded for this question yet.'}</p>
              {question.explanation ? <><p className="mt-3 text-xs font-semibold uppercase tracking-widest text-muted-board">Working</p><p className="mt-1 text-sm leading-relaxed text-chalk">{question.explanation}</p></> : null}
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}