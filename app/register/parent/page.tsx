'use client';

import { FormEvent, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/auth-provider';
import { supabase } from '@/lib/supabase-client';
import { ArrowLeft, Loader as Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Wordmark } from '@/components/brand/Logo';

export default function ParentRegisterPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  useEffect(() => { if (!loading && user) router.replace('/parent'); }, [user, loading, router]);
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!fullName || !email || password.length < 6) { toast.error('Enter your name, email, and a password of at least 6 characters.'); return; }
    setSubmitting(true);
    const { data, error } = await supabase.auth.signUp({ email, password, options: { data: { full_name: fullName, role: 'parent' }, emailRedirectTo: `${window.location.origin}/login` } });
    if (error) toast.error(error.message);
    else if (data.user && data.session) router.replace('/parent');
    else toast.success('Check your email to confirm your account.');
    setSubmitting(false);
  };
  return <div className="relative min-h-screen bg-board text-chalk flex flex-col items-center justify-center px-4 py-12"><div className="chalk-noise" /><div className="relative z-10 w-full max-w-xs"><Link href="/register" className="flex items-center gap-2 text-sm text-muted-board mb-6 justify-center"><ArrowLeft className="h-4 w-4" /> Back</Link><div className="text-center mb-6"><Wordmark size="lg" className="justify-center" /><p className="font-hand text-lg text-muted-board mt-2">Follow your child&apos;s progress.</p></div><form onSubmit={submit} className="card-paper auth-panel"><h1 className="font-display text-2xl font-semibold text-ink mb-1">Parent account</h1><p className="text-sm text-ink/60 mb-6">Use the email your child adds as their parent or guardian email.</p><div className="space-y-4"><input aria-label="Full name" required placeholder="Full name" value={fullName} onChange={(event) => setFullName(event.target.value)} className="w-full px-3 py-2.5 rounded-lg border-2 border-ink bg-chalk text-ink" /><input aria-label="Email" required type="email" placeholder="Email" value={email} onChange={(event) => setEmail(event.target.value)} className="w-full px-3 py-2.5 rounded-lg border-2 border-ink bg-chalk text-ink" /><input aria-label="Password" required type="password" placeholder="Password" value={password} onChange={(event) => setPassword(event.target.value)} className="w-full px-3 py-2.5 rounded-lg border-2 border-ink bg-chalk text-ink" /></div><button type="submit" disabled={submitting} className="btn-gold w-full mt-6 py-3 flex justify-center gap-2">{submitting ? <><Loader2 className="h-4 w-4 animate-spin" /> Creating...</> : 'Create Parent Account'}</button></form></div></div>;
}
