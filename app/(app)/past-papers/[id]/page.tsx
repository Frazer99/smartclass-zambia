'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase, PastPaper, PastPaperQuestion, Subject } from '@/lib/supabase-client';
import { ArrowLeft, Clock, ListChecks, Loader as Loader2, BookOpenCheck } from 'lucide-react';

export default function PastPaperDetailPage() {
  const params = useParams();
  const router = useRouter();
  const paperId = params.id as string;

  const [paper, setPaper] = useState<(PastPaper & { subject?: Subject }) | null>(null);
  const [questions, setQuestions] = useState<PastPaperQuestion[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, [paperId]);

  async function fetchData() {
    const { data: paperData } = await supabase
      .from('past_papers')
      .select('*, subject:subjects(*)')
      .eq('id', paperId)
      .maybeSingle();
    setPaper(paperData as any);

    const { data: qData } = await supabase
      .from('past_paper_questions')
      .select('*')
      .eq('past_paper_id', paperId)
      .order('question_number');
    setQuestions((qData as PastPaperQuestion[]) || []);

    setLoading(false);
  }

  if (loading) {
    return <div className="flex h-72 items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-gold" /></div>;
  }
  if (!paper) {
    return <div className="text-center text-muted-board py-20">Past paper not found.</div>;
  }

  return (
    <div className="space-y-5 animate-fade-in">
      <button
        onClick={() => router.push('/past-papers')}
        className="flex items-center gap-1.5 text-sm text-muted-board hover:text-chalk transition-colors"
      >
        <ArrowLeft className="h-4 w-4" /> Past Papers
      </button>

      <div className="card-board p-5">
        <div className="flex items-start justify-between mb-2">
          <div>
            <p className="text-xs uppercase tracking-widest text-gold font-semibold mb-1">
              {paper.subject?.name} &middot; Grade {paper.grade} &middot; {paper.source}
            </p>
            <h1 className="font-display text-xl font-semibold text-chalk">{paper.title}</h1>
          </div>
          <span className="text-lg font-mono-sc text-gold font-bold">{paper.year}</span>
        </div>
        <div className="flex items-center gap-4 text-xs text-muted-board mt-3">
          <span className="flex items-center gap-1"><ListChecks className="h-3.5 w-3.5" /> {questions.length} questions</span>
          {paper.duration_minutes && (
            <span className="flex items-center gap-1"><Clock className="h-3.5 w-3.5" /> {paper.duration_minutes} minutes</span>
          )}
          {paper.total_marks && <span>{paper.total_marks} marks total</span>}
        </div>
        <button
          onClick={() => router.push(`/past-papers/${paperId}/run`)}
          className="btn-gold mt-4 w-full sm:w-auto"
        >
          Start whole paper →
        </button>
        <button
          onClick={() => router.push(`/past-papers/${paperId}/solutions`)}
          className="mt-2 flex items-center justify-center gap-2 border border-teal/50 text-teal rounded-lg px-4 py-2 text-sm font-semibold w-full sm:w-auto"
        >
          <BookOpenCheck className="h-4 w-4" /> View solutions without AI teacher
        </button>
      </div>

      <div>
        <h2 className="font-display text-lg font-semibold text-chalk mb-3">Or jump to a specific question</h2>
        <div className="space-y-2">
          {questions.map((q) => (
            <button
              key={q.id}
              onClick={() => router.push(`/past-papers/${paperId}/run?q=${q.question_number}`)}
              className="card-topic w-full p-4 flex items-start gap-3 text-left hover:brightness-95 transition-all"
            >
              <span className="shrink-0 w-7 h-7 rounded-full bg-ink text-chalk flex items-center justify-center text-xs font-bold font-mono-sc">
                {q.question_number}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-ink line-clamp-2">{q.question_text}</p>
                <p className="text-xs text-ink/50 mt-1">{q.marks} mark{q.marks === 1 ? '' : 's'}</p>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
