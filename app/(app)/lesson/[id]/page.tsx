'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase, Lesson, Topic, LessonSession, LessonContent } from '@/lib/supabase-client';
import { useAuth } from '@/components/auth-provider';
import {
  ArrowLeft,
  Send,
  Volume2,
  VolumeX,
  Circle as RecordIcon,
  Square,
  Download,
  PenTool,
  Mic,
  MicOff,
  CircleCheck as CheckCircle2,
  Loader as Loader2,
  ChevronRight,
  ChevronLeft,
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
  const [checkpointPending, setCheckpointPending] = useState(false);
  const [isRecordingLesson, setIsRecordingLesson] = useState(false);
  const [recordingUrl, setRecordingUrl] = useState<string | null>(null);
  const [weakAreaReason, setWeakAreaReason] = useState<string | null>(null);
  const [teacherName, setTeacherName] = useState('Mr. Chomba');
  const [liveAvatarConnected, setLiveAvatarConnected] = useState(false);
  const chatRef = useRef<HTMLDivElement>(null);
  const boardRef = useRef<HTMLDivElement>(null);
  const liveAvatarRef = useRef<LiveTeacherAvatarHandle>(null);
  const speechPauseRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lessonRecorderRef = useRef<MediaRecorder | null>(null);
  const recordingStreamsRef = useRef<MediaStream[]>([]);
  const recordingChunksRef = useRef<Blob[]>([]);

  useEffect(() => () => {
    lessonRecorderRef.current?.stop();
    recordingStreamsRef.current.forEach((stream) => stream.getTracks().forEach((track) => track.stop()));
    if (recordingUrl) URL.revokeObjectURL(recordingUrl);
  }, [recordingUrl]);

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
    if (!ld.topic?.source_material_id) { toast.error('This lesson is not part of an uploaded syllabus.'); router.push('/dashboard'); return; }
    setLesson(ld);
    setTopic(ld.topic);
    setContent(ld.content as LessonContent);
    if (sd.status === 'completed') { setCompleted(true); setPhase('complete'); }
    if (sd.transcript?.length) {
      setChatMessages(sd.transcript as ChatMessage[]);
    } else {
      const firstName = profile?.full_name.split(' ')[0] || 'there';
      const msg: ChatMessage = {
        role: 'teacher',
        content: `Hello ${firstName}! Welcome to today's lesson on ${ld.title}. Let us get started!`,
        timestamp: Date.now(),
      };
      setChatMessages([msg]);
      speak(msg.content);
    }
    setLoading(false);
  };

  const speak = (text: string) => {
    if (mode !== 'video' || !voiceEnabled) return;
    if (liveAvatarConnected) {
      liveAvatarRef.current?.speak(text);
      return;
    }
    if (typeof window === 'undefined' || !window.speechSynthesis) return;
    if (speechPauseRef.current) clearTimeout(speechPauseRef.current);
    window.speechSynthesis.cancel();
    const parts = text.split(/\n\s*\n/).map((part) => part.trim()).filter(Boolean);
    let partIndex = 0;
    const speakNextPart = () => {
      if (partIndex >= parts.length) {
        setIsSpeaking(false);
        return;
      }
      const utterance = new SpeechSynthesisUtterance(parts[partIndex++]);
      utterance.rate = 0.95;
      utterance.onstart = () => setIsSpeaking(true);
      utterance.onend = () => {
        speechPauseRef.current = setTimeout(speakNextPart, 650);
      };
      utterance.onerror = () => setIsSpeaking(false);
      window.speechSynthesis.speak(utterance);
    };
    speakNextPart();
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
  // front (Madam Moonga, Mrs Tembo, Mr Chomba, Mr Banda, or Chipo — see
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

  const toggleLessonRecording = async () => {
    if (isRecordingLesson) {
      lessonRecorderRef.current?.stop();
      return;
    }

    if (!navigator.mediaDevices?.getDisplayMedia || !window.MediaRecorder) {
      toast.error('Lesson recording is not supported in this browser.');
      return;
    }

    try {
      const sharedTab = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
      const microphone = await navigator.mediaDevices.getUserMedia({ audio: true });
      const audioContext = new AudioContext();
      const destination = audioContext.createMediaStreamDestination();
      audioContext.createMediaStreamSource(sharedTab).connect(destination);
      audioContext.createMediaStreamSource(microphone).connect(destination);
      const recorder = new MediaRecorder(destination.stream, { mimeType: 'audio/webm' });

      recordingChunksRef.current = [];
      recordingStreamsRef.current = [sharedTab, microphone, destination.stream];
      if (recordingUrl) URL.revokeObjectURL(recordingUrl);
      setRecordingUrl(null);
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) recordingChunksRef.current.push(event.data);
      };
      recorder.onstop = () => {
        const blob = new Blob(recordingChunksRef.current, { type: 'audio/webm' });
        setRecordingUrl(URL.createObjectURL(blob));
        setIsRecordingLesson(false);
        recordingStreamsRef.current.forEach((stream) => stream.getTracks().forEach((track) => track.stop()));
        void audioContext.close();
      };
      sharedTab.getVideoTracks()[0]?.addEventListener('ended', () => {
        if (recorder.state !== 'inactive') recorder.stop();
      });
      lessonRecorderRef.current = recorder;
      recorder.start();
      setIsRecordingLesson(true);
      toast.success('Recording started. Share this lesson tab with audio.');
    } catch {
      toast.error('Recording needs permission to share the lesson tab and microphone.');
    }
  };

  const saveTranscript = (msgs: ChatMessage[]) => {
    supabase.from('lesson_sessions').update({ transcript: msgs }).eq('id', sessionId);
  };

  const addTeacher = useCallback((text: string) => {
    const msg: ChatMessage = { role: 'teacher', content: text, timestamp: Date.now() };
    setChatMessages((prev) => { const u = [...prev, msg]; saveTranscript(u); return u; });
    speak(text);
  }, [voiceEnabled, sessionId, mode]);

  const addToBoard = (item: BoardItem) => {
    setWriting(true);
    setTimeout(() => {
      setBoardItems((prev) => [...prev, item]);
      setWriting(false);
    }, 400);
  };

  const handleSend = async () => {
    if (!pupilInput.trim() || !content) return;
    liveAvatarRef.current?.interrupt();
    setCheckpointPending(false);
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
    if (checkpointPending) {
      toast.info('Answer the teacher\'s check-in before we continue.');
      return;
    }
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
    setCheckpointPending(true);
    setTimeout(() => {
      addTeacher(`Before we continue, can you explain in your own words what ${s.title} means?`);
    }, 900);
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
          <button
            onClick={toggleLessonRecording}
            title={isRecordingLesson ? 'Stop lesson recording' : 'Record lesson'}
            className={`flex items-center gap-1.5 text-xs border rounded-lg px-2.5 py-1.5 transition-colors ${
              isRecordingLesson ? 'border-rust/60 text-rust bg-rust/10' : 'border-chalk/20 text-muted-board hover:text-chalk'
            }`}
          >
            {isRecordingLesson ? <><Square className="h-3.5 w-3.5" /> Stop</> : <><RecordIcon className="h-3.5 w-3.5 fill-current" /> Record</>}
          </button>
          {recordingUrl && (
            <a
              href={recordingUrl}
              download={`smartclass-${lesson?.title || 'lesson'}.webm`}
              title="Download lesson recording"
              className="flex items-center gap-1.5 text-xs border border-teal/40 text-teal rounded-lg px-2.5 py-1.5 hover:bg-teal/10 transition-colors"
            >
              <Download className="h-3.5 w-3.5" /> Save
            </a>
          )}
        </div>
      </div>

      <h1 className="font-display text-xl font-semibold text-chalk">{lesson.title}</h1>

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
              enabled={mode === 'video' && voiceEnabled}
              onSpeakingChange={setIsSpeaking}
              onConnectionChange={setLiveAvatarConnected}
              size="md"
              teacherName={teacherName}
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
            <div className="flex gap-2">
              <textarea
                value={pupilInput}
                onChange={(e) => setPupilInput(e.target.value)}
                placeholder="Ask a question or answer the teacher..."
                rows={1}
                className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-chalk placeholder:text-muted-board resize-none focus:outline-none focus:ring-1 focus:ring-gold"
                onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
              />
              {sttSupported && (
                <button
                  onClick={toggleListening}
                  title={isListening ? 'Stop listening' : 'Speak your question'}
                  className={`px-3 py-2 rounded-lg border transition-colors ${
                    isListening ? 'bg-rust/20 border-rust text-rust' : 'border-white/10 text-muted-board hover:text-chalk'
                  }`}
                >
                  {isListening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                </button>
              )}
              <button
                onClick={handleSend}
                disabled={!pupilInput.trim() || isThinking}
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
            {checkpointPending
              ? <>Answer check-in <ChevronRight className="h-4 w-4" /></>
              : phase === 'summary'
                ? <><CheckCircle2 className="h-4 w-4" /> Finish</>
                : <>Next <ChevronRight className="h-4 w-4" /></>}
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
