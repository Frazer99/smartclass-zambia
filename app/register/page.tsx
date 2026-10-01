'use client';

import { useState, FormEvent, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/components/auth-provider';
import { supabase } from '@/lib/supabase-client';
import { ArrowLeft, Loader as Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Wordmark } from '@/components/brand/Logo';

const FORMS = [1, 2, 3, 4, 5, 6];

export default function RegisterPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [fullName, setFullName] = useState('');
  const [school, setSchool] = useState('');
  const [form, setForm] = useState(1);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [confirmationSent, setConfirmationSent] = useState(false);

  useEffect(() => {
    if (!loading && user) router.push('/dashboard');
  }, [user, loading, router]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!fullName || !email || !password) {
      toast.error('Please fill in all fields.');
      return;
    }
    if (password.length < 6) {
      toast.error('Password must be at least 6 characters.');
      return;
    }
    setSubmitting(true);
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { full_name: fullName, school: school.trim() || null, grade: form },
          emailRedirectTo: `${window.location.origin}/login`,
        },
      });
      if (error) {
        toast.error(error.message);
        setSubmitting(false);
        return;
      }
      if (data.user && !data.session) {
        setConfirmationSent(true);
        setSubmitting(false);
        return;
      }
      if (data.user) {
        router.push('/dashboard');
      }
    } catch (error) {
      console.error('Registration request failed:', error);
      toast.error('Unable to connect to Supabase. Check your internet connection and try again.');
      setSubmitting(false);
    }
  };

  if (confirmationSent) {
    return (
      <div className="relative min-h-screen bg-board text-chalk flex flex-col items-center justify-center px-4 py-12">
        <div className="chalk-noise" />
        <div className="relative z-10 w-full max-w-xs card-paper auth-panel text-center">
          <h2 className="font-display text-2xl font-semibold text-ink mb-2">Check your email</h2>
          <p className="text-sm text-ink/70 mb-6">We sent a confirmation link to {email}. Confirm your email, then log in to start learning.</p>
          <Link href="/login" className="btn-gold inline-flex px-5 py-3">Go to login</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen bg-board text-chalk flex flex-col items-center justify-center px-4 py-12">
      <div className="chalk-noise" />
      <div className="dust" style={{ top: '15%', left: '10%', width: 4, height: 4 }} />
      <div className="dust" style={{ top: '75%', left: '85%', width: 5, height: 5, animationDelay: '3s' }} />

      <div className="relative z-10 w-full max-w-xs">
        <Link href="/" className="flex items-center gap-2 text-sm text-muted-board hover:text-chalk mb-6 justify-center transition-colors">
          <ArrowLeft className="h-4 w-4" /> Back to home
        </Link>

        {/* Wordmark */}
        <div className="text-center mb-6">
          <Wordmark size="lg" className="justify-center" />
          <svg className="mx-auto mt-2" width="160" height="12" viewBox="0 0 160 12">
            <path d="M2 9 Q 40 -1, 80 7 T 158 5" fill="none" stroke="hsl(41 76% 60%)" strokeWidth="2" strokeLinecap="round" />
          </svg>
          <p className="font-hand text-lg text-muted-board mt-2">Your AI teacher awaits.</p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="card-paper auth-panel"
          style={{ transform: 'rotate(-0.5deg)' }}
        >
          <h2 className="font-display text-2xl font-semibold text-ink mb-1">Create account</h2>
          <p className="text-sm text-ink/60 mb-6">Start learning with your AI teacher today.</p>

          <div className="space-y-4">
            <div>
              <label className="block text-xs uppercase tracking-widest text-ink/50 font-semibold mb-1.5">
                School <span className="normal-case font-normal text-ink/40">(optional)</span>
              </label>
              <input
                type="text"
                placeholder="e.g. Kabulonga Girls Secondary School"
                value={school}
                onChange={(e) => setSchool(e.target.value)}
                disabled={submitting}
                className="w-full px-3 py-2.5 rounded-lg border-2 border-ink bg-chalk text-ink font-sans text-sm focus:outline-none focus:ring-2 focus:ring-gold"
              />
            </div>
            <div>
              <label className="block text-xs uppercase tracking-widest text-ink/50 font-semibold mb-1.5">
                Full Name
              </label>
              <input
                type="text"
                placeholder="e.g. Chipo Mwansa"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                disabled={submitting}
                className="w-full px-3 py-2.5 rounded-lg border-2 border-ink bg-chalk text-ink font-sans text-sm focus:outline-none focus:ring-2 focus:ring-gold"
              />
            </div>
            <div>
              <label className="block text-xs uppercase tracking-widest text-ink/50 font-semibold mb-1.5">
                Form
              </label>
              <div className="flex flex-wrap gap-2">
                {FORMS.map((f) => (
                  <button
                    key={f}
                    type="button"
                    onClick={() => setForm(f)}
                    disabled={submitting}
                    className={`px-3.5 py-2 rounded-lg border-2 text-sm font-semibold transition-colors ${
                      form === f ? 'border-ink bg-gold text-ink' : 'border-ink/30 bg-chalk text-ink/60 hover:border-ink'
                    }`}
                  >
                    Form {f}
                  </button>
                ))}
              </div>
            </div>
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
                placeholder="At least 6 characters"
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
              <><Loader2 className="h-4 w-4 animate-spin" /> Creating account...</>
            ) : (
              'Create Account →'
            )}
          </button>

          <p className="text-center text-sm text-ink/60 mt-4">
            Already have an account?{' '}
            <Link href="/login" className="font-semibold text-rust hover:underline">
              Log in
            </Link>
          </p>
          <p className="text-center text-xs text-ink/40 mt-3">
            Signing up as a parent or teacher?{' '}
            <Link href="/register/parent" className="underline hover:text-ink/60">Parent account</Link>
            {' · '}
            <Link href="/register/teacher" className="underline hover:text-ink/60">Teacher account</Link>
          </p>
        </form>
      </div>
    </div>
  );
}
