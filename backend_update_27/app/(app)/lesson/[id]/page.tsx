'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase, Lesson, Topic, LessonSession, LessonContent } from '@/lib/supabase-client';
import { useAuth } from '@/components/auth-provider';
import {
  ArrowLeft,
  Send,
  Volume2,
  VolumeX,
  PenTool,
  Mic,
  MicOff,
  CircleCheck as CheckCircle2,
  Loader as Loader2,
  ChevronRight,
  ChevronLeft,
  Printer,
} from 'lucide-react';
import { toast } from 'sonner';
import { TeacherAvatar, TeacherAvatarState } from '@/components/teacher/TeacherAvatar';
import { LiveTeacherAvatar, LiveTeacherAvatarHandle } from '@/components/teacher/LiveTeacherAvatar';
import { TeachingModeToggle } from '@/components/teacher/TeachingModeToggle';
import { TeachingMode, loadTeachingMode, saveTeachingMode } from '@/lib/teachingMode';
import { analyzeWeakAreas, RecentAttempt } from '@/lib/adaptiveLearning';
import { useSpeechToText } from '@/hooks/use-speech-to-text';

type BoardItem = { type: 'heading' | 'body'; content: string; done?: boolean };
type ChatMessage = { role: 'teacher' | 'pupil'; content: string; timestamp: number };

