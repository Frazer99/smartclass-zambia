'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/components/auth-provider';
import { LayoutDashboard, TrendingUp, FileText, BookOpen, MessageSquare, Loader as Loader2 } from 'lucide-react';
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
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          {/* Wordmark */}
          <Link href="/dashboard">
            <Wordmark size="sm" />
          </Link>

          {/* Nav + profile */}
          <div className="flex items-center gap-2">
            <Link href="/dashboard">
              <button className="flex items-center gap-1.5 px-3 py-2 text-sm text-muted-board hover:text-chalk rounded-lg hover:bg-white/5 transition-colors">
                <LayoutDashboard className="h-4 w-4" />
                <span className="hidden sm:inline">Lessons</span>
              </button>
            </Link>
            <Link href="/past-papers">
              <button className="flex items-center gap-1.5 px-3 py-2 text-sm text-muted-board hover:text-chalk rounded-lg hover:bg-white/5 transition-colors">
                <FileText className="h-4 w-4" />
                <span className="hidden sm:inline">Past Papers</span>
              </button>
            </Link>
            <Link href="/materials">
              <button className="flex items-center gap-1.5 px-3 py-2 text-sm text-muted-board hover:text-chalk rounded-lg hover:bg-white/5 transition-colors">
                <BookOpen className="h-4 w-4" />
                <span className="hidden sm:inline">Materials</span>
              </button>
            </Link>
            <Link href="/progress">
              <button className="flex items-center gap-1.5 px-3 py-2 text-sm text-muted-board hover:text-chalk rounded-lg hover:bg-white/5 transition-colors">
                <TrendingUp className="h-4 w-4" />
                <span className="hidden sm:inline">Progress</span>
              </button>
            </Link>
            <Link href="/feedback">
              <button className="flex items-center gap-1.5 px-3 py-2 text-sm text-muted-board hover:text-chalk rounded-lg hover:bg-white/5 transition-colors" title="Share feedback">
                <MessageSquare className="h-4 w-4" />
                <span className="hidden sm:inline">Feedback</span>
              </button>
            </Link>
            {profile && (
              <span className="border-2 border-chalk/20 rounded-full px-3 py-1 text-xs font-semibold text-chalk/70 hidden sm:inline">
                Form {profile.grade}
              </span>
            )}

            {/* Avatar */}
            <Link href="/account" title="My Account">
              <div className="w-9 h-9 rounded-full bg-gold flex items-center justify-center font-display font-bold text-ink text-sm hover:brightness-95 transition-all">
                {initials}
              </div>
            </Link>

            <button
              onClick={signOut}
              className="border border-white/20 text-muted-board text-xs rounded-lg px-2.5 py-1.5 hover:text-chalk hover:border-white/40 transition-colors"
            >
              Sign out
            </button>
          </div>
        </div>
      </header>

      <main className="relative z-10 max-w-5xl mx-auto px-4 py-6">
        {children}
      </main>
    </div>
  );
}
