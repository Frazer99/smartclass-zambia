'use client';

import { useState, FormEvent, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/components/auth-provider';
import { supabase } from '@/lib/supabase-client';
import { ArrowLeft, Loader as Loader2, Clock } from 'lucide-react';
import { toast } from 'sonner';
import { Wordmark } from '@/components/brand/Logo';
import { SchoolAutocomplete } from '@/components/SchoolAutocomplete';

/**
 * Teacher accounts require admin approval — deliberately not
 * self-service like pupil or parent accounts. Teacher access exposes
 * aggregated performance data across an entire school's pupils, which
 * is a real enough privilege that registering an email/password alone
 * isn't an appropriate gate for it. profiles.teacher_approved defaults
 * to false; an admin flips it from the Users tab.
 *
 * School is required here (unlike the pupil registration form, where
 * it's optional) — a teacher's whole dashboard is scoped to their
 * school, so there's nothing useful to show without one.
 */
export default function TeacherRegisterPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [fullName, setFullName] = useState('');
  const [school, setSchool] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    if (!loading && user) router.push('/dashboard');
  }, [user, loading, router]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!fullName || !school || !email || !password) {
      toast.error('Please fill in all fields — a school is required for teacher accounts.');
      return;
    }
    if (password.length < 6) {
      toast.error('Password must be at least 6 characters.');
      return;
    }
    setSubmitting(true);
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName, school: school.trim(), role: 'teacher' } },
    });
    setSubmitting(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    if (data.user) {
      setSubmitted(true);
    }
  };

  if (submitted) {
    return (
      <div className="relative min-h-screen bg-board text-chalk flex flex-col items-center justify-center px-4 py-12">
        <div className="chalk-noise" />
        <div className="relative z-10 w-full max-w-sm text-center">
          <div className="card-paper p-8" style={{ transform: 'rotate(-0.5deg)' }}>
            <Clock className="h-10 w-10 text-gold mx-auto mb-4" />
            <h2 className="font-display text-xl font-semibold text-ink mb-2">Account created — pending approval</h2>
            <p className="text-sm text-ink/70 mb-6">
              Your teacher account for <strong>{school}</strong> has been created, but needs an admin to approve
              it before you can see your school&apos;s analytics. This is a real, human review step — teacher
              access shows aggregated pupil performance, so it isn&apos;t self-service the way a pupil account is.
              You&apos;ll be able to log in once it&apos;s approved.
            </p>
            <Link href="/login" className="btn-gold px-5 py-2.5 inline-block">Back to Login</Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen bg-board text-chalk flex flex-col items-center justify-center px-4 py-12">
      <div className="chalk-noise" />
      <div className="dust" style={{ top: '15%', left: '10%', width: 4, height: 4 }} />
      <div className="dust" style={{ top: '75%', left: '85%', width: 5, height: 5, animationDelay: '3s' }} />

      <div className="relative z-10 w-full max-w-sm">
        <Link href="/register" className="flex items-center gap-2 text-sm text-muted-board hover:text-chalk mb-6 justify-center transition-colors">
          <ArrowLeft className="h-4 w-4" /> Back
        </Link>

        <div className="text-center mb-6">
          <Wordmark size="lg" className="justify-center" />
          <svg className="mx-auto mt-2" width="160" height="12" viewBox="0 0 160 12">
            <path d="M2 9 Q 40 -1, 80 7 T 158 5" fill="none" stroke="hsl(41 76% 60%)" strokeWidth="2" strokeLinecap="round" />
          </svg>
          <p className="font-hand text-lg text-muted-board mt-2">See how your class is really doing.</p>
        </div>

        <form onSubmit={handleSubmit} className="card-paper p-8" style={{ transform: 'rotate(-0.5deg)' }}>
          <h2 className="font-display text-2xl font-semibold text-ink mb-1">Teacher account</h2>
          <p className="text-sm text-ink/60 mb-6">Requires admin approval before you can see your school&apos;s analytics.</p>

          <div className="space-y-4">
            <div>
              <label className="block text-xs uppercase tracking-widest text-ink/50 font-semibold mb-1.5">Full Name</label>
              <input
                type="text"
                placeholder="e.g. Mr Mumba"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                disabled={submitting}
                className="w-full px-3 py-2.5 rounded-lg border-2 border-ink bg-chalk text-ink font-sans text-sm focus:outline-none focus:ring-2 focus:ring-gold"
              />
            </div>
            <div>
              <label className="block text-xs uppercase tracking-widest text-ink/50 font-semibold mb-1.5">School</label>
              <SchoolAutocomplete
                value={school}
                onChange={setSchool}
                placeholder="e.g. Kabulonga Girls Secondary School"
                disabled={submitting}
                className="w-full px-3 py-2.5 rounded-lg border-2 border-ink bg-chalk text-ink font-sans text-sm focus:outline-none focus:ring-2 focus:ring-gold"
              />
              <p className="text-xs text-ink/50 mt-1">
                Start typing to see schools already in use — picking one from the list guarantees an exact match
                with your pupils&apos; records. If your school isn&apos;t listed yet, you can still type it in full;
                just make sure it matches your pupils&apos; entries exactly (spelling/capitalization) afterward.
              </p>
            </div>
            <div>
              <label className="block text-xs uppercase tracking-widest text-ink/50 font-semibold mb-1.5">Email</label>
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
              <label className="block text-xs uppercase tracking-widest text-ink/50 font-semibold mb-1.5">Password</label>
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
            {submitting ? (<><Loader2 className="h-4 w-4 animate-spin" /> Creating account...</>) : ('Request Teacher Account →')}
          </button>

          <p className="text-center text-sm text-ink/60 mt-4">
            Already have an account?{' '}
            <Link href="/login" className="font-semibold text-rust hover:underline">Log in</Link>
          </p>
        </form>
      </div>
    </div>
  );
}
