'use client';

import { useState, FormEvent, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase-client';
import { Loader as Loader2, CircleCheck as CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import { Wordmark } from '@/components/brand/Logo';

/**
 * One shared landing page for the link in the reset email, used by both
 * pupil and admin accounts — it's the same underlying Supabase Auth flow
 * either way, and this page doesn't need to know or care which kind of
 * account it is; it just sets a new password for whoever clicked the link.
 *
 * Supabase's client SDK automatically parses the recovery token out of the
 * URL on load (detectSessionInUrl, on by default) and fires a
 * PASSWORD_RECOVERY auth event once it's done — this page waits for that
 * event rather than assuming the link is already valid the instant the
 * page renders, since parsing happens asynchronously.
 */
export default function ResetPasswordPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [invalid, setInvalid] = useState(false);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    const { data: listener } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') setReady(true);
    });
    // If no PASSWORD_RECOVERY event has fired after a few seconds, the
    // link was likely already used, expired, or malformed — tell the
    // pupil/admin plainly rather than leaving a form that will just fail.
    const timeout = setTimeout(() => {
      setReady((current) => {
        if (!current) setInvalid(true);
        return current;
      });
    }, 4000);
    return () => {
      listener.subscription.unsubscribe();
      clearTimeout(timeout);
    };
  }, []);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!password || password.length < 6) {
      toast.error('Password must be at least 6 characters.');
      return;
    }
    if (password !== confirm) {
      toast.error("Passwords don't match.");
      return;
    }
    setSubmitting(true);
    const { error } = await supabase.auth.updateUser({ password });
    setSubmitting(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setDone(true);
    // Sign out and send back to a normal login rather than leaving the
    // temporary recovery session active indefinitely — simplest, safest
    // way to hand back to the pupil/admin's usual sign-in flow.
    await supabase.auth.signOut();
    setTimeout(() => router.push('/login'), 2000);
  };

  return (
    <div className="relative min-h-screen bg-board text-chalk flex flex-col items-center justify-center px-4 py-12">
      <div className="chalk-noise" />
      <div className="dust" style={{ top: '20%', left: '85%', width: 4, height: 4 }} />
      <div className="dust" style={{ top: '70%', left: '8%', width: 5, height: 5, animationDelay: '4s' }} />

      <div className="relative z-10 w-full max-w-xs">
        <div className="text-center mb-6">
          <Wordmark size="lg" className="justify-center" />
          <svg className="mx-auto mt-2" width="160" height="12" viewBox="0 0 160 12">
            <path d="M2 9 Q 40 -1, 80 7 T 158 5" fill="none" stroke="hsl(41 76% 60%)" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </div>

        <div className="card-paper auth-panel" style={{ transform: 'rotate(0.4deg)' }}>
          {done ? (
            <div className="text-center py-2">
              <CheckCircle2 className="h-10 w-10 text-teal mx-auto mb-3" />
              <h2 className="font-display text-xl font-semibold text-ink mb-1">Password updated</h2>
              <p className="text-sm text-ink/60">Taking you to log in with your new password...</p>
            </div>
          ) : invalid ? (
            <div className="text-center py-2">
              <h2 className="font-display text-xl font-semibold text-ink mb-1">This link isn&apos;t valid</h2>
              <p className="text-sm text-ink/60 mb-4">
                It may have already been used or expired. Reset links are only valid for a limited time.
              </p>
              <Link href="/forgot-password" className="font-semibold text-rust hover:underline text-sm">
                Request a new link
              </Link>
            </div>
          ) : !ready ? (
            <div className="flex flex-col items-center py-6 gap-3">
              <Loader2 className="h-6 w-6 animate-spin text-gold" />
              <p className="text-sm text-ink/60">Verifying your reset link...</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit}>
              <h2 className="font-display text-2xl font-semibold text-ink mb-1">Set a new password</h2>
              <p className="text-sm text-ink/60 mb-6">Choose a new password for your account.</p>

              <label className="block text-xs uppercase tracking-widest text-ink/50 font-semibold mb-1.5">
                New password
              </label>
              <input
                type="password"
                placeholder="At least 6 characters"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={submitting}
                className="w-full px-3 py-2.5 rounded-lg border-2 border-ink bg-chalk text-ink font-sans text-sm focus:outline-none focus:ring-2 focus:ring-gold mb-4"
              />

              <label className="block text-xs uppercase tracking-widest text-ink/50 font-semibold mb-1.5">
                Confirm new password
              </label>
              <input
                type="password"
                placeholder="Type it again"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                disabled={submitting}
                className="w-full px-3 py-2.5 rounded-lg border-2 border-ink bg-chalk text-ink font-sans text-sm focus:outline-none focus:ring-2 focus:ring-gold"
              />

              <button
                type="submit"
                disabled={submitting}
                className="btn-gold w-full mt-6 py-3 flex items-center justify-center gap-2"
              >
                {submitting ? (
                  <><Loader2 className="h-4 w-4 animate-spin" /> Updating...</>
                ) : (
                  'Update password →'
                )}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
