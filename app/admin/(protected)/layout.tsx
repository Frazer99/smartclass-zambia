'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/components/auth-provider';
import { LogoMark } from '@/components/brand/Logo';
import { ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';

/**
 * Admin gets its own layout, entirely separate from the pupil app's
 * layout (`app/(app)/layout.tsx`) — no pupil nav (Lessons/Past Papers/
 * Progress), a distinct header, and its own auth guard that sends anyone
 * without admin access to `/admin/login` rather than the pupil `/login`.
 *
 * This still runs on the same Supabase Auth system as the rest of the
 * app — there's no second identity provider — but the entry point,
 * chrome, and redirect targets are fully separate, so a pupil account
 * never sees admin UI and an admin who lands on `/admin` without a
 * session goes to the admin login screen, not the pupil one.
 */
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { user, profile, loading, signOut } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace('/admin/login');
      return;
    }
    if (!profile) {
      toast.error('Admin profile not found. Please sign in again.');
      signOut();
      router.replace('/admin/login');
      return;
    }
    if (profile && profile.role !== 'admin') {
      toast.error("This account doesn't have admin access.");
      signOut();
      router.replace('/admin/login');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, profile, loading, router]);

  if (loading) return <div className="min-h-screen bg-board-deep" />;
  if (!user || !profile || profile.role !== 'admin') return null;

  return (
    <div className="min-h-screen bg-board-deep text-chalk">
      <div className="chalk-noise" />

      <header className="relative z-20 border-b border-gold/20 bg-board">
        <div className="max-w-5xl mx-auto px-4 py-3 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <LogoMark size={28} />
            <div className="leading-tight">
              <p className="font-display text-sm font-semibold text-chalk">SmartClass Zambia</p>
              <p className="text-[11px] uppercase tracking-widest text-gold">Admin</p>
            </div>
          </div>

          <div className="flex min-w-0 flex-1 flex-wrap items-center justify-end gap-2">
            <Link
              href="/dashboard"
              className="hidden sm:flex items-center gap-1.5 text-xs text-muted-board hover:text-chalk transition-colors"
            >
              <ArrowLeft className="h-3.5 w-3.5" /> Back to pupil app
            </Link>
            <span className="max-w-[10rem] truncate text-xs text-muted-board">{profile?.full_name}</span>
            <button
              onClick={() => { signOut(); router.push('/admin/login'); }}
              className="border border-white/20 text-muted-board text-xs rounded-lg px-2.5 py-1.5 hover:text-chalk hover:border-white/40 transition-colors"
            >
              Sign out
            </button>
          </div>
        </div>
      </header>

      <main className="relative z-10 min-w-0 max-w-5xl mx-auto px-4 py-6">{children}</main>
    </div>
  );
}
