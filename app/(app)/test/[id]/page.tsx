'use client';

import { ChangeEvent, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, ClipboardCheck, FileUp, Loader as Loader2, Trophy } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/components/auth-provider';
import { extractAnswerText } from '@/lib/answer-extraction';
import { PracticeQuestion, supabase, Topic } from '@/lib/supabase-client';

type Mark = { question: string; awarded: number; maximum: number; feedback: string };

export default function TopicTestPage() {
  const params = useParams();
  const router = useRouter();
  const { profile } = useAuth();
  const topicId = params.id as string;
  const [topic, setTopic] = useState<Topic | null>(null);
  const [questions, setQuestions] = useState<PracticeQuestion[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [marking, setMarking] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [marks, setMarks] = useState<Mark[] | null>(null);

  useEffect(() => {
    if (!profile) return;
    (async () => {
      const [topicRes, questionRes] = await Promise.all([
        supabase.from('topics').select('*').eq('id', topicId).not('source_material_id', 'is', null).maybeSingle(),
        supabase.from('practice_questions').select('*').eq('topic_id', topicId),
      ]);
      setTopic(topicRes.data as Topic | null);
      const available = (questionRes.data || []) as PracticeQuestion[];
      setQuestions(topicRes.data ? available.sort(() => Math.random() - 0.5).slice(0, Math.min(10, available.length)) : []);
      setLoading(false);
    })();
  }, [profile, topicId]);

  const markTypedAnswers = async () => {
    const result = questions.map((question) => {
      const answer = answers[question.id] || '';
      const correct = normalise(answer) === normalise(question.answer_key);
      return { question: question.question_text, awarded: correct ? 1 : 0, maximum: 1, feedback: correct ? 'Correct.' : `Correct answer: ${question.answer_key}` };
    });
    await saveAttempts();
    await saveSubmission('online', result, Object.values(answers).join('\n'));
    setMarks(result);
  };

  const saveSubmission = async (source: 'online' | 'upload', result: Mark[], submittedText: string) => {
    if (!profile) return;
    await supabase.from('test_submissions').insert({
      user_id: profile.id,
      topic_id: topicId,
      source,
      submitted_text: submittedText,
      marks: result,
      score: result.reduce((sum, mark) => sum + mark.awarded, 0),
      maximum_score: result.reduce((sum, mark) => sum + mark.maximum, 0),
    });
  };

  const saveAttempts = async () => {
    if (!profile) return;
    const rows = questions.filter((question) => answers[question.id]?.trim()).map((question) => ({
      user_id: profile.id,
      question_id: question.id,
      submitted_answer: answers[question.id],
      is_correct: normalise(answers[question.id]) === normalise(question.answer_key),
    }));
    if (rows.length) await supabase.from('practice_attempts').insert(rows);
  };

  const handleUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setMarking(true);
    setMarks(null);
    try {
      const text = await extractAnswerText(file, setUploadProgress);
      if (!text.trim()) throw new Error('No answer text could be read from that file.');
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Your session has expired. Please sign in again.');
      const response = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/grade-uploaded-test`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ topicId, topicName: topic?.name, questions: questions.map((q) => ({ question: q.question_text, answer: q.answer_key })), submittedText: text }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || 'The uploaded answers could not be marked.');
      setMarks(payload.marks || []);
      toast.success('Your uploaded answers have been marked.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not mark the uploaded answers.');
    } finally {
      setMarking(false);
      setUploadProgress(null);
      event.target.value = '';
    }
  };

  if (loading) return <div className="flex h-72 items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-gold" /></div>;
  if (!topic || questions.length === 0) return <div className="p-8 text-center text-muted-board">There are no test questions for this topic yet.</div>;

  const total = marks?.reduce((sum, mark) => sum + mark.awarded, 0) || 0;
  const maximum = marks?.reduce((sum, mark) => sum + mark.maximum, 0) || 0;

  return (
    <div className="mx-auto max-w-3xl space-y-6 animate-fade-in">
      <button onClick={() => router.push(`/topic/${topicId}`)} className="flex items-center gap-1.5 text-sm text-muted-board hover:text-chalk"><ArrowLeft className="h-4 w-4" /> Back to topic</button>
      <div><p className="text-xs uppercase tracking-widest text-gold font-semibold mb-1">Topic test</p><h1 className="font-display text-2xl font-semibold text-chalk">{topic.name}</h1><p className="text-sm text-muted-board mt-1">Answer the test online, or upload a PDF/image answer sheet for marking.</p></div>

      <div className="card-board border-teal/40 p-5">
        <div className="flex items-center gap-2 mb-2"><FileUp className="h-5 w-5 text-teal" /><h2 className="font-semibold text-chalk">Upload answers</h2></div>
        <p className="text-sm text-muted-board mb-4">Use a clear photo, scanned PDF, or text file. Number your answers to match the questions.</p>
        <label className="inline-flex items-center gap-2 border border-teal/50 text-teal rounded-lg px-4 py-2 text-sm font-semibold cursor-pointer hover:bg-teal/10">
          {marking ? <><Loader2 className="h-4 w-4 animate-spin" /> Marking {uploadProgress ?? 0}%</> : <><FileUp className="h-4 w-4" /> Choose answer file</>}
          <input type="file" accept="image/*,.pdf,.txt" onChange={handleUpload} disabled={marking} className="sr-only" />
        </label>
      </div>

      <div className="max-h-[38rem] space-y-3 overflow-y-auto pr-1">
        {questions.map((question, index) => <div key={question.id} className="card-paper p-5"><p className="font-semibold text-ink mb-3">{index + 1}. {question.question_text}</p><input value={answers[question.id] || ''} onChange={(event) => setAnswers((current) => ({ ...current, [question.id]: event.target.value }))} placeholder="Type your answer" className="w-full px-3 py-2.5 rounded-lg border-2 border-ink/30 bg-chalk text-ink text-sm focus:outline-none focus:ring-2 focus:ring-gold" /></div>)}
      </div>
      <button onClick={markTypedAnswers} disabled={marking} className="btn-gold w-full py-3 flex justify-center items-center gap-2"><ClipboardCheck className="h-4 w-4" /> Submit test for marking</button>

      {marks && <div className="card-paper p-6 text-ink"><div className="flex items-center gap-3 mb-4"><Trophy className="h-7 w-7 text-gold" /><div><h2 className="font-display text-xl font-semibold">Test result</h2><p className="font-mono-sc font-bold">{total}/{maximum} ({maximum ? Math.round((total / maximum) * 100) : 0}%)</p></div></div><div className="space-y-2">{marks.map((mark, index) => <div key={`${mark.question}-${index}`} className="border-t border-ink/10 pt-2 text-sm"><p className="font-semibold">{index + 1}. {mark.question}</p><p className="text-ink/70">{mark.feedback}</p></div>)}</div></div>}
    </div>
  );
}

function normalise(value: string) { return value.trim().toLowerCase().replace(/\s+/g, ' '); }