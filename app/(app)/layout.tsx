'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/components/auth-provider';
import { LayoutDashboard, TrendingUp, FileText, BookOpen, MessageSquare, CreditCard, Loader as Loader2 } from 'lucide-react';
import { Wordmark } from '@/components/brand/Logo';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, profile, loading, signOut } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace('/login');
      return;
    }
    if (profile?.role === 'admin') {
      router.replace('/admin');
    }
  }, [user, profile, loading, router]);

  if (loading) {
    return (
      <div className="min-h-screen bg-board flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-gold" />
      </div>
    );
  }

  if (!user || profile?.role === 'admin') return null;

  const initials = profile?.full_name
    ? profile.full_name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()
    : '?';

  return (
    <div className="min-h-screen bg-board text-chalk print:bg-white print:text-black">
      <div className="chalk-noise" />

      {/* Topbar */}
      <header className="relative z-20 border-b border-white/10 bg-board-deep/60 backdrop-blur print:hidden">
        <div className="max-w-5xl mx-auto px-4 py-3 flex flex-wrap items-center justify-between gap-2">
          {/* Wordmark */}
          <Link href="/dashboard">
            <Wordmark size="sm" />
          </Link>

          {/* Main menu */}
          <nav aria-label="Main menu" className="flex w-full min-w-0 flex-wrap items-center justify-start gap-1 sm:w-auto sm:flex-1 sm:justify-end sm:gap-2">
            <Link href="/dashboard">
              <span className="flex items-center gap-1.5 rounded-lg px-2 py-2 text-xs text-muted-board transition-colors hover:bg-white/5 hover:text-chalk sm:px-3 sm:text-sm">
                <LayoutDashboard className="h-4 w-4" />
                <span>Dashboard</span>
              </span>
            </Link>
            <Link href="/past-papers">
              <span className="flex items-center gap-1.5 rounded-lg px-2 py-2 text-xs text-muted-board transition-colors hover:bg-white/5 hover:text-chalk sm:px-3 sm:text-sm">
                <FileText className="h-4 w-4" />
                <span>Past Papers</span>
              </span>
            </Link>
            <Link href="/materials">
              <span className="flex items-center gap-1.5 rounded-lg px-2 py-2 text-xs text-muted-board transition-colors hover:bg-white/5 hover:text-chalk sm:px-3 sm:text-sm">
                <BookOpen className="h-4 w-4" />
                <span>Study Materials</span>
              </span>
            </Link>
            <Link href="/progress">
              <span className="flex items-center gap-1.5 rounded-lg px-2 py-2 text-xs text-muted-board transition-colors hover:bg-white/5 hover:text-chalk sm:px-3 sm:text-sm">
                <TrendingUp className="h-4 w-4" />
                <span>My Progress</span>
              </span>
            </Link>
            <Link href="/feedback">
              <span className="flex items-center gap-1.5 rounded-lg px-2 py-2 text-xs text-muted-board transition-colors hover:bg-white/5 hover:text-chalk sm:px-3 sm:text-sm" title="Share feedback">
                <MessageSquare className="h-4 w-4" />
                <span>Share Feedback</span>
              </span>
            </Link>
            <Link href="/subscribe">
              <span className="flex items-center gap-1.5 rounded-lg px-2 py-2 text-xs text-muted-board transition-colors hover:bg-white/5 hover:text-chalk sm:px-3 sm:text-sm">
                <CreditCard className="h-4 w-4" />
                <span>Subscription</span>
              </span>
            </Link>
            {profile && (
              <span className="border-2 border-chalk/20 rounded-full px-3 py-1 text-xs font-semibold text-chalk/70 hidden sm:inline">
                Form {profile.grade}
              </span>
            )}

            {/* Avatar */}
            <Link href="/account" title="My Account" className="flex items-center gap-1.5 rounded-lg px-2 py-2 text-xs text-muted-board transition-colors hover:bg-white/5 hover:text-chalk sm:px-3 sm:text-sm">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gold font-display text-sm font-bold text-ink transition-all hover:brightness-95">
                {initials}
              </div>
              <span>My Account</span>
            </Link>

            <button
              onClick={signOut}
              className="border border-white/20 text-muted-board text-xs rounded-lg px-2.5 py-1.5 hover:text-chalk hover:border-white/40 transition-colors"
            >
              Sign out
            </button>
          </nav>
        </div>
      </header>

      <main className="relative z-10 min-w-0 max-w-5xl mx-auto px-4 py-6">
        {children}
      </main>
    </div>
  );
}
