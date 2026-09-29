'use client';

import { useEffect, useRef, useState, forwardRef, useImperativeHandle } from 'react';
import { LiveAvatarSession, AgentEventsEnum } from '@heygen/liveavatar-web-sdk';
import { supabase } from '@/lib/supabase-client';
import { TeacherAvatar, TeacherAvatarState } from './TeacherAvatar';
import { Loader as Loader2 } from 'lucide-react';

export interface LiveTeacherAvatarHandle {
  speak: (text: string) => void;
  interrupt: () => void;
}

interface LiveTeacherAvatarProps {
  subjectId?: string;
  grade?: number;
  teacherName: string;
  enabled: boolean;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  className?: string;
  onSpeakingChange?: (speaking: boolean) => void;
  onConnectionChange?: (connected: boolean) => void;
}

const SIZE_PX: Record<NonNullable<LiveTeacherAvatarProps['size']>, number> = { xs: 28, sm: 48, md: 64, lg: 112 };

export const LiveTeacherAvatar = forwardRef<LiveTeacherAvatarHandle, LiveTeacherAvatarProps>(
  function LiveTeacherAvatar({ subjectId, grade, teacherName, enabled, size = 'md', className = '', onSpeakingChange, onConnectionChange }, ref) {
    const videoRef = useRef<HTMLVideoElement>(null);
    const sessionRef = useRef<LiveAvatarSession | null>(null);
    const [connectionState, setConnectionState] = useState<'idle' | 'connecting' | 'connected' | 'unavailable'>('idle');
    const [fallbackState, setFallbackState] = useState<TeacherAvatarState>('idle');

    useEffect(() => {
      if (!enabled || !subjectId || !grade) { setConnectionState('idle'); return; }
      let cancelled = false;
      setConnectionState('connecting');
      (async () => {
        try {
          const { data: { session: authSession } } = await supabase.auth.getSession();
          if (!authSession) { setConnectionState('unavailable'); return; }
          const response = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL!}/functions/v1/liveavatar-token`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authSession.access_token}` },
            body: JSON.stringify({ subjectId, grade, teacherName }),
          });
          if (!response.ok) { setConnectionState('unavailable'); return; }
          const data: unknown = await response.json();
          if (
            cancelled ||
            !data ||
            typeof data !== 'object' ||
            (data as { available?: unknown }).available !== true ||
            typeof (data as { token?: unknown }).token !== 'string' ||
            !(data as { token: string }).token.trim()
          ) {
            setConnectionState('unavailable');
            return;
          }
          const session = new LiveAvatarSession((data as { token: string }).token);
          sessionRef.current = session;
          session.on(AgentEventsEnum.AVATAR_SPEAK_STARTED, () => { setFallbackState('speaking'); onSpeakingChange?.(true); });
          session.on(AgentEventsEnum.AVATAR_SPEAK_ENDED, () => { setFallbackState('idle'); onSpeakingChange?.(false); });
          await session.start();
          if (cancelled) { await session.stop(); return; }
          if (videoRef.current) session.attach(videoRef.current);
          setConnectionState('connected');
        } catch (error) {
          console.error('LiveAvatar unavailable; using illustrated avatar:', error);
          if (!cancelled) setConnectionState('unavailable');
        }
      })();
      return () => { cancelled = true; sessionRef.current?.stop().catch(() => {}); sessionRef.current = null; };
      // The session is intentionally recreated only when the avatar inputs change.
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [enabled, subjectId, grade, teacherName]);

    useEffect(() => { onConnectionChange?.(connectionState === 'connected'); }, [connectionState, onConnectionChange]);

    useImperativeHandle(ref, () => ({
      speak: (text) => { if (connectionState === 'connected') sessionRef.current?.message(text); },
      interrupt: () => { sessionRef.current?.interrupt(); },
    }), [connectionState]);

    if (connectionState !== 'connected') return (
      <div className={`relative ${className}`}>
        <TeacherAvatar state={fallbackState} size={size} name={teacherName} />
        {connectionState === 'connecting' && <span className="absolute -bottom-0.5 -right-0.5 bg-board-deep rounded-full p-0.5"><Loader2 className="h-3 w-3 animate-spin text-gold" /></span>}
      </div>
    );

    const px = SIZE_PX[size];
    return <div className={`relative shrink-0 rounded-full border-2 border-chalk/20 overflow-hidden bg-board-deep ${className}`} style={{ width: px, height: px }}><video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover" /></div>;
  }
);
