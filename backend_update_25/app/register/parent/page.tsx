'use client';

import { useState, FormEvent, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/components/auth-provider';
import { supabase } from '@/lib/supabase-client';
import { ArrowLeft, Loader as Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Wordmark } from '@/components/brand/Logo';

/**
 * A parent account, not just an email address on a pupil's profile.
 * role: 'parent' is passed in signup metadata and read by
 * handle_new_user() (migration 20260803080000) — set at INSERT time
 * specifically so prevent_self_role_escalation (a BEFORE UPDATE
 * trigger) never even sees this as a role change to block.
 *
 * Linking to a child happens automatically: if this email matches a
 * pupil's profiles.parent_email (set on their own /account page), a
 * database trigger links them the moment either side happens, in
 * whichever order — sign up first, or set the parent email on the
 * child's account first, both work.
 */
export default function ParentRegisterPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!loading && user) router.push('/parent');
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
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName, role: 'parent' } },
    });
    if (error) {
      toast.error(error.message);
      setSubmitting(false);
      return;
    }
    if (data.user) {
      router.push('/parent');
    }
  };

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
          <p className="font-hand text-lg text-muted-board mt-2">Follow your child&apos;s progress.</p>
        </div>

        <form onSubmit={handleSubmit} className="card-paper p-8" style={{ transform: 'rotate(-0.5deg)' }}>
          <h2 className="font-display text-2xl font-semibold text-ink mb-1">Parent account</h2>
          <p className="text-sm text-ink/60 mb-6">
            See your child&apos;s real progress directly — use the same email address they&apos;ve added as their
            parent/guardian email in their own account settings, and you&apos;ll be linked automatically.
          </p>

          <div className="space-y-4">
            <div>
              <label className="block text-xs uppercase tracking-widest text-ink/50 font-semibold mb-1.5">Full Name</label>
              <input
                type="text"
                placeholder="e.g. Mrs Mwansa"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                disabled={submitting}
                className="w-full px-3 py-2.5 rounded-lg border-2 border-ink bg-chalk text-ink font-sans text-sm focus:outline-none focus:ring-2 focus:ring-gold"
              />
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
            {submitting ? (<><Loader2 className="h-4 w-4 animate-spin" /> Creating account...</>) : ('Create Parent Account →')}
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
