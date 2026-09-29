'use client';

import { useEffect, useState, useCallback, useRef, Suspense } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { supabase, PastPaper, PastPaperQuestion, Subject } from '@/lib/supabase-client';
import { useAuth } from '@/components/auth-provider';
import { LiveTeacherAvatar, LiveTeacherAvatarHandle } from '@/components/teacher/LiveTeacherAvatar';
import { TeachingModeToggle } from '@/components/teacher/TeachingModeToggle';
import { TeachingMode, loadTeachingMode, saveTeachingMode } from '@/lib/teachingMode';
import { ArrowLeft, ChevronRight, CircleCheck as CheckCircle2, CircleX as XCircle, Loader as Loader2 } from 'lucide-react';

export default function PastPaperRunPage() {
  return (
    <Suspense fallback={<div className="flex h-72 items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-gold" /></div>}>
      <PastPaperRunInner />
    </Suspense>
  );
}

function PastPaperRunInner() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { profile } = useAuth();
  const paperId = params.id as string;
  const singleQuestionNumber = searchParams.get('q') ? Number(searchParams.get('q')) : null;

  const [paper, setPaper] = useState<(PastPaper & { subject?: Subject }) | null>(null);
  const [questions, setQuestions] = useState<PastPaperQuestion[]>([]);
  const [index, setIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<string | null>(null);
  const [textAnswer, setTextAnswer] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [isCorrect, setIsCorrect] = useState(false);
  const [mode, setMode] = useState<TeachingMode>('video');
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [writing, setWriting] = useState(false);
  const [teacherName, setTeacherName] = useState('Mr. Chomba');
  const liveAvatarRef = useRef<LiveTeacherAvatarHandle>(null);
  const [liveAvatarConnected, setLiveAvatarConnected] = useState(false);

  const isSingleMode = singleQuestionNumber !== null;

  useEffect(() => {
    setMode(loadTeachingMode());
  }, []);

  useEffect(() => {
    fetchData();
  }, [paperId]);

  // Same persona resolution as the lesson page — see its comment for why
  // this runs up front rather than waiting on the first AI response.
  useEffect(() => {
    if (!paper?.subject_id || !profile) return;
    (async () => {
      const { data } = await supabase
        .from('teacher_personas')
        .select('name')
        .eq('subject_id', paper.subject_id)
        .lte('grade_min', profile.grade)
        .gte('grade_max', profile.grade)
        .maybeSingle();
      if (data?.name) setTeacherName(data.name);
    })();
  }, [paper?.subject_id, profile]);

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
    const list = (qData as PastPaperQuestion[]) || [];
    setQuestions(list);

    if (singleQuestionNumber !== null) {
      const i = list.findIndex((q) => q.question_number === singleQuestionNumber);
      setIndex(i >= 0 ? i : 0);
    }
    setLoading(false);
  }

  const question = questions[index];

  const speak = useCallback((text: string) => {
    if (mode !== 'video') return;
    // Same priority as the lesson page: prefer the live avatar's own
    // voice/lip-sync when connected, browser TTS only as the fallback,
    // so the two never speak over each other.
    if (liveAvatarConnected) {
      liveAvatarRef.current?.speak(text);
      return;
    }
    if (typeof window === 'undefined' || !window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.rate = 0.95;
    u.onstart = () => setIsSpeaking(true);
    u.onend = () => setIsSpeaking(false);
    u.onerror = () => setIsSpeaking(false);
    window.speechSynthesis.speak(u);
  }, [mode, liveAvatarConnected]);

  function handleModeChange(next: TeachingMode) {
    if (next === 'text' && window.speechSynthesis) window.speechSynthesis.cancel();
    setIsSpeaking(false);
    setMode(next);
    saveTeachingMode(next);
  }

  async function handleSubmit() {
    if (!question) return;
    const answer = question.question_type === 'multiple_choice' ? selected : textAnswer.trim();
    if (!answer) return;

    const correct = answer.trim().toLowerCase() === question.answer_key.trim().toLowerCase();
    setIsCorrect(correct);
    setSubmitted(true);

    if (profile) {
      await supabase.from('past_paper_attempts').insert({
        user_id: profile.id,
        question_id: question.id,
        submitted_answer: answer,
        is_correct: correct,
      });
      await logStudentInteraction(correct, answer);
    }

    setWriting(true);
    setTimeout(() => setWriting(false), 500);

    const explanation = question.explanation || (correct ? 'Well done, that is correct!' : 'Not quite — let\'s look at why.');
    setTimeout(() => speak(explanation), 550);
  }

  // Student Learning Profile: only questions an admin has tagged with a
  // topic_id can feed the per-topic mastery model — untagged questions
  // still work as ordinary past-paper questions, they just can't be
  // attributed to a specific topic (same opt-in tagging behaviour
  // lib/adaptiveLearning.ts already relies on for the dashboard's Focus
  // Areas panel). Uses the same recompute_topic_mastery function the
  // lesson chat and practice page call, so mastery is computed
  // identically everywhere.
  async function logStudentInteraction(correct: boolean, answer: string) {
    if (!profile || !question?.topic_id) return;
    try {
      const detectedMistake = correct ? null : await detectAnswerMistake(question.question_text, question.answer_key, answer);

      await supabase.from('student_interactions').insert({
        student_id: profile.id,
        lesson_id: null,
        subject_id: paper?.subject_id || null,
        topic_id: question.topic_id,
        interaction_type: 'past_paper_question',
        question: question.question_text,
        student_response: answer,
        ai_response: question.explanation || null,
        correct,
        difficulty: null,
        detected_mistake: detectedMistake,
      });
      await supabase.rpc('recompute_topic_mastery', { p_student_id: profile.id, p_topic_id: question.topic_id });
    } catch (e) {
      console.error('Failed to log student interaction (non-fatal):', e);
    }
  }

  async function detectAnswerMistake(questionText: string, correctAnswer: string, submittedAnswer: string): Promise<string | null> {
    try {
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
      const { data: { session: authSession } } = await supabase.auth.getSession();
      if (!authSession) return null;
      const response = await fetch(`${supabaseUrl}/functions/v1/detect-answer-mistake`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authSession.access_token}` },
        body: JSON.stringify({
          questionText, correctAnswer, submittedAnswer,
          topicName: paper?.title, subjectName: paper?.subject?.name,
        }),
      });
      if (!response.ok) return null;
      const data = await response.json();
      return data.mistake || null;
    } catch {
      return null;
    }
  }

  function goToQuestion(newIndex: number) {
    if (newIndex < 0 || newIndex >= questions.length) return;
    setIndex(newIndex);
    setSelected(null);
    setTextAnswer('');
    setSubmitted(false);
    setIsCorrect(false);
    if (window.speechSynthesis) window.speechSynthesis.cancel();
    setIsSpeaking(false);
  }

  if (loading) {
    return <div className="flex h-72 items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-gold" /></div>;
  }
  if (!paper || !question) {
    return <div className="text-center text-muted-board py-20">Question not found.</div>;
  }

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex items-center justify-between">
        <button
          onClick={() => router.push(`/past-papers/${paperId}`)}
          className="flex items-center gap-1.5 text-sm text-muted-board hover:text-chalk transition-colors"
        >
          <ArrowLeft className="h-4 w-4" /> {paper.title}
        </button>
        <TeachingModeToggle mode={mode} onChange={handleModeChange} />
      </div>

      <h1 className="font-display text-xl font-semibold text-chalk">
        {isSingleMode ? `Question ${question.question_number}` : `${paper.title} — Question ${index + 1} of ${questions.length}`}
      </h1>

      {mode === 'video' && (
        <div className="card-board px-4 py-3 flex items-center gap-3">
          <LiveTeacherAvatar
            ref={liveAvatarRef}
            subjectId={paper.subject_id}
            grade={profile?.grade}
            teacherName={teacherName}
            enabled={true}
            size="md"
            onSpeakingChange={(speaking) => setIsSpeaking(speaking)}
            onConnectionChange={setLiveAvatarConnected}
          />
          <div>
            <p className="text-sm font-semibold text-chalk">{teacherName}</p>
            <p className="text-xs text-muted-board">
              {writing ? 'Writing on the board...' : isSpeaking ? 'Speaking' : submitted ? (isCorrect ? 'Well done!' : 'Let\'s go over this') : 'Ready when you are'}
            </p>
          </div>
        </div>
      )}

      <div className="card-board p-5 space-y-4">
        <div className="flex items-start justify-between gap-3">
          <p className="font-hand text-xl text-chalk leading-snug">{question.question_text}</p>
          <span className="shrink-0 text-xs font-mono-sc text-muted-board">{question.marks} mark{question.marks === 1 ? '' : 's'}</span>
        </div>

        {question.question_type === 'multiple_choice' && question.options ? (
          <div className="space-y-2">
            {question.options.map((opt) => {
              const isChosen = selected === opt;
              const isTheCorrectOne = submitted && opt === question.answer_key;
              const isWrongChosen = submitted && isChosen && opt !== question.answer_key;
              return (
                <button
                  key={opt}
                  disabled={submitted}
                  onClick={() => setSelected(opt)}
                  className={`w-full text-left rounded-lg border-2 px-4 py-2.5 text-sm font-semibold transition-colors ${
                    isTheCorrectOne
                      ? 'border-teal bg-teal/10 text-teal'
                      : isWrongChosen
                        ? 'border-rust bg-rust/10 text-rust'
                        : isChosen
                          ? 'border-gold bg-gold/10 text-chalk'
                          : 'border-white/15 text-chalk hover:border-white/30'
                  }`}
                >
                  {opt}
                </button>
              );
            })}
          </div>
        ) : (
          <input
            disabled={submitted}
            value={textAnswer}
            onChange={(e) => setTextAnswer(e.target.value)}
            placeholder="Type your answer..."
            className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-chalk placeholder:text-muted-board focus:outline-none focus:ring-1 focus:ring-gold"
          />
        )}

        {!submitted ? (
          <button
            onClick={handleSubmit}
            disabled={question.question_type === 'multiple_choice' ? !selected : !textAnswer.trim()}
            className="btn-gold disabled:opacity-40"
          >
            Submit answer
          </button>
        ) : (
          <div className="space-y-3 animate-write-in">
            <div className={`flex items-center gap-2 text-sm font-semibold ${isCorrect ? 'text-teal' : 'text-rust'}`}>
              {isCorrect ? <CheckCircle2 className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
              {isCorrect ? 'Correct!' : `Not quite. The correct answer is ${question.answer_key}.`}
            </div>
            {question.explanation && (
              <p className={mode === 'video' ? 'font-hand text-lg text-chalk leading-snug' : 'text-sm text-chalk leading-relaxed'}>
                {question.explanation}
              </p>
            )}
            <div className="flex items-center justify-between pt-2">
              {isSingleMode ? (
                <button onClick={() => router.push(`/past-papers/${paperId}`)} className="btn-gold flex items-center gap-1.5">
                  Back to paper
                </button>
              ) : index + 1 < questions.length ? (
                <button onClick={() => goToQuestion(index + 1)} className="btn-gold flex items-center gap-1.5">
                  Next question <ChevronRight className="h-4 w-4" />
                </button>
              ) : (
                <button onClick={() => router.push(`/past-papers/${paperId}`)} className="btn-gold flex items-center gap-1.5">
                  <CheckCircle2 className="h-4 w-4" /> Finish paper
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
