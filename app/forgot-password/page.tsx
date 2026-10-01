'use client';

import { useState, FormEvent } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase-client';
import { ArrowLeft, Loader as Loader2, MailCheck } from 'lucide-react';
import { toast } from 'sonner';
import { Wordmark } from '@/components/brand/Logo';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!email) {
      toast.error('Please enter your email.');
      return;
    }
    setSubmitting(true);
    // Supabase sends the actual reset email itself — no custom email
    // server needed. redirectTo must be an allowed Redirect URL in the
    // Supabase Auth settings (Authentication -> URL Configuration) or the
    // link in the email won't work.
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setSubmitting(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    // Always show the same success state regardless of whether the email
    // actually exists — confirming or denying an account's existence to
    // an anonymous requester is its own small information leak.
    setSent(true);
  };

  return (
    <div className="relative min-h-screen bg-board text-chalk flex flex-col items-center justify-center px-4 py-12">
      <div className="chalk-noise" />
      <div className="dust" style={{ top: '20%', left: '85%', width: 4, height: 4 }} />
      <div className="dust" style={{ top: '70%', left: '8%', width: 5, height: 5, animationDelay: '4s' }} />

      <div className="relative z-10 w-full max-w-xs">
        <Link href="/login" className="flex items-center gap-2 text-sm text-muted-board hover:text-chalk mb-6 justify-center transition-colors">
          <ArrowLeft className="h-4 w-4" /> Back to log in
        </Link>

        <div className="text-center mb-6">
          <Wordmark size="lg" className="justify-center" />
          <svg className="mx-auto mt-2" width="160" height="12" viewBox="0 0 160 12">
            <path d="M2 9 Q 40 -1, 80 7 T 158 5" fill="none" stroke="hsl(41 76% 60%)" strokeWidth="2" strokeLinecap="round" />
          </svg>
          <p className="font-hand text-lg text-muted-board mt-2">Let&apos;s get you back in.</p>
        </div>

        <div className="card-paper auth-panel" style={{ transform: 'rotate(-0.4deg)' }}>
          {sent ? (
            <div className="text-center py-2">
              <MailCheck className="h-10 w-10 text-teal mx-auto mb-3" />
              <h2 className="font-display text-xl font-semibold text-ink mb-1">Check your email</h2>
              <p className="text-sm text-ink/60">
                If an account exists for <strong>{email}</strong>, a password reset link is on its way. It'll take
                you to a page where you can set a new password.
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit}>
              <h2 className="font-display text-2xl font-semibold text-ink mb-1">Reset your password</h2>
              <p className="text-sm text-ink/60 mb-6">
                Enter the email on your account and we&apos;ll send you a link to set a new password.
              </p>

              <label className="block text-xs uppercase tracking-widest text-ink/50 font-semibold mb-1.5">
                Email
              </label>
              <input
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={submitting}
                className="w-full px-3 py-2.5 rounded-lg border-2 border-ink bg-chalk text-ink font-sans text-sm focus:outline-none focus:ring-2 focus:ring-gold"
              />

              <button
                type="submit"
                disabled={submitting}
                className="btn-gold w-full mt-6 py-3 flex items-center justify-center gap-2"
              >
                {submitting ? (
                  <><Loader2 className="h-4 w-4 animate-spin" /> Sending...</>
                ) : (
                  'Send reset link →'
                )}
              </button>
            </form>
          )}

          <p className="text-center text-sm text-ink/60 mt-4">
            Remembered it? <Link href="/login" className="font-semibold text-rust hover:underline">Log in</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
