'use client';

import { useEffect, useState, useCallback, useRef, Suspense } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { supabase, PastPaper, PastPaperQuestion, Subject } from '@/lib/supabase-client';
import { useAuth } from '@/components/auth-provider';
import { TeacherAvatar, TeacherAvatarState } from '@/components/teacher/TeacherAvatar';
import { MathText } from '@/components/paper/MathText';
import { ClassroomScene } from '@/components/lesson/classroom-scene';
import { TeachingMode, loadTeachingMode, saveTeachingMode } from '@/lib/teachingMode';
import { readTutorResponse } from '@/lib/ai-teacher-stream';
import { DEFAULT_TEACHER_VOICE, selectBrowserVoice, TeacherVoiceProfile, voiceProfileForPersona } from '@/lib/teacherVoice';
import { ArrowLeft, BookOpen, ChevronRight, CircleCheck as CheckCircle2, CircleX as XCircle, LayoutPanelTop, Loader as Loader2, MessageCircle } from 'lucide-react';

type BoardItem = { type: 'heading' | 'body' | 'formula' | 'step' | 'example'; content: string };
type ClassroomMode = 'classroom' | 'board' | 'text';

function parseNumericAnswer(value: string): number | null {
  const normalized = value.trim().replace(/,/g, '');
  const fraction = normalized.match(/^(-?\d+(?:\.\d+)?)\s*\/\s*(-?\d+(?:\.\d+)?)$/);
  if (fraction) {
    const numerator = Number(fraction[1]);
    const denominator = Number(fraction[2]);
    return denominator === 0 ? null : numerator / denominator;
  }
  if (!/^-?\d+(?:\.\d+)?$/.test(normalized)) return null;
  return Number(normalized);
}

