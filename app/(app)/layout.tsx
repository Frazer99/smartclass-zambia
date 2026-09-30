'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/components/auth-provider';
import { supabase, Announcement } from '@/lib/supabase-client';
import { Bell, Loader as Loader2 } from 'lucide-react';
import { Wordmark } from '@/components/brand/Logo';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, profile, loading } = useAuth();
  const router = useRouter();
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [notificationsOpen, setNotificationsOpen] = useState(false);

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

  useEffect(() => {
    if (!profile) return;
    const fetchAnnouncements = async () => {
      const { data } = await supabase
        .from('announcements')
        .select('*')
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(10);
      setAnnouncements((data || []) as Announcement[]);
    };
    void fetchAnnouncements();
  }, [profile]);

  if (loading) {
    return (
      <div className="min-h-screen bg-board flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-gold" />
      </div>
    );
  }

  if (!user || profile?.role === 'admin') return null;

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
            <div className="relative">
              <button
                type="button"
                onClick={() => setNotificationsOpen((open) => !open)}
                aria-label="Open notifications"
                aria-expanded={notificationsOpen}
                title="Notifications"
                className="relative flex items-center justify-center rounded-lg px-2 py-2 text-xs text-muted-board transition-colors hover:bg-white/5 hover:text-chalk sm:px-3 sm:text-sm"
              >
                <Bell className="h-4 w-4" />
                {announcements.length > 0 && <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-gold" />}
              </button>
              {notificationsOpen && (
                <div className="absolute right-0 top-full z-50 mt-2 w-[min(21rem,calc(100vw-2rem))] rounded-lg border border-white/15 bg-board-deep p-4 shadow-xl">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <h2 className="font-display text-base font-semibold text-chalk">Notifications</h2>
                    <span className="text-xs text-muted-board">{announcements.length}</span>
                  </div>
                  {announcements.length === 0 ? (
                    <p className="text-sm text-muted-board">You have no new notifications.</p>
                  ) : (
                    <div className="max-h-80 space-y-3 overflow-y-auto">
                      {announcements.map((announcement) => (
                        <article key={announcement.id} className="border-l-2 border-gold/50 pl-3">
                          <p className="text-xs uppercase tracking-widest text-gold">Announcement</p>
                          <h3 className="mt-1 text-sm font-semibold text-chalk">{announcement.title}</h3>
                          <p className="mt-1 whitespace-pre-wrap text-xs leading-relaxed text-muted-board">{announcement.body}</p>
                        </article>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </nav>
        </div>
      </header>

      <main className="relative z-10 min-w-0 max-w-5xl mx-auto px-4 py-6">
        {children}
      </main>
    </div>
  );
}
