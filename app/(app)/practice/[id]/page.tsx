'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase, PracticeQuestion, Topic, Subject } from '@/lib/supabase-client';
import { useAuth } from '@/components/auth-provider';
import { PracticeResult, selectNextAdaptiveQuestion } from '@/lib/adaptiveLearning';
import { ArrowLeft, CircleCheck as CheckCircle2, Circle as XCircle, ArrowRight, Loader as Loader2, Lightbulb, Trophy, RotateCcw, Calculator, FlaskConical, Atom, TestTube, GraduationCap } from 'lucide-react';

const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  Calculator, FlaskConical, Atom, TestTube,
};
import { toast } from 'sonner';

export default function PracticePage() {
  const params = useParams();
  const router = useRouter();
  const { profile } = useAuth();
  const topicId = params.id as string;

  const [topic, setTopic] = useState<Topic | null>(null);
  const [subject, setSubject] = useState<Subject | null>(null);
  const [questions, setQuestions] = useState<PracticeQuestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selected, setSelected] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [isCorrect, setIsCorrect] = useState(false);
  const [score, setScore] = useState(0);
  const [answered, setAnswered] = useState(0);
  const [sessionResults, setSessionResults] = useState<PracticeResult[]>([]);
  const [finished, setFinished] = useState(false);

  useEffect(() => {
    if (!profile) return;
    fetchQuestions();
  }, [profile, topicId]);

  const fetchQuestions = async () => {
    const [topicRes, qRes] = await Promise.all([
      supabase.from('topics').select('*, subject:subjects(*)').eq('id', topicId).maybeSingle(),
      supabase.from('practice_questions').select('*').eq('topic_id', topicId),
    ]);
    setTopic(topicRes.data as Topic);
    if (topicRes.data?.subject) setSubject(topicRes.data.subject as Subject);
    setQuestions(qRes.data as PracticeQuestion[] || []);
    setLoading(false);
  };

  const handleSubmit = async () => {
    if (!selected.trim() || !profile) return;
    const q = questions[currentIndex];
    const correct = checkAnswer(selected, q.answer_key);
    setIsCorrect(correct);
    setSubmitted(true);
    setAnswered(answered + 1);
    if (correct) setScore(score + 1);
    setSessionResults((results) => [...results, { questionId: q.id, isCorrect: correct }]);

    await supabase.from('practice_attempts').insert({
      user_id: profile.id,
      question_id: q.id,
      submitted_answer: selected,
      is_correct: correct,
    });
    await updateProgress(correct);
    await logStudentInteraction(correct, q);
  };

  const logStudentInteraction = async (correct: boolean, q: PracticeQuestion) => {
    if (!profile || !topic) return;
    try {
      const detectedMistake = correct ? null : await detectAnswerMistake(q.question_text, q.answer_key, selected);
      await supabase.from('student_interactions').insert({
        student_id: profile.id, lesson_id: null, subject_id: (topic as any).subject_id || null,
        topic_id: topic.id, interaction_type: 'practice_question', question: q.question_text,
        student_response: selected, ai_response: q.explanation || null, correct,
        difficulty: q.difficulty || null, detected_mistake: detectedMistake,
      });
      await supabase.rpc('recompute_topic_mastery', { p_student_id: profile.id, p_topic_id: topic.id });
    } catch (error) {
      console.error('Failed to log student interaction (non-fatal):', error);
    }
  };

  const detectAnswerMistake = async (questionText: string, correctAnswer: string, submittedAnswer: string): Promise<string | null> => {
    try {
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return null;
      const response = await fetch(`${supabaseUrl}/functions/v1/detect-answer-mistake`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ questionText, correctAnswer, submittedAnswer, topicName: topic?.name, subjectName: subject?.name }),
      });
      if (!response.ok) return null;
      return (await response.json()).mistake || null;
    } catch {
      return null;
    }
  };

  const updateProgress = async (correct: boolean) => {
    if (!profile || !topic) return;
    const { data: ex } = await supabase.from('progress_records').select('*').eq('user_id', profile.id).eq('topic_id', topic.id).maybeSingle();
    const total = (ex?.total_attempts || 0) + 1;
    const corr = (ex?.correct_attempts || 0) + (correct ? 1 : 0);
    const mastery = Math.round((corr / total) * 100);
    if (ex) {
      await supabase.from('progress_records').update({ total_attempts: total, correct_attempts: corr, mastery_percentage: mastery, last_updated: new Date().toISOString() }).eq('id', ex.id);
    } else {
      await supabase.from('progress_records').insert({ user_id: profile.id, topic_id: topic.id, total_attempts: total, correct_attempts: corr, mastery_percentage: mastery });
    }
  };

  const handleNext = () => {
    const nextQuestion = selectNextAdaptiveQuestion(
      questions,
      sessionResults,
      answered > 0 ? (score / answered) * 100 : null
    );
    if (!nextQuestion) {
      setFinished(true);
      return;
    }
    setCurrentIndex(questions.findIndex((question) => question.id === nextQuestion.id));
    setSelected('');
    setSubmitted(false);
  };

  const handleRestart = () => {
    setCurrentIndex(0); setSelected(''); setSubmitted(false);
    setIsCorrect(false); setScore(0); setAnswered(0); setSessionResults([]); setFinished(false);
  };

  if (loading) return <div className="flex h-72 items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-gold" /></div>;

  if (!topic || questions.length === 0) {
    return (
      <div className="flex h-72 flex-col items-center justify-center gap-3">
        <p className="text-muted-board">No practice questions available for this topic.</p>
        <button onClick={() => router.push('/dashboard')} className="btn-gold px-5 py-2 text-sm">Back to Dashboard</button>
      </div>
    );
  }

  if (finished) {
    const pct = Math.round((score / answered) * 100);
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="card-paper p-8 max-w-sm w-full text-center" style={{ transform: 'rotate(-0.5deg)' }}>
          <div className="w-16 h-16 rounded-full bg-gold/20 flex items-center justify-center mx-auto mb-4">
            <Trophy className="h-8 w-8 text-gold" />
          </div>
          <h2 className="font-display text-2xl font-semibold text-ink mb-1">Practice Complete!</h2>
          <p className="text-ink/70 text-base mb-1">You scored <span className="font-bold text-ink">{score}/{answered}</span></p>
          <p className="font-mono-sc text-lg font-bold text-ink mb-6">{pct}%</p>
          <div className="space-y-2">
            <button onClick={handleRestart} className="btn-gold w-full py-2.5 flex items-center justify-center gap-2">
              <RotateCcw className="h-4 w-4" /> Try Again
            </button>
            <button onClick={() => router.push('/dashboard')} className="w-full py-2.5 border-2 border-ink text-ink rounded-lg font-semibold text-sm hover:bg-ink/5 transition-colors">
              Back to Dashboard
            </button>
          </div>
        </div>
      </div>
    );
  }

  const q = questions[currentIndex];
  const progressPct = (answered / questions.length) * 100;

  return (
    <div className="mx-auto max-w-2xl space-y-4 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <button onClick={() => router.push('/dashboard')} className="flex items-center gap-1.5 text-sm text-muted-board hover:text-chalk transition-colors">
          <ArrowLeft className="h-4 w-4" /> Exit
        </button>
        <span className="border border-gold/30 text-gold text-xs rounded-full px-2.5 py-0.5">{topic.name}</span>
      </div>

      {/* Progress bar */}
      <div>
        <div className="flex justify-between text-xs text-muted-board mb-1">
          <span>Question {currentIndex + 1} of {questions.length}</span>
          <span className="font-mono-sc">{score}/{answered} correct</span>
        </div>
        <div className="track h-2">
          <div className="track-fill h-2" style={{ width: `${progressPct}%`, background: 'hsl(41 76% 60%)' }} />
        </div>
      </div>

      {/* Question card */}
      <div className="card-paper p-6" style={{ transform: 'rotate(0.3deg)' }}>
        <div className="flex items-center gap-2 mb-4">
          <span className="text-xs border border-ink/20 text-ink/60 rounded-full px-2 py-0.5 capitalize">{q.difficulty}</span>
          <span className="text-xs border border-ink/20 text-ink/60 rounded-full px-2 py-0.5 capitalize">{q.question_type.replace('_', ' ')}</span>
        </div>
        <p className="font-display text-lg font-semibold text-ink leading-snug mb-5">{q.question_text}</p>

        {!submitted ? (
          <>
            {q.question_type === 'multiple_choice' && q.options ? (
              <div className="space-y-2 mb-5">
                {q.options.map((opt, i) => (
                  <button
                    key={i}
                    onClick={() => setSelected(opt)}
                    className={`w-full text-left rounded-lg border-2 px-4 py-3 text-sm font-medium transition-all ${
                      selected === opt
                        ? 'border-ink bg-gold/20 text-ink'
                        : 'border-ink/20 text-ink hover:border-ink/50'
                    }`}
                  >
                    <span className="font-bold mr-2">{String.fromCharCode(65 + i)}.</span>{opt}
                  </button>
                ))}
              </div>
            ) : (
              <input
                value={selected}
                onChange={(e) => setSelected(e.target.value)}
                placeholder="Type your answer here..."
                className="w-full mb-5 px-3 py-2.5 rounded-lg border-2 border-ink bg-chalk text-ink font-sans text-sm focus:outline-none focus:ring-2 focus:ring-gold"
                onKeyDown={(e) => { if (e.key === 'Enter') handleSubmit(); }}
              />
            )}
            <button
              onClick={handleSubmit}
              disabled={!selected.trim()}
              className="btn-gold w-full py-3 flex items-center justify-center gap-2 disabled:opacity-40"
            >
              Submit Answer <ArrowRight className="h-4 w-4" />
            </button>
          </>
        ) : (
          <div className="space-y-4">
            {/* Result banner */}
            <div className={`flex items-center gap-3 rounded-lg p-4 ${isCorrect ? 'bg-teal/15 border border-teal/40' : 'bg-rust/15 border border-rust/40'}`}>
              {isCorrect
                ? <CheckCircle2 className="h-6 w-6 text-teal shrink-0" />
                : <XCircle className="h-6 w-6 text-rust shrink-0" />}
              <div>
                <p className={`font-semibold ${isCorrect ? 'text-teal' : 'text-rust'}`}>
                  {isCorrect ? 'Correct! Well done.' : 'Not quite right.'}
                </p>
                {!isCorrect && (
                  <p className="text-xs text-ink/70 mt-0.5">
                    Your answer: {selected} · Correct: {q.answer_key}
                  </p>
                )}
              </div>
            </div>

            {/* Explanation */}
            {q.explanation && (
              <div className="bg-gold/10 border border-gold/30 rounded-lg p-4">
                <div className="flex items-center gap-1.5 text-gold text-xs font-semibold uppercase tracking-widest mb-1.5">
                  <Lightbulb className="h-3.5 w-3.5" /> Explanation
                </div>
                <p className="text-sm text-ink">{q.explanation}</p>
              </div>
            )}

            <button onClick={handleNext} className="btn-gold w-full py-3 flex items-center justify-center gap-2">
              {currentIndex < questions.length - 1
                ? <>Next Question <ArrowRight className="h-4 w-4" /></>
                : <>Finish <Trophy className="h-4 w-4" /></>}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function checkAnswer(submitted: string, key: string): boolean {
  const n = (s: string) => s.trim().toLowerCase().replace(/\s+/g, ' ');
  return n(submitted) === n(key);
}
