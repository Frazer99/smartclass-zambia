'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Speech-to-text (SRS 12.12) via the browser's native Web Speech API
 * (SpeechRecognition). No external service or API key required — the
 * same "no dedicated infra needed at MVP stage" reasoning that already
 * applies to TTS via SpeechSynthesis elsewhere in the app.
 *
 * Browser support: Chrome/Edge/Safari on desktop and Android support this;
 * Firefox does not. `isSupported` lets callers hide the mic button rather
 * than show a control that silently fails.
 */

interface UseSpeechToTextOptions {
  onResult?: (finalTranscript: string) => void;
  lang?: string;
}

export function useSpeechToText({ onResult, lang = 'en-US' }: UseSpeechToTextOptions = {}) {
  const [isSupported, setIsSupported] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [interimTranscript, setInterimTranscript] = useState('');
  const [error, setError] = useState<string | null>(null);
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    const SpeechRecognitionCtor =
      typeof window !== 'undefined' &&
      ((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition);

    if (!SpeechRecognitionCtor) {
      setIsSupported(false);
      return;
    }
    setIsSupported(true);

    const recognition = new SpeechRecognitionCtor();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = lang;

    recognition.onresult = (event: any) => {
      let interim = '';
      let final = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) final += transcript;
        else interim += transcript;
      }
      setInterimTranscript(interim);
      if (final) {
        setError(null);
        onResult?.(final.trim());
        setInterimTranscript('');
      }
    };

    recognition.onerror = (event: any) => {
      setIsListening(false);
      setInterimTranscript('');
      const messages: Record<string, string> = {
        'not-allowed': 'Microphone access was blocked. Allow microphone access in your browser settings and try again.',
        'audio-capture': 'No microphone was found. Check your microphone and try again.',
        network: 'Speech recognition needs an internet connection. Check your connection and try again.',
      };
      setError(messages[event?.error] || 'Voice input stopped. Please try again or type your question.');
    };

    recognition.onend = () => {
      setIsListening(false);
      setInterimTranscript('');
    };

    recognitionRef.current = recognition;

    return () => {
      recognition.onresult = null;
      recognition.onerror = null;
      recognition.onend = null;
      try {
        recognition.stop();
      } catch {
        // already stopped — fine
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lang]);

  const startListening = useCallback(() => {
    if (!recognitionRef.current || isListening) return;
    try {
      setError(null);
      recognitionRef.current.start();
      setIsListening(true);
    } catch {
      // recognition.start() throws if already started — ignore
    }
  }, [isListening]);

  const stopListening = useCallback(() => {
    if (!recognitionRef.current) return;
    recognitionRef.current.stop();
    setIsListening(false);
  }, []);

  const toggleListening = useCallback(() => {
    if (isListening) stopListening();
    else startListening();
  }, [isListening, startListening, stopListening]);

  return { isSupported, isListening, interimTranscript, error, startListening, stopListening, toggleListening };
}