function answersMatch(submitted: string, expected: string): boolean {
  const normalizedSubmitted = submitted.trim().toLowerCase().replace(/[\s.,]+$/g, '');
  const normalizedExpected = expected.trim().toLowerCase().replace(/[\s.,]+$/g, '');
  if (normalizedSubmitted === normalizedExpected) return true;

  const submittedNumber = parseNumericAnswer(normalizedSubmitted);
  const expectedNumber = parseNumericAnswer(normalizedExpected);
  return submittedNumber !== null && expectedNumber !== null && Math.abs(submittedNumber - expectedNumber) < 0.000001;
}

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
  // Chat state for interactive AI teacher (like lessons)
  type ChatMessage = { role: 'teacher' | 'pupil'; content: string; timestamp: number };
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [pupilInput, setPupilInput] = useState('');
  const [isThinking, setIsThinking] = useState(false);
  const chatRef = useRef<HTMLDivElement | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [textAnswer, setTextAnswer] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [isCorrect, setIsCorrect] = useState(false);
  const [mode, setMode] = useState<TeachingMode>('voice');
  const [classroomMode, setClassroomMode] = useState<ClassroomMode>('classroom');
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [aiSolution, setAiSolution] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [writing, setWriting] = useState(false);
  const [teacherName, setTeacherName] = useState('Mr. Chomba');
  const [voiceProfile, setVoiceProfile] = useState<TeacherVoiceProfile>(DEFAULT_TEACHER_VOICE);
  const [awaitingUnderstandingCheck, setAwaitingUnderstandingCheck] = useState(false);
  const [boardItems, setBoardItems] = useState<BoardItem[]>([]);

  const addToBoard = useCallback((item: BoardItem) => {
    setWriting(true);
    window.setTimeout(() => {
      setBoardItems((current) => [...current, item]);
      setWriting(false);
    }, 350);
  }, []);

  const addAiBoardItems = useCallback((items: unknown) => {
    if (!Array.isArray(items)) return;
    items
      .filter((item): item is BoardItem =>
        !!item && typeof item === 'object' &&
        ['heading', 'body', 'formula', 'step', 'example'].includes((item as BoardItem).type) &&
        typeof (item as BoardItem).content === 'string' &&
        (item as BoardItem).content.trim().length > 0
      )
      .slice(0, 3)
      .forEach((item, itemIndex) => {
        window.setTimeout(() => addToBoard(item), itemIndex * 450);
      });
  }, [addToBoard]);

  const isSingleMode = singleQuestionNumber !== null;
  const question = questions[index];

  useEffect(() => {
    const savedMode = loadTeachingMode();
    setMode(savedMode);
    setClassroomMode(savedMode === 'text' ? 'text' : 'classroom');
  }, []);

  useEffect(() => {
    if (profile) fetchData();
  }, [paperId, profile?.id]);

  // Same persona resolution as the lesson page — see its comment for why
  // this runs up front rather than waiting on the first AI response.
  useEffect(() => {
    if (!paper?.subject_id || !profile) return;
    (async () => {
      const { data } = await supabase
        .from('teacher_personas')
        .select('name, gender, voice_locale, voice_accent, voice_gender, voice_tone, voice_rate')
        .eq('subject_id', paper.subject_id)
        .lte('grade_min', profile.grade)
        .gte('grade_max', profile.grade)
        .maybeSingle();
      if (data?.name) {
        setTeacherName(data.name);
        setVoiceProfile(voiceProfileForPersona(data.name, data.voice_gender || data.gender, {
          locale: data.voice_locale,
          accent: data.voice_accent,
          gender: data.voice_gender,
          tone: data.voice_tone,
          rate: data.voice_rate ? Number(data.voice_rate) : undefined,
        }));
      }
    })();
  }, [paper?.subject_id, profile]);

  useEffect(() => {
    // seed greeting chat when paper loaded
    if (!paper || !profile) return;
    if (chatMessages.length === 0) {
      const firstName = profile?.full_name?.split(' ')[0] || 'there';
      const greeting: ChatMessage = { role: 'teacher', content: `Hello ${firstName}! I'm ${teacherName}. Ask me about this question or the whole paper and I'll walk you through it.`, timestamp: Date.now() };
      setChatMessages([greeting]);
      speak(greeting.content);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paper, profile]);

  // Auto-scroll chat to bottom on new messages
  useEffect(() => {
    const el = chatRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [chatMessages]);

  useEffect(() => {
    if (!question) return;
    setBoardItems([
      { type: 'heading', content: `Question ${question.question_number}` },
      { type: 'body', content: question.question_text },
    ]);
  }, [question?.id]);

  const saveChat = (msgs: ChatMessage[]) => {
    setChatMessages(msgs);
    // persist transcript for this past paper run
    (async () => {
      try {
        if (!profile) return;
        await supabase
          .from('past_paper_transcripts')
          .upsert({ student_id: profile.id, past_paper_id: paperId, transcript: msgs, updated_at: new Date().toISOString() }, { onConflict: 'student_id,past_paper_id' });
      } catch (e) {
        // non-fatal
        console.error('Failed to persist transcript', e);
      }
    })();
  };

  const addTeacher = (text: string) => {
    const msg: ChatMessage = { role: 'teacher', content: text, timestamp: Date.now() };
    const next = [...chatMessages, msg];
    saveChat(next);
    // log teacher response to student_interactions for analytics
    (async () => {
      try {
        if (!profile) return;
        await supabase.from('student_interactions').insert({
          student_id: profile.id,
          lesson_id: null,
          subject_id: paper?.subject_id || null,
          topic_id: null,
          interaction_type: 'chat',
          question: null,
          student_response: null,
          ai_response: text,
          correct: null,
          difficulty: null,
        });
      } catch (e) {
        console.error('Failed to log student interaction (teacher)', e);
      }
    })();
    speak(text);
  };

  const addPupil = (text: string) => {
    const msg: ChatMessage = { role: 'pupil', content: text, timestamp: Date.now() };
    const next = [...chatMessages, msg];
    saveChat(next);
    // log pupil chat turn to student_interactions
    (async () => {
      try {
        if (!profile) return;
        await supabase.from('student_interactions').insert({
          student_id: profile.id,
          lesson_id: null,
          subject_id: paper?.subject_id || null,
          topic_id: null,
          interaction_type: 'chat',
          question: text,
          student_response: text,
          ai_response: null,
          correct: null,
          difficulty: null,
        });
      } catch (e) {
        console.error('Failed to log student interaction (pupil)', e);
      }
    })();
  };

  async function handleSend() {
    if (!pupilInput.trim() || !paper) return;
    const isUnderstandingCheckResponse = awaitingUnderstandingCheck;
    stopTeacherSpeech();
    addPupil(pupilInput.trim());
    const toSend = pupilInput.trim();
    setPupilInput('');
    setAwaitingUnderstandingCheck(false);
    setIsThinking(true);

    try {
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
      const { data: { session } } = await supabase.auth.getSession();
      const response = await fetch(`${supabaseUrl}/functions/v1/ai-teacher-chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(session ? { Authorization: `Bearer ${session.access_token}` } : {}),
        },
        body: JSON.stringify({
          sessionId: paperId,
          message: `Past paper: ${paper.title}\nQuestion ${question?.question_number}: ${question?.question_text || 'the current paper'}\nAdministrator answer: ${question?.answer_key || 'No answer was uploaded for this question.'}\nAdministrator working: ${question?.explanation || 'No worked explanation was uploaded.'}\n\nPupil request: ${toSend}`,
          topicName: paper?.title,
          topicId: question?.topic_id || null,
          subjectId: paper?.subject_id,
          grade: paper?.grade ? (paper.grade > 6 ? paper.grade - 7 : paper.grade) : profile?.grade,
          subjectName: paper?.subject?.name,
          lessonContent: null,
          history: chatMessages.slice(-10).map((m) => ({ role: m.role, content: m.content })),
          isUnderstandingCheckResponse,
          stream: true,
        }),
      });

      if (!response.ok) throw new Error('AI teacher request failed');
      const data = await readTutorResponse(response);
      const aiResponse = data.response || 'Sorry, I could not explain that.';
      addTeacher(aiResponse);
      addAiBoardItems(data.boardItems);
      setAwaitingUnderstandingCheck(data.checkRequired === true);
    } catch (err) {
      console.error('AI teacher call failed', err);
      addTeacher('I am having trouble right now. Please try again.');
      setAwaitingUnderstandingCheck(true);
    }
    setIsThinking(false);
  }

  async function fetchData() {
    const { data: paperData } = await supabase
      .from('past_papers')
      .select('*, subject:subjects(*)')
      .eq('id', paperId)
      .maybeSingle();
    setPaper(paperData as any);

    if (profile) {
      const { data: transcriptData } = await supabase
        .from('past_paper_transcripts')
        .select('transcript')
        .eq('student_id', profile.id)
        .eq('past_paper_id', paperId)
        .maybeSingle();
      if (transcriptData?.transcript) setChatMessages(transcriptData.transcript as ChatMessage[]);
    }

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

  const speak = useCallback((text: string) => {
    if (mode !== 'voice') return;
    if (typeof window === 'undefined' || !window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.rate = voiceProfile.rate;
    const browserVoice = selectBrowserVoice(window.speechSynthesis.getVoices(), voiceProfile);
    if (browserVoice) u.voice = browserVoice;
    u.onstart = () => setIsSpeaking(true);
    u.onend = () => setIsSpeaking(false);
    u.onerror = () => setIsSpeaking(false);
    window.speechSynthesis.speak(u);
  }, [mode, voiceProfile]);

  const stopTeacherSpeech = useCallback(() => {
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    setIsSpeaking(false);
  }, []);

  function handleClassroomModeChange(next: ClassroomMode) {
    if (next === 'text' && window.speechSynthesis) window.speechSynthesis.cancel();
    setIsSpeaking(false);
    setClassroomMode(next);
    const nextTeachingMode = next === 'text' ? 'text' : 'voice';
    setMode(nextTeachingMode);
    saveTeachingMode(nextTeachingMode);
  }

  async function handleSubmit() {
    if (!question) return;
    const answer = question.question_type === 'multiple_choice' ? selected : textAnswer.trim();
    if (!answer) return;

    const correct = answersMatch(answer, question.answer_key);
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

  async function logStudentInteraction(correct: boolean, answer: string) {
    if (!profile || !question?.topic_id) return;
    try {
      const detectedMistake = correct ? null : await detectAnswerMistake(question.question_text, question.answer_key, answer);
      await supabase.from('student_interactions').insert({
        student_id: profile.id, lesson_id: null, subject_id: paper?.subject_id || null,
        topic_id: question.topic_id, interaction_type: 'past_paper_question', question: question.question_text,
        student_response: answer, ai_response: question.explanation || null, correct,
        difficulty: null, detected_mistake: detectedMistake,
      });
      await supabase.rpc('recompute_topic_mastery', { p_student_id: profile.id, p_topic_id: question.topic_id });
    } catch (error) {
      console.error('Failed to log student interaction (non-fatal):', error);
    }
  }

  async function detectAnswerMistake(questionText: string, correctAnswer: string, submittedAnswer: string): Promise<string | null> {
    try {
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return null;
      const response = await fetch(`${supabaseUrl}/functions/v1/detect-answer-mistake`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ questionText, correctAnswer, submittedAnswer, topicName: paper?.title, subjectName: paper?.subject?.name }),
      });
      if (!response.ok) return null;
      return (await response.json()).mistake || null;
    } catch {
      return null;
    }
  }

  async function askAiToExplain() {
    if (!question || !profile) return;
    const submittedAnswer = question.question_type === 'multiple_choice' ? selected : textAnswer.trim();
    const answerContext = submittedAnswer
      ? `The pupil submitted: ${submittedAnswer}. The answer is ${submitted ? (isCorrect ? 'correct' : `incorrect; the correct answer is ${question.answer_key}`) : 'not yet marked'}.`
      : 'The pupil has not submitted an answer yet.';
    setAiLoading(true);
    try {
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
      const { data: { session } } = await supabase.auth.getSession();
      const response = await fetch(`${supabaseUrl}/functions/v1/ai-teacher-chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(session ? { Authorization: `Bearer ${session.access_token}` } : {}),
        },
        body: JSON.stringify({
          sessionId: paperId,
          message: `Question: ${question.question_text}\n${answerContext}\nAdministrator answer: ${question.answer_key || 'No answer was uploaded for this question.'}\nAdministrator working: ${question.explanation || 'No worked explanation was uploaded.'}\nExplain the reasoning clearly. If the submitted answer is incorrect or incomplete, identify the specific mistake and show how to repair it.`,
          topicId: question.topic_id,
          topicName: question?.topic_id ? question.question_text : paper?.title,
          subjectId: paper?.subject_id,
          grade: paper?.grade ? (paper.grade > 6 ? paper.grade - 7 : paper.grade) : profile?.grade,
          subjectName: paper?.subject?.name,
          lessonContent: null,
          history: [],
          stream: true,
        }),
      });

      if (!response.ok) {
        const err = await response.json().catch(() => null);
        throw new Error(err?.response || 'AI request failed');
      }
      const data = await readTutorResponse(response);
      const aiResponse = data.response || JSON.stringify(data);
      setAiSolution(aiResponse);
      addAiBoardItems(data.boardItems);
      speak(aiResponse);
    } catch (err) {
      console.error('AI explain failed', err);
      setAiSolution('AI explanation failed.');
    }
    setAiLoading(false);
  }

  function goToQuestion(newIndex: number) {
    if (newIndex < 0 || newIndex >= questions.length) return;
    setIndex(newIndex);
    setSelected(null);
    setTextAnswer('');
    setSubmitted(false);
    setIsCorrect(false);
    setAiSolution(null);
    setBoardItems([]);
    stopTeacherSpeech();
  }

  if (loading) {
    return <div className="flex h-72 items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-gold" /></div>;
  }
  if (!paper || !question) {
    return <div className="text-center text-muted-board py-20">Question not found.</div>;
  }

  const avatarState: TeacherAvatarState = submitted ? (isCorrect ? 'encouraging' : 'idle') : isSpeaking ? 'speaking' : 'idle';

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex items-center justify-between">
        <button
          onClick={() => router.push(`/past-papers/${paperId}`)}
          className="flex items-center gap-1.5 text-sm text-muted-board hover:text-chalk transition-colors"
        >
          <ArrowLeft className="h-4 w-4" /> {paper.title}
        </button>
        <div className="classroom-mode-toggle" aria-label="Question view">
          <button onClick={() => handleClassroomModeChange('classroom')} className={classroomMode === 'classroom' ? 'active' : ''} title="Enter classroom mode">
            <BookOpen className="h-3.5 w-3.5" /> <span>Classroom</span>
          </button>
          <button onClick={() => handleClassroomModeChange('board')} className={classroomMode === 'board' ? 'active' : ''} title="Focus on the smart board">
            <LayoutPanelTop className="h-3.5 w-3.5" /> <span>Smart board</span>
          </button>
          <button onClick={() => handleClassroomModeChange('text')} className={classroomMode === 'text' ? 'active' : ''} title="Use the text tutor">
            <MessageCircle className="h-3.5 w-3.5" /> <span>Text tutor</span>
          </button>
        </div>
      </div>

      <h1 className="font-display text-xl font-semibold text-chalk">
        {isSingleMode ? `Question ${question.question_number}` : `${paper.title} — Question ${index + 1} of ${questions.length}`}
      </h1>

      {classroomMode === 'classroom' && (
        <ClassroomScene
          teacherName={teacherName}
          grade={profile?.grade || paper.grade}
          avatarState={avatarState}
          writing={writing}
          boardItems={boardItems}
          lessonTitle={`${paper.subject?.name || 'Past paper'} / Question ${question.question_number}`}
          status={writing ? 'Writing the working...' : isSpeaking ? 'Explaining' : submitted ? (isCorrect ? 'Correct answer' : 'Let us repair this') : 'Ready to solve together'}
        />
      )}

      <div className={`card-board overflow-hidden ${classroomMode === 'classroom' ? 'hidden' : ''}`}>
        <div className="flex items-center gap-2 border-b border-white/10 px-4 py-2.5">
          <span className="text-sm font-semibold text-chalk">Teacher&apos;s whiteboard</span>
          {writing && <span className="ml-auto text-xs text-gold">Writing...</span>}
        </div>
        <div className="min-h-24 space-y-2 p-4">
          {boardItems.length === 0 ? (
            <p className="text-xs text-muted-board">Ask the AI teacher to explain the question and key working will appear here.</p>
          ) : boardItems.map((item, itemIndex) => (
            <div key={`${itemIndex}-${item.content}`} className={`animate-write-in rounded-lg p-3 ${item.type === 'heading' ? 'bg-gold/10 text-gold font-bold text-xs uppercase tracking-widest' : item.type === 'formula' ? 'bg-cyan-400/10 text-cyan-200 font-mono text-base border-l-2 border-cyan-300' : item.type === 'step' ? 'bg-white/10 text-chalk font-hand text-base border-l-2 border-gold' : item.type === 'example' ? 'bg-emerald-400/10 text-emerald-100 font-hand text-base border-l-2 border-emerald-300' : 'bg-white/5 text-chalk font-hand text-lg'}`}>
              {item.content}
            </div>
          ))}
        </div>
      </div>

      {mode === 'voice' && classroomMode !== 'classroom' && (
          <div className="card-board px-4 py-3 flex items-center gap-3">
            <TeacherAvatar state={avatarState} writing={writing} size="md" name={teacherName} />
          <div>
            <p className="text-sm font-semibold text-chalk">{teacherName}</p>
            <p className="text-xs text-muted-board">
              {writing ? 'Writing on the board...' : isSpeaking ? 'Speaking' : submitted ? (isCorrect ? 'Well done!' : 'Let\'s go over this') : 'Ready when you are'}
            </p>
          </div>
        </div>
      )}

      {/* Interactive chat with AI teacher (same experience as lessons) */}
      <div className="card-board p-4 space-y-3">
        <div ref={chatRef} className="space-y-3 max-h-56 overflow-y-auto pr-2">
          {chatMessages.map((m, i) => (
            <div key={i} className="flex items-start gap-3">
              <div className="shrink-0">
                {m.role === 'teacher' ? (
                  <div className="w-9 h-9 rounded-full bg-gold/20 flex items-center justify-center text-gold font-semibold">T</div>
                ) : (
                  <div className="w-9 h-9 rounded-full bg-white/5 flex items-center justify-center text-ink font-semibold">Y</div>
                )}
              </div>
              <div className="flex-1">
                <div className="flex items-baseline gap-2">
                  <div className="text-xs font-semibold text-chalk/90">{m.role === 'teacher' ? teacherName : 'You'}</div>
                  <div className="text-xs text-muted-board/70">{new Date(m.timestamp).toLocaleTimeString()}</div>
                </div>
                <div className={`mt-1 p-3 rounded-lg ${m.role === 'teacher' ? 'bg-white/5 text-chalk' : 'bg-white/3 text-ink'}`}>{m.content}</div>
              </div>
            </div>
          ))}
        </div>
        {awaitingUnderstandingCheck && !isThinking && (
          <p className="text-xs text-gold">Answer the teacher&apos;s quick check so we can confirm the idea is clear.</p>
        )}
        <div className="flex gap-2">
          <input
            value={pupilInput}
            onChange={(e) => setPupilInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleSend(); }}
            placeholder="Ask the AI teacher about this question or paper..."
            className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-chalk placeholder:text-muted-board focus:outline-none"
          />
          <button onClick={handleSend} disabled={isThinking} className="btn-gold px-4 py-2">
            {isThinking ? 'Thinking…' : 'Send'}
          </button>
        </div>
      </div>

      <div className="card-board p-5 space-y-4">
        <div className="flex items-start justify-between gap-3">
          <MathText className="font-hand text-xl text-chalk leading-snug">{question.question_text}</MathText>
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
                  <MathText>{opt}</MathText>
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
          <div className="flex gap-2">
            <button
              onClick={handleSubmit}
              disabled={question.question_type === 'multiple_choice' ? !selected : !textAnswer.trim()}
              className="btn-gold disabled:opacity-40 flex-1"
            >
              Submit answer
            </button>
            <button
              onClick={askAiToExplain}
              disabled={aiLoading}
              className="px-4 py-2 border-2 rounded-lg text-sm font-semibold border-white/15 hover:border-white/30"
            >
              {aiLoading ? 'Thinking…' : 'Ask AI teacher to explain'}
            </button>
          </div>
        ) : (
          <div className="space-y-3 animate-write-in">
            <div className={`flex items-center gap-2 text-sm font-semibold ${isCorrect ? 'text-teal' : 'text-rust'}`}>
              {isCorrect ? <CheckCircle2 className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
              {isCorrect ? 'Correct!' : `Not quite. The correct answer is ${question.answer_key}.`}
            </div>
            {question.explanation && (
              <p className={mode === 'voice' ? 'font-hand text-lg text-chalk leading-snug' : 'text-sm text-chalk leading-relaxed'}>
                <MathText>{question.explanation}</MathText>
              </p>
            )}
            {aiSolution && (
              <div className="pt-2">
                <h4 className="text-sm font-semibold text-chalk mb-1">AI teacher explanation</h4>
                <MathText className={mode === 'voice' ? 'font-hand text-lg text-chalk leading-snug' : 'text-sm text-chalk leading-relaxed'}>{aiSolution}</MathText>
              </div>
            )}
            <button
              onClick={askAiToExplain}
              disabled={aiLoading}
              className="px-4 py-2 border-2 rounded-lg text-sm font-semibold border-white/15 hover:border-white/30 disabled:opacity-40"
            >
              {aiLoading ? 'Thinking…' : 'Ask AI teacher to diagnose my answer'}
            </button>
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
