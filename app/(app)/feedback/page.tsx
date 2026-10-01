'use client';

import { FormEvent, useEffect, useRef, useState } from 'react';
import { Mic, MessageSquare, Send, Loader as Loader2, Square, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/components/auth-provider';
import { supabase } from '@/lib/supabase-client';
import { useSpeechToText } from '@/hooks/use-speech-to-text';
import { createClientId } from '@/lib/client-id';

const CATEGORIES = [
  { value: 'suggestion', label: 'Suggestion' },
  { value: 'complaint', label: 'Complaint' },
  { value: 'system_performance', label: 'System performance' },
  { value: 'other', label: 'Other concern' },
] as const;

export default function FeedbackPage() {
  const { user } = useAuth();
  const [category, setCategory] = useState<(typeof CATEGORIES)[number]['value']>('suggestion');
  const [message, setMessage] = useState('');
  const [contactAllowed, setContactAllowed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [voiceMessage, setVoiceMessage] = useState('');
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [isRecording, setIsRecording] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const { isSupported, isListening, interimTranscript, error: speechError, toggleListening, stopListening } = useSpeechToText({
    lang: 'en-US',
    onResult: (transcript) => {
      setVoiceMessage((current) => `${current}${current ? ' ' : ''}${transcript}`);
    },
  });

  const combinedMessage = `${message}${message && voiceMessage ? ' ' : ''}${voiceMessage}`;

  useEffect(() => () => {
    if (audioUrl) URL.revokeObjectURL(audioUrl);
  }, [audioUrl]);

  function discardRecording() {
    stopListening();
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    mediaRecorderRef.current = null;
    audioChunksRef.current = [];
    setIsRecording(false);
    setAudioBlob(null);
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    setAudioUrl(null);
    toast.success('Recording deleted.');
  }

  async function toggleVoiceRecording() {
    if (isRecording) {
      stopListening();
      mediaRecorderRef.current?.stop();
      setIsRecording(false);
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      audioChunksRef.current = [];
      setAudioBlob(null);
      if (audioUrl) URL.revokeObjectURL(audioUrl);
      setAudioUrl(null);
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) audioChunksRef.current.push(event.data);
      };
      recorder.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { type: recorder.mimeType || 'audio/webm' });
        setAudioBlob(blob);
        setAudioUrl(URL.createObjectURL(blob));
        setIsRecording(false);
        stream.getTracks().forEach((track) => track.stop());
      };
      mediaRecorderRef.current = recorder;
      recorder.start();
      setIsRecording(true);
      toggleListening();
    } catch (error) {
      toast.error(error instanceof DOMException && error.name === 'NotAllowedError'
        ? 'Microphone access was blocked. Allow microphone access and try again.'
        : 'We could not start the recording. You can type your feedback instead.');
    }
  }

  useEffect(() => {
    if (!isRecording) {
      setRecordingSeconds(0);
      return;
    }

    const startedAt = Date.now();
    const timer = window.setInterval(() => {
      setRecordingSeconds(Math.floor((Date.now() - startedAt) / 1000));
    }, 1000);

    return () => window.clearInterval(timer);
  }, [isRecording]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isRecording) {
      toast.error('Stop recording first so we can capture the complete message.');
      stopListening();
      mediaRecorderRef.current?.stop();
      setIsRecording(false);
      return;
    }
    let trimmedMessage = combinedMessage.trim();

    if (!trimmedMessage && !audioBlob) {
      toast.error('Please tell us what you would like us to know.');
      return;
    }
    if (!user) {
      toast.error('Please sign in before sending feedback.');
      return;
    }

    setSubmitting(true);
    let audioPath: string | null = null;
    let transcriptionFailure: string | null = null;
    if (audioBlob) {
      audioPath = `${user.id}/${createClientId()}.webm`;
      const { error: audioError } = await supabase.storage.from('feedback-recordings').upload(audioPath, audioBlob, {
        contentType: audioBlob.type || 'audio/webm',
        upsert: false,
      });
      if (audioError) {
        setSubmitting(false);
        toast.error(`The recording could not be uploaded: ${audioError.message}`);
        return;
      }

      if (!trimmedMessage || trimmedMessage.length < 10) {
        try {
          const { data: transcription, error: transcriptionError } = await supabase.functions.invoke('transcribe-feedback', {
            body: { audioPath },
          });
          if (!transcriptionError && typeof transcription?.text === 'string') {
            trimmedMessage = transcription.text.trim();
          } else {
            transcriptionFailure = transcription?.error || transcriptionError?.message || 'The transcription service is unavailable.';
          }
        } catch (error) {
          console.error('Feedback transcription request failed:', error);
          transcriptionFailure = error instanceof Error ? error.message : 'The transcription service is unavailable.';
        }
      }
    }

    if (!trimmedMessage) {
      if (audioPath) await supabase.storage.from('feedback-recordings').remove([audioPath]);
      setSubmitting(false);
      const functionUnavailable = transcriptionFailure?.toLowerCase().includes('edge function') || transcriptionFailure?.toLowerCase().includes('failed to send');
      toast.error(functionUnavailable
        ? 'Voice transcription is not deployed yet. Please deploy transcribe-feedback, or type your feedback instead.'
        : `We could not convert the recording into text: ${transcriptionFailure || 'No speech was detected.'} Please try recording again or type your feedback.`, { duration: 8000 });
      return;
    }
    if (trimmedMessage.length < 10) {
      if (audioPath) await supabase.storage.from('feedback-recordings').remove([audioPath]);
      setSubmitting(false);
      toast.error('Please provide a little more detail.');
      return;
    }
    if (trimmedMessage.length > 2000) {
      if (audioPath) await supabase.storage.from('feedback-recordings').remove([audioPath]);
      setSubmitting(false);
      toast.error('Please keep your feedback under 2,000 characters.');
      return;
    }
    const { error } = await supabase.from('user_feedback').insert({
      user_id: user.id,
      category,
      message: trimmedMessage,
      contact_allowed: contactAllowed,
      audio_path: audioPath,
    });
    setSubmitting(false);

    if (error) {
      if (audioPath) {
        await supabase.storage.from('feedback-recordings').remove([audioPath]);
      }
      console.error('Feedback submission failed:', error);
      const message = error.code === '42P01'
        ? 'Feedback is not ready yet. Please ask the administrator to apply the latest database migration.'
        : `We could not send your feedback: ${error.message}`;
      toast.error(message, { duration: 7000 });
      return;
    }

    setMessage('');
    setVoiceMessage('');
    setAudioBlob(null);
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    setAudioUrl(null);
    setContactAllowed(false);
    setSubmitted(true);
    toast.success('Thank you. Your feedback has been sent.');
  }

  return (
    <div className="max-w-2xl space-y-6 animate-fade-in">
      <div>
        <div className="flex items-center gap-2 mb-2">
          <MessageSquare className="h-5 w-5 text-gold" />
          <p className="text-xs uppercase tracking-widest text-gold font-semibold">Your voice matters</p>
        </div>
        <h1 className="font-display text-2xl font-semibold text-chalk mb-2">Share feedback</h1>
        <p className="text-sm text-muted-board">
          Tell us about a problem, suggest an improvement, or report how the system is performing for you.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="card-board p-5 sm:p-6 space-y-5">
        <div>
          <label htmlFor="feedback-category" className="block text-xs uppercase tracking-widest text-muted-board font-semibold mb-1.5">
            What would you like to share?
          </label>
          <select
            id="feedback-category"
            value={category}
            onChange={(event) => setCategory(event.target.value as typeof category)}
            disabled={submitting}
            className="w-full px-3 py-2.5 rounded-lg border border-white/15 bg-white/5 text-chalk font-sans text-sm focus:outline-none focus:ring-1 focus:ring-gold"
          >
            {CATEGORIES.map((option) => <option key={option.value} value={option.value} className="bg-board-deep">{option.label}</option>)}
          </select>
        </div>

        <div>
          <label htmlFor="feedback-message" className="block text-xs uppercase tracking-widest text-muted-board font-semibold mb-1.5">
            Your message
          </label>
          <textarea
            id="feedback-message"
            value={combinedMessage}
            onChange={(event) => {
              setMessage(event.target.value);
              setVoiceMessage('');
            }}
            disabled={submitting}
            maxLength={2000}
            rows={7}
            placeholder="What happened, and how could we improve it?"
            className="w-full resize-y px-3 py-2.5 rounded-lg border border-white/15 bg-white/5 text-chalk placeholder:text-muted-board font-sans text-sm focus:outline-none focus:ring-1 focus:ring-gold"
          />
          <div className="flex items-center justify-between gap-3 mt-2">
            <div className="min-h-8">
              {isSupported && (
                <button
                  type="button"
                  onClick={toggleVoiceRecording}
                  disabled={submitting}
                  className={`flex items-center gap-2 rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors ${isRecording ? 'border-rust/60 text-rust bg-rust/10' : 'border-gold/40 text-gold hover:bg-gold/10'}`}
                  title={isRecording ? 'Stop recording and keep the transcript' : 'Record your feedback'}
                >
                  {isRecording ? <Square className="h-3.5 w-3.5" /> : <Mic className="h-3.5 w-3.5" />}
                  {isRecording ? `Stop & keep text (${formatRecordingTime(recordingSeconds)})` : 'Record voice'}
                </button>
              )}
              {isListening && interimTranscript && <p className="text-xs text-muted-board mt-1 italic">Hearing: {interimTranscript}</p>}
              {speechError && <p className="text-xs text-gold mt-1">Speech-to-text paused. The audio recording is still available below.</p>}
              {!isSupported && <p className="text-xs text-muted-board">Voice input is unavailable in this browser. You can type your feedback instead.</p>}
            </div>
            <p className="text-xs text-muted-board text-right shrink-0">{combinedMessage.length}/2000</p>
          </div>
          {audioUrl && (
            <div className="mt-3 rounded-lg border border-teal/30 bg-teal/5 p-3">
              <div className="flex items-center justify-between gap-3 mb-2">
                <p className="text-xs text-teal font-semibold">Recording preview</p>
                <button
                  type="button"
                  onClick={discardRecording}
                  disabled={submitting}
                  className="flex items-center gap-1.5 text-xs font-semibold text-rust transition-colors hover:text-rust/80 disabled:cursor-not-allowed disabled:opacity-50"
                  title="Delete this recording"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Delete recording
                </button>
              </div>
              <audio controls src={audioUrl} className="w-full h-9" />
            </div>
          )}
        </div>

        <label className="flex items-start gap-3 text-sm text-muted-board cursor-pointer">
          <input
            type="checkbox"
            checked={contactAllowed}
            onChange={(event) => setContactAllowed(event.target.checked)}
            disabled={submitting}
            className="mt-0.5 accent-[hsl(41_76%_60%)]"
          />
          <span>You may contact me about this feedback.</span>
        </label>

        <button type="submit" disabled={submitting} className="btn-gold px-5 py-2.5 flex items-center gap-2">
          {submitting ? <><Loader2 className="h-4 w-4 animate-spin" /> Sending...</> : <><Send className="h-4 w-4" /> Send feedback</>}
        </button>
      </form>

      {submitted && (
        <div className="border border-gold/40 bg-gold/10 rounded-lg px-4 py-3 text-sm text-chalk">
          Your message is with the SmartClass team. Thanks for helping us improve the learning experience.
        </div>
      )}
    </div>
  );
}

function formatRecordingTime(seconds: number) {
  const minutes = Math.floor(seconds / 60).toString().padStart(2, '0');
  const remainingSeconds = (seconds % 60).toString().padStart(2, '0');
  return `${minutes}:${remainingSeconds}`;
}