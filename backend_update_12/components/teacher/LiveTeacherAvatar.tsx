'use client';

import { useEffect, useRef, useState, forwardRef, useImperativeHandle } from 'react';
import { LiveAvatarSession, AgentEventsEnum } from '@heygen/liveavatar-web-sdk';
import { supabase } from '@/lib/supabase-client';
import { TeacherAvatar, TeacherAvatarState } from './TeacherAvatar';
import { Loader as Loader2 } from 'lucide-react';

/**
 * Real-time streaming video avatar via LiveAvatar (HeyGen's LITE mode —
 * LiveAvatar handles only WebRTC video/lip-sync; SmartClass's own AI
 * stack, ai-teacher-chat, still decides what the teacher actually says).
 *
 * This component is a drop-in visual upgrade over the illustrated
 * TeacherAvatar, not a replacement for it: whenever a live session isn't
 * available — no liveavatar_avatar_id configured for this persona yet,
 * LIVEAVATAR_API_KEY unset, a connection failure, or simply while the
 * session is still connecting — it renders the exact same illustrated
 * SVG avatar instead. A pupil should never see a broken video element or
 * a blank space where their teacher should be.
 *
 * Usage: call `speak(text)` via the ref whenever the AI teacher's
 * response arrives (in place of, or alongside, the existing browser TTS
 * call), and `interrupt()` when the pupil sends a new message while the
 * avatar is still talking.
 */

export interface LiveTeacherAvatarHandle {
  speak: (text: string) => void;
  interrupt: () => void;
}

interface LiveTeacherAvatarProps {
  subjectId?: string;
  grade?: number;
  teacherName: string;
  /** Falls back to the illustrated avatar entirely when false — e.g. the
   *  pupil's "Text explanation" mode, where no video/voice should render. */
  enabled: boolean;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  className?: string;
  onSpeakingChange?: (speaking: boolean) => void;
  onConnectionChange?: (connected: boolean) => void;
}

const SIZE_PX: Record<NonNullable<LiveTeacherAvatarProps['size']>, number> = {
  xs: 28, sm: 48, md: 64, lg: 112,
};

export const LiveTeacherAvatar = forwardRef<LiveTeacherAvatarHandle, LiveTeacherAvatarProps>(
  function LiveTeacherAvatar({ subjectId, grade, teacherName, enabled, size = 'md', className = '', onSpeakingChange, onConnectionChange }, ref) {
    const videoRef = useRef<HTMLVideoElement>(null);
    const sessionRef = useRef<LiveAvatarSession | null>(null);
    const [connectionState, setConnectionState] = useState<'idle' | 'connecting' | 'connected' | 'unavailable'>('idle');
    const [fallbackState, setFallbackState] = useState<TeacherAvatarState>('idle');

    useEffect(() => {
      if (!enabled || !subjectId || !grade) {
        setConnectionState('idle');
        return;
      }

      let cancelled = false;
      setConnectionState('connecting');

      (async () => {
        try {
          const { data: { session: authSession } } = await supabase.auth.getSession();
          if (!authSession) { setConnectionState('unavailable'); return; }

          const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
          const res = await fetch(`${supabaseUrl}/functions/v1/liveavatar-token`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authSession.access_token}` },
            body: JSON.stringify({ subjectId, grade }),
          });
          const data = await res.json();
          if (cancelled) return;

          if (!data.available || !data.token) {
            setConnectionState('unavailable');
            return;
          }

          const session = new LiveAvatarSession(data.token);
          sessionRef.current = session;

          session.on(AgentEventsEnum.AVATAR_SPEAK_STARTED, () => {
            setFallbackState('speaking');
            onSpeakingChange?.(true);
          });
          session.on(AgentEventsEnum.AVATAR_SPEAK_ENDED, () => {
            setFallbackState('idle');
            onSpeakingChange?.(false);
          });

          await session.start();
          if (cancelled) { await session.stop(); return; }

          if (videoRef.current) session.attach(videoRef.current);
          setConnectionState('connected');
        } catch (e) {
          console.error('LiveAvatar session failed to start (falling back to illustrated avatar):', e);
          if (!cancelled) setConnectionState('unavailable');
        }
      })();

      return () => {
        cancelled = true;
        sessionRef.current?.stop().catch(() => {});
        sessionRef.current = null;
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [enabled, subjectId, grade]);

    useEffect(() => {
      onConnectionChange?.(connectionState === 'connected');
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [connectionState]);

    useImperativeHandle(ref, () => ({
      speak: (text: string) => {
        if (connectionState === 'connected' && sessionRef.current) {
          sessionRef.current.message(text);
        }
        // When not connected, the caller's own browser-TTS fallback path
        // (already in the lesson page) handles speaking instead — this
        // component doesn't need to know about that, it just does
        // nothing when there's no live session to speak through.
      },
      interrupt: () => {
        sessionRef.current?.interrupt();
      },
    }), [connectionState]);

    if (connectionState !== 'connected') {
      // Covers idle / connecting / unavailable — always a safe, familiar
      // visual rather than a loading spinner over empty space or, worse,
      // a broken <video> element with nothing streaming to it.
      return (
        <div className={`relative ${className}`}>
          <TeacherAvatar state={fallbackState} size={size} name={teacherName} />
          {connectionState === 'connecting' && (
            <span className="absolute -bottom-0.5 -right-0.5 bg-board-deep rounded-full p-0.5">
              <Loader2 className="h-3 w-3 animate-spin text-gold" />
            </span>
          )}
        </div>
      );
    }

    const px = SIZE_PX[size];
    return (
      <div
        className={`relative shrink-0 rounded-full border-2 border-chalk/20 overflow-hidden bg-board-deep ${className}`}
        style={{ width: px, height: px }}
      >
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted={false}
          className="w-full h-full object-cover"
        />
      </div>
    );
  }
);
