'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/components/auth-provider';
import { supabase, Announcement, Subject } from '@/lib/supabase-client';
import { Bell, Loader as Loader2, Menu, X } from 'lucide-react';
import { Wordmark } from '@/components/brand/Logo';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, profile, loading, signOut } = useAuth();
  const router = useRouter();
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [lessonsOpen, setLessonsOpen] = useState(false);
  const [pastPapersOpen, setPastPapersOpen] = useState(false);

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
    const fetchShellData = async () => {
      const [{ data: announcementsData }, { data: subjectsData }] = await Promise.all([
        supabase
        .from('announcements')
        .select('*')
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(10),
        supabase.from('subjects').select('*').order('display_order'),
      ]);
      setAnnouncements((announcementsData || []) as Announcement[]);
      setSubjects(((subjectsData || []) as Subject[]).filter((subject) => subject.grades.includes(profile.grade)));
    };
    void fetchShellData();
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
            <div className="relative">
              <button
                type="button"
                onClick={() => setMenuOpen((open) => !open)}
                aria-label="Open menu"
                aria-expanded={menuOpen}
                title="Menu"
                className="flex items-center justify-center rounded-lg px-2 py-2 text-muted-board transition-colors hover:bg-white/5 hover:text-chalk sm:px-3"
              >
                {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
              </button>
              {menuOpen && (
                <div className="absolute right-0 top-full z-50 mt-2 w-56 rounded-lg border border-white/15 bg-board-deep p-2 shadow-xl">
                  <button type="button" onClick={() => setLessonsOpen((open) => !open)} className="flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-sm text-muted-board hover:bg-white/5 hover:text-chalk">
                    Lessons <span aria-hidden="true">{lessonsOpen ? '−' : '+'}</span>
                  </button>
                  {lessonsOpen && <div className="ml-3 border-l border-white/10 pl-2">
                    {subjects.map((subject) => <Link key={subject.id} href={`/dashboard?subject=${subject.id}`} onClick={() => setMenuOpen(false)} className="block rounded-md px-3 py-1.5 text-xs text-muted-board hover:bg-white/5 hover:text-chalk">{subject.name}</Link>)}
                  </div>}
                  <button type="button" onClick={() => setPastPapersOpen((open) => !open)} className="flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-sm text-muted-board hover:bg-white/5 hover:text-chalk">
                    Past Papers <span aria-hidden="true">{pastPapersOpen ? '−' : '+'}</span>
                  </button>
                  {pastPapersOpen && <div className="ml-3 border-l border-white/10 pl-2">
                    {subjects.map((subject) => <Link key={subject.id} href={`/past-papers?subject=${subject.id}`} onClick={() => setMenuOpen(false)} className="block rounded-md px-3 py-1.5 text-xs text-muted-board hover:bg-white/5 hover:text-chalk">{subject.name}</Link>)}
                  </div>}
                  <Link href="/materials" onClick={() => setMenuOpen(false)} className="block rounded-md px-3 py-2 text-sm text-muted-board hover:bg-white/5 hover:text-chalk">Study Materials</Link>
                  <Link href="/progress" onClick={() => setMenuOpen(false)} className="block rounded-md px-3 py-2 text-sm text-muted-board hover:bg-white/5 hover:text-chalk">My Progress</Link>
                  <Link href="/feedback" onClick={() => setMenuOpen(false)} className="block rounded-md px-3 py-2 text-sm text-muted-board hover:bg-white/5 hover:text-chalk">Share Feedback</Link>
                  <Link href="/subscribe" onClick={() => setMenuOpen(false)} className="block rounded-md px-3 py-2 text-sm text-muted-board hover:bg-white/5 hover:text-chalk">Subscription</Link>
                  <Link href="/account" onClick={() => setMenuOpen(false)} className="block rounded-md px-3 py-2 text-sm text-muted-board hover:bg-white/5 hover:text-chalk">My Account</Link>
                  <div className="my-2 border-t border-white/10" />
                  <button
                    type="button"
                    onClick={() => { setMenuOpen(false); void signOut(); }}
                    className="block w-full rounded-md px-3 py-2 text-left text-sm text-muted-board hover:bg-white/5 hover:text-chalk"
                  >
                    Sign out
                  </button>
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