export default function LessonPage() {
  const params = useParams();
  const router = useRouter();
  const { profile } = useAuth();
  const sessionId = params.id as string;

  const [session, setSession] = useState<LessonSession | null>(null);
  const [lesson, setLesson] = useState<Lesson | null>(null);
  const [topic, setTopic] = useState<Topic | null>(null);
  const [content, setContent] = useState<LessonContent | null>(null);
  const [loading, setLoading] = useState(true);
  const [stepIndex, setStepIndex] = useState(0);
  const [phase, setPhase] = useState<'intro' | 'steps' | 'examples' | 'summary' | 'complete'>('intro');
  const [boardItems, setBoardItems] = useState<BoardItem[]>([]);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [pupilInput, setPupilInput] = useState('');
  const { isSupported: sttSupported, isListening, interimTranscript, toggleListening } = useSpeechToText({
    onResult: (finalTranscript) => {
      setPupilInput((prev) => (prev ? `${prev} ${finalTranscript}` : finalTranscript));
    },
  });
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [mode, setMode] = useState<TeachingMode>('video');
  const [isThinking, setIsThinking] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [writing, setWriting] = useState(false);
  const [weakAreaReason, setWeakAreaReason] = useState<string | null>(null);
  const [teacherName, setTeacherName] = useState('Mr. Chomba');
  const liveAvatarRef = useRef<LiveTeacherAvatarHandle>(null);
  const [liveAvatarConnected, setLiveAvatarConnected] = useState(false);
  const [showSubscribePrompt, setShowSubscribePrompt] = useState(false);
  // Proactive engagement: refs, not state, since the idle timer itself
  // shouldn't trigger re-renders — only the resulting check-in message
  // does (via addTeacher). idleTimerRef holds the pending timeout;
  // hasEngagedRef only becomes true after the pupil's first message
  // (checking in before they've even started reading would feel like
  // nagging, not a real teacher noticing quiet); checkedInRef prevents
  // repeat check-ins during the SAME idle stretch, reset the moment the
  // pupil does anything.
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasEngagedRef = useRef(false);
  const checkedInRef = useRef(false);
  const chatRef = useRef<HTMLDivElement>(null);
  const boardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMode(loadTeachingMode());
  }, []);

  useEffect(() => {
    if (!profile) return;
    fetchData();
  }, [profile, sessionId]);

  useEffect(() => {
    if (chatRef.current) chatRef.current.scrollTop = chatRef.current.scrollHeight;
  }, [chatMessages]);
  useEffect(() => {
    if (boardRef.current) boardRef.current.scrollTop = boardRef.current.scrollHeight;
  }, [boardItems]);

  const fetchData = async () => {
    const { data: sd } = await supabase
      .from('lesson_sessions')
      .select('*, lesson:lessons(*, topic:topics(*))')
      .eq('id', sessionId)
      .maybeSingle();
    if (!sd) { toast.error('Lesson not found.'); router.push('/dashboard'); return; }
    setSession(sd as LessonSession);
    const ld = sd.lesson as Lesson & { topic: Topic };
    setLesson(ld);
    setTopic(ld.topic);
    setContent(ld.content as LessonContent);
    if (sd.status === 'completed') { setCompleted(true); setPhase('complete'); }
    if (sd.transcript?.length) {
      setChatMessages(sd.transcript as ChatMessage[]);
    } else {
      const firstName = profile?.full_name.split(' ')[0] || 'there';
      let greeting = `Hello ${firstName}! Welcome to today's lesson on ${ld.title}. Let us get started!`;

      // A real, AI-generated opening greeting (generate-greeting), not a
      // fixed template — the teaching conversation that follows was
      // always genuinely dynamic (ai-teacher-chat is a live LLM call);
      // the very first thing a pupil saw before that shouldn't be the
      // one scripted-feeling part of the lesson. Resolves the pupil's
      // most recent genuinely-past struggle (a different calendar day,
      // not the same sitting) server-side and lets the teacher's own
      // voice reference it naturally, rather than a fixed sentence shape
      // every time. Falls back to the plain template above if the call
      // fails for any reason — a pupil should never see a missing
      // greeting because of an API hiccup.
      try {
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
        const { data: { session: authSession } } = await supabase.auth.getSession();
        if (authSession) {
          const response = await fetch(`${supabaseUrl}/functions/v1/generate-greeting`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authSession.access_token}` },
            body: JSON.stringify({
              lessonTitle: ld.title,
              topicName: ld.topic?.name,
              subjectId: (ld.topic as any)?.subject_id,
              grade: profile?.grade,
            }),
          });
          if (response.ok) {
            const data = await response.json();
            if (data.greeting) greeting = data.greeting;
          }
        }
      } catch (e) {
        console.error('generate-greeting failed (using fallback greeting):', e);
      }

      const msg: ChatMessage = {
        role: 'teacher',
        content: greeting,
        timestamp: Date.now(),
      };
      setChatMessages([msg]);
      speak(msg.content);
    }
    setLoading(false);
  };

  const speak = (text: string) => {
    if (mode !== 'video' || !voiceEnabled) return;
    // Prefer the real streaming avatar's own voice/lip-sync when a live
    // session is connected — it already knows how to speak this text.
    // Only fall back to the browser's SpeechSynthesis (the illustrated
    // avatar's original voice path) when no live session is available,
    // so the two never both talk over each other.
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
  };

  // Feeds the adaptive learning engine's read on THIS topic into the AI
  // teacher's system prompt (SRS 12.9), so Mr. Chomba already knows if the
  // pupil has been struggling here before they even ask a question.
  useEffect(() => {
    if (!topic || !profile) return;
    (async () => {
      const [progressRes, attemptsRes, pastPaperAttemptsRes] = await Promise.all([
        supabase.from('progress_records').select('*').eq('user_id', profile.id).eq('topic_id', topic.id),
        supabase
          .from('practice_attempts')
          .select('is_correct, created_at, question:practice_questions(topic_id)')
          .eq('user_id', profile.id)
          .order('created_at', { ascending: false })
          .limit(50),
        supabase
          .from('past_paper_attempts')
          .select('is_correct, created_at, question:past_paper_questions(topic_id)')
          .eq('user_id', profile.id)
          .order('created_at', { ascending: false })
          .limit(50),
      ]);
      const progress = (progressRes.data as any[]) || [];
      const toRecent = (rows: any[]): RecentAttempt[] =>
        rows
          .filter((a: any) => a.question?.topic_id === topic.id)
          .map((a: any) => ({
            topic_id: a.question.topic_id as string,
            is_correct: a.is_correct as boolean,
            created_at: a.created_at as string,
          }));
      const attempts = [...toRecent(attemptsRes.data || []), ...toRecent(pastPaperAttemptsRes.data || [])];
      const areas = analyzeWeakAreas([topic], progress, attempts);
      setWeakAreaReason(areas[0]?.reason || null);
    })();
  }, [topic?.id, profile?.id]);

  // Resolves the correct named teacher for this topic's subject/grade up
  // front (Linda, Mrs Tembo, Mr Chomba, Mr Banda, or Chipo — see
  // the teacher_personas table) rather than waiting for the first AI
  // response to learn it, so the header/avatar never briefly shows the
  // wrong teacher's name before the pupil sends anything.
  useEffect(() => {
    if (!topic || !profile) return;
    const subjectId = (topic as any).subject_id;
    if (!subjectId) return;
    (async () => {
      const { data } = await supabase
        .from('teacher_personas')
        .select('name')
        .eq('subject_id', subjectId)
        .lte('grade_min', profile.grade)
        .gte('grade_max', profile.grade)
        .maybeSingle();
      if (data?.name) setTeacherName(data.name);
    })();
  }, [topic, profile]);

  function handleModeChange(next: TeachingMode) {
    if (next === 'text' && window.speechSynthesis) window.speechSynthesis.cancel();
    setIsSpeaking(false);
    setMode(next);
    saveTeachingMode(next);
  }

  const saveTranscript = (msgs: ChatMessage[]) => {
    supabase.from('lesson_sessions').update({ transcript: msgs }).eq('id', sessionId);
  };

  const addTeacher = useCallback((text: string) => {
    const msg: ChatMessage = { role: 'teacher', content: text, timestamp: Date.now() };
    setChatMessages((prev) => { const u = [...prev, msg]; saveTranscript(u); return u; });
    speak(text);
  }, [voiceEnabled, sessionId, mode]);

  // Proactive engagement: a real AI-generated check-in (generate-greeting,
  // mode: 'checkin') when the pupil has gone quiet mid-lesson — the same
  // "engage like a human being, not statically" principle already
  // applied to the opening greeting, now applied to silence during the
  // lesson too. References what the pupil last said if there's anything
  // to reference, rather than a generic "are you there?".
  const triggerCheckIn = useCallback(async () => {
    if (checkedInRef.current || completed || showSubscribePrompt || !lesson || !topic) return;
    checkedInRef.current = true;
    try {
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
      const { data: { session: authSession } } = await supabase.auth.getSession();
      if (!authSession) return;
      const lastPupilMessage = [...chatMessages].reverse().find((m) => m.role === 'pupil')?.content;
      const response = await fetch(`${supabaseUrl}/functions/v1/generate-greeting`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authSession.access_token}` },
        body: JSON.stringify({
          mode: 'checkin',
          lessonTitle: lesson.title,
          topicName: topic.name,
          subjectId: (topic as any).subject_id,
          grade: profile?.grade,
          lastPupilMessage,
        }),
      });
      if (response.ok) {
        const data = await response.json();
        if (data.greeting) addTeacher(data.greeting);
      }
    } catch (e) {
      console.error('Check-in generation failed (non-fatal):', e);
    }
  }, [completed, showSubscribePrompt, lesson, topic, profile, chatMessages, addTeacher]);

  const IDLE_CHECKIN_MS = 60000;

  // Resets the countdown on any new message (including the check-in's
  // own message — otherwise it could re-fire the instant it's sent).
  // Deliberately does NOT reset checkedInRef here — that only happens on
  // genuine pupil activity (see handleSend and the pupilInput effect
  // below), so one silent pupil gets exactly one check-in, not a
  // check-in every 60 seconds forever if they never come back.
  const resetIdleTimer = useCallback(() => {
    if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    if (!hasEngagedRef.current || completed || showSubscribePrompt) return;
    idleTimerRef.current = setTimeout(() => { triggerCheckIn(); }, IDLE_CHECKIN_MS);
  }, [completed, showSubscribePrompt, triggerCheckIn]);

  useEffect(() => {
    resetIdleTimer();
    return () => { if (idleTimerRef.current) clearTimeout(idleTimerRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pupilInput, chatMessages.length]);

  // Typing is real pupil activity — re-enable a future check-in the
  // moment they start typing again, even before they send anything.
  useEffect(() => {
    if (pupilInput.length > 0) checkedInRef.current = false;
  }, [pupilInput]);

  const addToBoard = (item: BoardItem) => {
    setWriting(true);
    setTimeout(() => {
      setBoardItems((prev) => [...prev, item]);
      setWriting(false);
    }, 400);
  };

  const handleSend = async () => {
    if (!pupilInput.trim() || !content) return;
    hasEngagedRef.current = true;
    checkedInRef.current = false;
    // A real teacher stops talking when a pupil interrupts with a new
    // question — the live avatar should too, rather than finishing its
    // previous sentence over the pupil's next message.
    liveAvatarRef.current?.interrupt();
    const msg: ChatMessage = { role: 'pupil', content: pupilInput, timestamp: Date.now() };
    const updated = [...chatMessages, msg];
    setChatMessages(updated);
    saveTranscript(updated);
    setPupilInput('');
    setIsThinking(true);

    try {
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
      const { data: { session: authSession } } = await supabase.auth.getSession();
      const response = await fetch(`${supabaseUrl}/functions/v1/ai-teacher-chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(authSession ? { Authorization: `Bearer ${authSession.access_token}` } : {}),
        },
        body: JSON.stringify({
          sessionId,
          message: pupilInput,
          lessonTitle: lesson?.title,
          topicId: topic?.id,
          topicName: topic?.name,
          topicDescription: topic?.description,
          subjectId: (topic as any)?.subject_id,
          grade: profile?.grade,
          subjectName: (topic as any)?.subject?.name,
          lessonContent: content,
          history: updated.slice(-10).map((m) => ({ role: m.role, content: m.content })),
          weakAreaReason: weakAreaReason || undefined,
        }),
      });

      if (response.status === 402) {
        const data = await response.json().catch(() => null);
        setIsThinking(false);
        addTeacher(data?.response || "You've used today's free messages — subscribe to keep chatting without limits.");
        setShowSubscribePrompt(true);
        return;
      }
      if (response.status === 429) {
        const data = await response.json().catch(() => null);
        setIsThinking(false);
        toast.error(data?.response || "You're sending messages a little fast — try again in a moment.");
        return;
      }
      if (!response.ok) throw new Error('AI teacher request failed');
      const data = await response.json();
      const aiResponse = data.response || 'I am having trouble right now. Please try again.';
      setIsThinking(false);
      addTeacher(aiResponse);
    } catch (err) {
      setIsThinking(false);
      const fallback = generateFallbackResponse(pupilInput, content);
      addTeacher(fallback);
    }
  };

  const handleNext = () => {
    if (!content) return;
    if (phase === 'intro') { setPhase('steps'); setStepIndex(0); showStep(0, content); }
    else if (phase === 'steps') {
      if (stepIndex < content.steps.length - 1) { const n = stepIndex + 1; setStepIndex(n); showStep(n, content); }
      else { setPhase('examples'); showExamples(content); }
    } else if (phase === 'examples') { setPhase('summary'); showSummary(content); }
    else if (phase === 'summary') completeLesson();
  };

  const handlePrev = () => {
    if (!content) return;
    if (phase === 'steps' && stepIndex > 0) { const p = stepIndex - 1; setStepIndex(p); showStep(p, content); }
    else if (phase === 'examples') { setPhase('steps'); const i = content.steps.length - 1; setStepIndex(i); showStep(i, content); }
    else if (phase === 'summary') { setPhase('examples'); showExamples(content); }
  };

  const showStep = (i: number, c: LessonContent) => {
    const s = c.steps[i];
    addTeacher(s.body);
    addToBoard({ type: 'heading', content: s.title });
    setTimeout(() => addToBoard({ type: 'body', content: s.board }), 500);
  };

  const showExamples = (c: LessonContent) => {
    if (!c.examples.length) return;
    const ex = c.examples[0];
    addTeacher('Let us look at an example: ' + ex.problem);
    addToBoard({ type: 'heading', content: 'Example' });
    addToBoard({ type: 'body', content: ex.problem });
    setTimeout(() => { addTeacher('Here is the solution: ' + ex.solution); addToBoard({ type: 'body', content: ex.solution }); }, 1400);
  };

  const showSummary = (c: LessonContent) => {
    addTeacher('Let me summarise what we have covered: ' + c.summary);
    addToBoard({ type: 'heading', content: 'Summary' });
    addToBoard({ type: 'body', content: c.summary });
  };

  const completeLesson = async () => {
    setPhase('complete'); setCompleted(true);
    addTeacher('Excellent work! You have completed this lesson. Try the practice questions to test your understanding.');
    await supabase.from('lesson_sessions').update({ status: 'completed', completed_at: new Date().toISOString() }).eq('id', sessionId);
    if (profile && topic) {
      const { data: ex } = await supabase.from('progress_records').select('*').eq('user_id', profile.id).eq('topic_id', topic.id).maybeSingle();
      if (ex) {
        await supabase.from('progress_records').update({ lessons_completed: ex.lessons_completed + 1, last_updated: new Date().toISOString() }).eq('id', ex.id);
      } else {
        await supabase.from('progress_records').insert({ user_id: profile.id, topic_id: topic.id, lessons_completed: 1, mastery_percentage: 0 });
      }
    }
  };

  if (loading) {
    return <div className="flex h-72 items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-gold" /></div>;
  }
  if (!lesson || !content) return null;

  const avatarState: TeacherAvatarState = isThinking
    ? 'thinking'
    : completed
      ? 'encouraging'
      : isSpeaking
        ? 'speaking'
        : 'idle';

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <button onClick={() => router.push('/dashboard')} className="flex items-center gap-1.5 text-sm text-muted-board hover:text-chalk transition-colors">
          <ArrowLeft className="h-4 w-4" /> Dashboard
        </button>
        <div className="flex items-center gap-2">
          <span className="border border-gold/30 text-gold text-xs rounded-full px-2.5 py-0.5">{topic?.name}</span>
          <TeachingModeToggle mode={mode} onChange={handleModeChange} />
          {mode === 'video' && (
            <button
              onClick={() => { if (voiceEnabled && window.speechSynthesis) window.speechSynthesis.cancel(); setVoiceEnabled(!voiceEnabled); }}
              className="flex items-center gap-1.5 text-xs border border-chalk/20 rounded-lg px-2.5 py-1.5 text-muted-board hover:text-chalk transition-colors"
            >
              {voiceEnabled ? <><Volume2 className="h-3.5 w-3.5" /> Voice On</> : <><VolumeX className="h-3.5 w-3.5" /> Voice Off</>}
            </button>
          )}
        </div>
      </div>

      <div className="flex items-center justify-between">
        <h1 className="font-display text-xl font-semibold text-chalk">{lesson.title}</h1>
        <Link
          href={`/lesson/${sessionId}/notes`}
          className="text-xs border border-white/15 text-muted-board hover:text-chalk rounded-lg px-3 py-1.5 transition-colors flex items-center gap-1.5 shrink-0"
        >
          <Printer className="h-3.5 w-3.5" /> Print notes
        </Link>
      </div>

      {/* Main: Board + Teacher/Chat */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* Smart Board with Teacher Avatar */}
        <div className="space-y-3">
          {/* Teacher Avatar */}
          <div className="card-board px-4 py-3 flex items-center gap-3">
            <LiveTeacherAvatar
              ref={liveAvatarRef}
              subjectId={(topic as any)?.subject_id}
              grade={profile?.grade}
              teacherName={teacherName}
              enabled={mode === 'video'}
              size="md"
              onSpeakingChange={(speaking) => setIsSpeaking(speaking)}
              onConnectionChange={setLiveAvatarConnected}
            />
            <div>
              <p className="text-sm font-semibold text-chalk">{teacherName}</p>
              <p className="text-xs text-muted-board">
                {mode === 'text'
                  ? 'Text explanation mode'
                  : writing
                    ? 'Writing on the board...'
                    : isThinking
                      ? 'Thinking...'
                      : isSpeaking
                        ? 'Speaking'
                        : completed
                          ? 'Well done today!'
                          : 'Your AI teacher'}
              </p>
            </div>
          </div>

          {/* Whiteboard */}
          <div className="card-board overflow-hidden">
            <div className="flex items-center gap-2 border-b border-white/10 px-4 py-2.5">
              <PenTool className="h-4 w-4 text-gold" />
              <span className="text-sm font-semibold text-chalk">Whiteboard</span>
              {writing && (
                <span className="ml-auto text-xs text-gold flex items-center gap-1">
                  <Loader2 className="h-3 w-3 animate-spin" /> writing...
                </span>
              )}
            </div>
            <div ref={boardRef} className="h-80 overflow-y-auto p-4 space-y-2 scrollbar-thin">
              {boardItems.length === 0 ? (
                <div className="flex h-full items-center justify-center text-center">
                  <div>
                    <PenTool className="mx-auto mb-2 h-8 w-8 text-muted-board/30" />
                    <p className="text-xs text-muted-board">The whiteboard will show steps as the lesson progresses.</p>
                  </div>
                </div>
              ) : (
                boardItems.map((item, i) => (
                  <div
                    key={i}
                    className={`animate-write-in rounded-lg p-3 ${
                      item.type === 'heading'
                        ? 'bg-gold/10 text-gold font-bold text-xs uppercase tracking-widest'
                        : 'bg-white/5 text-chalk font-hand text-lg'
                    }`}
                  >
                    {item.content}
                  </div>
                ))
              )}
              {/* Writing cursor animation */}
              {writing && (
                <div className="flex items-center gap-1 text-gold/50 animate-pulse">
                  <PenTool className="h-4 w-4" />
                  <span className="font-hand text-sm">writing...</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* AI Teacher chat */}
        <div className="card-board overflow-hidden flex flex-col">
          <div className="flex items-center gap-2 border-b border-white/10 px-4 py-2.5">
            <TeacherAvatar state={mode === 'video' ? avatarState : 'idle'} size="xs" name={teacherName} />
            <span className="text-sm font-semibold text-chalk">Ask {teacherName}</span>
            {isThinking && <span className="ml-auto text-xs text-muted-board flex items-center gap-1"><Loader2 className="h-3 w-3 animate-spin" /> thinking...</span>}
          </div>
          <div ref={chatRef} className="flex-1 overflow-y-auto p-4 space-y-3 h-64 scrollbar-thin">
            {chatMessages.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === 'pupil' ? 'justify-end' : 'justify-start'} animate-slide-up`}>
                <div
                  className={`max-w-[85%] rounded-xl px-3 py-2 text-sm ${
                    msg.role === 'pupil'
                      ? 'bg-gold text-ink font-medium'
                      : 'bg-white/8 text-chalk border border-white/10'
                  }`}
                  style={msg.role === 'teacher' ? { background: 'rgba(255,255,255,0.06)' } : undefined}
                >
                  {msg.content}
                </div>
              </div>
            ))}
          </div>
          <div className="border-t border-white/10 p-3">
            {isListening && (
              <div className="mb-2 flex items-center gap-1.5 text-xs text-gold">
                <span className="flex gap-0.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-gold animate-pulse" />
                  <span className="h-1.5 w-1.5 rounded-full bg-gold animate-pulse [animation-delay:150ms]" />
                  <span className="h-1.5 w-1.5 rounded-full bg-gold animate-pulse [animation-delay:300ms]" />
                </span>
                Listening... {interimTranscript && <span className="text-muted-board italic">&ldquo;{interimTranscript}&rdquo;</span>}
              </div>
            )}
            {showSubscribePrompt && (
              <div className="mb-3 border-2 border-gold bg-gold/10 rounded-lg p-3 flex items-center justify-between gap-3">
                <p className="text-xs text-chalk">You've used today's free messages. Subscribe for unlimited access, or come back tomorrow.</p>
                <Link href="/subscribe" className="btn-gold text-xs px-3 py-1.5 shrink-0 whitespace-nowrap">Subscribe →</Link>
              </div>
            )}
            <div className="flex gap-2">
              <textarea
                value={pupilInput}
                onChange={(e) => setPupilInput(e.target.value)}
                placeholder={showSubscribePrompt ? "Subscribe to keep chatting today..." : "Ask a question or answer the teacher..."}
                rows={1}
                disabled={showSubscribePrompt}
                className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-chalk placeholder:text-muted-board resize-none focus:outline-none focus:ring-1 focus:ring-gold disabled:opacity-50"
                onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
              />
              {sttSupported && (
                <button
                  onClick={toggleListening}
                  title={isListening ? 'Stop listening' : 'Speak your question'}
                  disabled={showSubscribePrompt}
                  className={`px-3 py-2 rounded-lg border transition-colors disabled:opacity-40 ${
                    isListening ? 'bg-rust/20 border-rust text-rust' : 'border-white/10 text-muted-board hover:text-chalk'
                  }`}
                >
                  {isListening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                </button>
              )}
              <button
                onClick={handleSend}
                disabled={!pupilInput.trim() || isThinking || showSubscribePrompt}
                className="btn-gold px-3 py-2 rounded-lg disabled:opacity-40"
              >
                <Send className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="card-board px-5 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button
            onClick={handlePrev}
            disabled={phase === 'intro'}
            className="flex items-center gap-1 text-sm text-muted-board hover:text-chalk disabled:opacity-30 transition-colors"
          >
            <ChevronLeft className="h-4 w-4" /> Previous
          </button>
          <span className="text-xs text-muted-board font-mono-sc">
            {phase === 'intro' && 'Introduction'}
            {phase === 'steps' && `Step ${stepIndex + 1}/${content.steps.length}`}
            {phase === 'examples' && 'Examples'}
            {phase === 'summary' && 'Summary'}
            {phase === 'complete' && 'Complete'}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {completed && topic && (
            <button onClick={() => router.push(`/practice/${topic.id}`)} className="flex items-center gap-1.5 text-xs border border-teal/40 text-teal rounded-lg px-3 py-1.5 hover:bg-teal/10 transition-colors">
              <CheckCircle2 className="h-3.5 w-3.5" /> Practice
            </button>
          )}
          <button
            onClick={handleNext}
            disabled={phase === 'complete'}
            className="btn-gold flex items-center gap-1.5 text-sm px-4 py-2 disabled:opacity-40"
          >
            {phase === 'summary' ? <><CheckCircle2 className="h-4 w-4" /> Finish</> : <>Next <ChevronRight className="h-4 w-4" /></>}
          </button>
        </div>
      </div>
    </div>
  );
}

function generateFallbackResponse(input: string, content: LessonContent): string {
  const lower = input.toLowerCase();
  const confused = ['don\'t understand', 'confused', 'hard', 'help', 'not sure', 'what', 'how', 'why'].some((w) => lower.includes(w));
  if (lower.includes('thank') || lower.includes('great') || lower.includes('ok')) {
    return 'You are doing great! Keep going. Do not hesitate to ask if anything is unclear.';
  }
  if (confused) {
    return `No worries at all! Let me try a different approach. ${content.examples[0]?.problem ? 'Think about it like this: ' + content.examples[0].problem : 'Take it one step at a time and we will get there together.'}`;
  }
  return 'Good effort! The key is to work through it step by step. Follow the method shown on the whiteboard.';
}
