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

  // Role-aware — a parent or teacher landing on the pupil dashboard
  // after logging in would be confusing at best (a dashboard built
  // around Form/grade doesn't mean anything for either role) and
  // broken at worst. Waits for `profile` specifically, not just `user`,
  // since role lives on the profile, not the auth session itself.
  useEffect(() => {
    if (loading || !user || !profile) return;
    if (profile.role === 'parent') router.push('/parent');
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
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      toast.error(error.message);
      setSubmitting(false);
      return;
    }

    // Look up role directly rather than relying on the AuthProvider's
    // own profile state, which updates asynchronously via its own
    // listener and isn't guaranteed to be ready at this exact point.
    const { data: { user: signedInUser } } = await supabase.auth.getUser();
    if (!signedInUser) { setSubmitting(false); return; }
    const { data: profileRow } = await supabase
      .from('profiles').select('role, teacher_approved').eq('id', signedInUser.id).maybeSingle();

    if (profileRow?.role === 'teacher' && !profileRow.teacher_approved) {
      toast.error("Your teacher account is still pending admin approval — you'll be able to log in once it's approved.");
      await supabase.auth.signOut();
      setSubmitting(false);
      return;
    }

    if (profileRow?.role === 'parent') router.push('/parent');
    else if (profileRow?.role === 'teacher') router.push('/teacher');
    else router.push('/dashboard');
  };

  return (
    <div className="relative min-h-screen bg-board text-chalk flex flex-col items-center justify-center px-4 py-12">
      <div className="chalk-noise" />
      <div className="dust" style={{ top: '20%', left: '85%', width: 4, height: 4 }} />
      <div className="dust" style={{ top: '70%', left: '8%', width: 5, height: 5, animationDelay: '4s' }} />

      <div className="relative z-10 w-full max-w-sm">
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
          className="card-paper p-8"
          style={{ transform: 'rotate(0.4deg)' }}
        >
          <h2 className="font-display text-2xl font-semibold text-ink mb-1">Log in</h2>
          <p className="text-sm text-ink/60 mb-6">Continue your learning journey.</p>

          <div className="space-y-4">
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
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs uppercase tracking-widest text-ink/50 font-semibold">
                  Password
                </label>
                <Link href="/forgot-password" className="text-xs font-semibold text-rust hover:underline">
                  Forgot password?
                </Link>
              </div>
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
            className="btn-gold w-full mt-6 py-3 flex items-center justify-center gap-2"
          >
            {submitting ? (
              <><Loader2 className="h-4 w-4 animate-spin" /> Logging in...</>
            ) : (
              'Log In →'
            )}
          </button>

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
