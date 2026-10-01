'use client';

import { useState, FormEvent, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/components/auth-provider';
import { supabase } from '@/lib/supabase-client';
import { Loader as Loader2, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import { LogoMark } from '@/components/brand/Logo';

/**
 * A deliberately different login screen from the pupil /login — plainer,
 * darker, no playful chalk-dust or "Your AI teacher awaits" tagline, no
 * "create an account" link (admin accounts are provisioned, not
 * self-registered). Same Supabase Auth underneath, but after signing in
 * this page checks the resulting profile's role itself and immediately
 * signs out + rejects anyone who isn't an admin, rather than letting a
 * pupil account "succeed" here and land on a redirect.
 */
export default function AdminLoginPage() {
  const { user, profile, loading } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!loading && user && profile?.role === 'admin') {
      router.push('/admin');
    }
    // A signed-in pupil landing here just sees the form below (with a
    // note) rather than being forced out of their existing session —
    // visiting this page isn't an access attempt by itself.
  }, [user, profile, loading, router]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      toast.error('Please enter your email and password.');
      return;
    }
    setSubmitting(true);

    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      toast.error(error.message);
      setSubmitting(false);
      return;
    }

    let role: string | null = null;
    const { data: rpcRole, error: roleError } = await supabase.rpc('current_user_role');
    if (!roleError) {
      role = rpcRole;
    } else {
      const { data: profileRole, error: profileRoleError } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', data.user.id)
        .maybeSingle();

      if (profileRoleError) {
        toast.error(`Could not verify admin access: ${profileRoleError.message}`);
        await supabase.auth.signOut();
        setSubmitting(false);
        return;
      }
      role = profileRole?.role ?? null;
    }

    if (role !== 'admin') {
      toast.error("This account doesn't have admin access.");
      await supabase.auth.signOut();
      setSubmitting(false);
      return;
    }

    window.location.assign('/admin');
  };

  return (
    <div className="relative min-h-screen bg-board-deep text-chalk flex flex-col items-center justify-center px-4 py-12">
      <div className="chalk-noise" />

      <div className="relative z-10 w-full max-w-xs">
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2">
            <LogoMark size={32} />
            <div className="text-left leading-tight">
              <p className="font-display text-lg font-semibold text-chalk">SmartClass Zambia</p>
              <p className="text-[11px] uppercase tracking-widest text-gold">Admin</p>
            </div>
          </div>
        </div>

        <form
          onSubmit={handleSubmit}
          className="rounded-2xl border border-gold/20 bg-board auth-panel"
        >
          <div className="flex items-center gap-2 mb-1">
            <ShieldCheck className="h-4 w-4 text-gold" />
            <h2 className="font-display text-xl font-semibold text-chalk">Admin sign in</h2>
          </div>
          <p className="text-sm text-muted-board mb-6">
            Restricted access. Admin accounts are provisioned by the platform administrator.
          </p>

          {user && profile && profile.role !== 'admin' && (
            <div className="mb-5 rounded-lg border border-rust/30 bg-rust/10 px-3 py-2.5 text-xs text-chalk">
              You're currently signed in as <strong>{profile.full_name}</strong> (pupil account).
              Signing in below with an admin account will switch sessions — or{' '}
              <Link href="/dashboard" className="text-gold hover:underline">
                go back to the pupil app
              </Link>
              .
            </div>
          )}

          <div className="space-y-4">
            <div>
              <label className="block text-xs uppercase tracking-widest text-muted-board font-semibold mb-1.5">
                Email
              </label>
              <input
                type="email"
                placeholder="you@zedcode.tech"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={submitting}
                className="w-full px-3 py-2.5 rounded-lg border border-white/15 bg-white/5 text-chalk placeholder:text-muted-board font-sans text-sm focus:outline-none focus:ring-1 focus:ring-gold"
              />
            </div>
            <div>
              <label className="block text-xs uppercase tracking-widest text-muted-board font-semibold mb-1.5">
                Password
              </label>
              <input
                type="password"
                placeholder="Your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={submitting}
                className="w-full px-3 py-2.5 rounded-lg border border-white/15 bg-white/5 text-chalk placeholder:text-muted-board font-sans text-sm focus:outline-none focus:ring-1 focus:ring-gold"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="btn-gold w-full mt-6 py-3 flex items-center justify-center gap-2"
          >
            {submitting ? (
              <><Loader2 className="h-4 w-4 animate-spin" /> Signing in...</>
            ) : (
              'Sign in →'
            )}
          </button>

          <div className="text-center mt-3">
            <Link href="/forgot-password" className="text-xs text-muted-board hover:text-gold transition-colors">
              Forgot password?
            </Link>
          </div>
        </form>

        <p className="text-center text-xs text-muted-board mt-6">
          Looking for the pupil app? <Link href="/login" className="text-gold hover:underline">Go to /login</Link>
        </p>
      </div>
    </div>
  );
}
