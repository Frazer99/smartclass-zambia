'use client';

import { useState, FormEvent, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/components/auth-provider';
import { supabase } from '@/lib/supabase-client';
import { ArrowLeft, Loader as Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Wordmark } from '@/components/brand/Logo';

export default function LoginPage() {
  const { user, profile, loading } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [emailUnconfirmed, setEmailUnconfirmed] = useState(false);
  const [resending, setResending] = useState(false);

  useEffect(() => {
    if (loading || !user || !profile) return;
    if (profile.role === 'admin') router.push('/admin');
    else if (profile.role === 'parent') router.push('/parent');
    else if (profile.role === 'teacher') router.push('/teacher');
    else router.push('/dashboard');
  }, [user, profile, loading, router]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      toast.error('Please enter your email and password.');
      return;
    }
    setSubmitting(true);
    setEmailUnconfirmed(false);
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      if (error.code === 'email_not_confirmed' || error.message.toLowerCase().includes('email not confirmed')) {
        setEmailUnconfirmed(true);
        toast.error('Please confirm your email before logging in.');
      } else {
        toast.error(error.message);
      }
      setSubmitting(false);
      return;
    }

    const { data: role, error: roleError } = await supabase.rpc('current_user_role');
    if (roleError) {
      toast.error(`Could not verify account access: ${roleError.message}`);
      await supabase.auth.signOut();
      setSubmitting(false);
      return;
    }
    if (role === 'admin') {
      toast.error('Admin accounts must sign in through the admin portal.');
      await supabase.auth.signOut();
      setSubmitting(false);
      return;
    }

    if (!data.user) {
      toast.error('Could not complete sign in. Please try again.');
      setSubmitting(false);
      return;
    }
    const { data: profileRow } = await supabase
      .from('profiles')
      .select('role, teacher_approved')
      .eq('id', data.user.id)
      .maybeSingle();
    if (profileRow?.role === 'teacher' && !profileRow.teacher_approved) {
      toast.error("Your teacher account is still pending admin approval.");
      await supabase.auth.signOut();
      setSubmitting(false);
      return;
    }
    if (profileRow?.role === 'parent') router.push('/parent');
    else if (profileRow?.role === 'teacher') router.push('/teacher');
    else router.push('/dashboard');
  };

  const resendConfirmation = async () => {
    if (!email) {
      toast.error('Enter your email address first.');
      return;
    }
    setResending(true);
    const { error } = await supabase.auth.resend({
      type: 'signup',
      email,
      options: { emailRedirectTo: `${window.location.origin}/login` },
    });
    if (error) toast.error(error.message);
    else toast.success('Confirmation email sent. Check your inbox and spam folder.');
    setResending(false);
  };

  return (
    <div className="relative min-h-screen bg-board text-chalk flex flex-col items-center justify-center px-4 py-12">
      <div className="chalk-noise" />
      <div className="dust" style={{ top: '20%', left: '85%', width: 4, height: 4 }} />
      <div className="dust" style={{ top: '70%', left: '8%', width: 5, height: 5, animationDelay: '4s' }} />

      <div className="relative z-10 w-full max-w-xs">
        <Link href="/" className="flex items-center gap-2 text-sm text-muted-board hover:text-chalk mb-6 justify-center transition-colors">
          <ArrowLeft className="h-4 w-4" /> Back to home
        </Link>

        <div className="text-center mb-6">
          <Wordmark size="lg" className="justify-center" />
          <svg className="mx-auto mt-2" width="160" height="12" viewBox="0 0 160 12">
            <path d="M2 9 Q 40 -1, 80 7 T 158 5" fill="none" stroke="hsl(41 76% 60%)" strokeWidth="2" strokeLinecap="round" />
          </svg>
          <p className="font-hand text-lg text-muted-board mt-2">Welcome back.</p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="card-paper auth-panel"
          style={{ transform: 'rotate(0.4deg)' }}
        >
          <h2 className="font-display text-2xl font-semibold text-ink mb-1">Log in</h2>
          <p className="text-sm text-ink/60 mb-4">Continue your learning journey.</p>

          <div className="space-y-3">
            <div>
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
            </div>
            <div>
              <label className="block text-xs uppercase tracking-widest text-ink/50 font-semibold mb-1.5">
                Password
              </label>
              <input
                type="password"
                placeholder="Your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={submitting}
                className="w-full px-3 py-2.5 rounded-lg border-2 border-ink bg-chalk text-ink font-sans text-sm focus:outline-none focus:ring-2 focus:ring-gold"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="btn-gold w-full mt-4 py-2.5 flex items-center justify-center gap-2"
          >
            {submitting ? (
              <><Loader2 className="h-4 w-4 animate-spin" /> Logging in...</>
            ) : (
              'Log In →'
            )}
          </button>

          <div className="text-center mt-3">
            <Link href="/forgot-password" className="text-xs font-semibold text-rust hover:underline">
              Forgot password?
            </Link>
          </div>

          {emailUnconfirmed && (
            <div className="mt-4 rounded-lg border border-gold/40 bg-gold/10 p-3 text-sm text-ink">
              <p>Please click the confirmation link sent to your email before logging in.</p>
              <button
                type="button"
                onClick={resendConfirmation}
                disabled={resending}
                className="mt-2 font-semibold text-rust hover:underline disabled:opacity-50"
              >
                {resending ? 'Sending...' : 'Resend confirmation email'}
              </button>
            </div>
          )}

          <p className="text-center text-sm text-ink/60 mt-4">
            New here?{' '}
            <Link href="/register" className="font-semibold text-rust hover:underline">
              Create an account
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
}
