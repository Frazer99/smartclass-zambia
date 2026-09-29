'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/auth-provider';
import { supabase } from '@/lib/supabase-client';
import { Loader as Loader2, Users, TrendingUp, ChevronDown, ChevronUp } from 'lucide-react';
import { Wordmark } from '@/components/brand/Logo';

interface Child {
  child_id: string;
  full_name: string;
  grade: number;
  school: string | null;
}

interface ChildProgressRow {
  topic_id: string;
  topic_name: string;
  subject_name: string;
  mastery_percentage: number;
  lessons_completed: number;
  total_attempts: number;
  correct_attempts: number;
}

/**
 * The real "parent dashboard" from the original design doc — not just
 * the weekly email digest, live and on-demand. Standalone route
 * (outside the (app) group) with its own minimal header rather than
 * reusing the pupil app shell's layout, which assumes a Form/grade and
 * shows Lessons/Past Papers nav that mean nothing for a parent.
 *
 * get_my_children() and get_child_progress() (migration 20260803080000)
 * are both admin-free — a parent only ever sees children actually
 * linked to them via parent_child_links, checked server-side inside
 * get_child_progress() itself, not just filtered client-side.
 */
export default function ParentDashboard() {
  const { user, profile, loading, signOut } = useAuth();
  const router = useRouter();
  const [children, setChildren] = useState<Child[]>([]);
  const [childrenLoading, setChildrenLoading] = useState(true);
  const [expandedChild, setExpandedChild] = useState<string | null>(null);
  const [progressByChild, setProgressByChild] = useState<Record<string, ChildProgressRow[]>>({});
  const [progressLoading, setProgressLoading] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && !user) router.push('/login');
  }, [user, loading, router]);

  useEffect(() => {
    if (!user) return;
    (async () => {
      setChildrenLoading(true);
      const { data } = await supabase.rpc('get_my_children');
      setChildren(data || []);
      setChildrenLoading(false);
    })();
  }, [user]);

  const toggleChild = async (childId: string) => {
    if (expandedChild === childId) { setExpandedChild(null); return; }
    setExpandedChild(childId);
    if (!progressByChild[childId]) {
      setProgressLoading(childId);
      const { data, error } = await supabase.rpc('get_child_progress', { p_child_id: childId });
      if (!error) setProgressByChild((prev) => ({ ...prev, [childId]: data || [] }));
      setProgressLoading(null);
    }
  };

  if (loading || !user) {
    return <div className="min-h-screen bg-board flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-gold" /></div>;
  }

  return (
    <div className="min-h-screen bg-board text-chalk">
      <div className="chalk-noise" />
      <header className="relative z-20 border-b border-white/10 bg-board-deep/60 backdrop-blur">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between">
          <Wordmark size="md" />
          <div className="flex items-center gap-3">
            <span className="text-sm text-muted-board">{profile?.full_name}</span>
            <button onClick={signOut} className="text-sm border border-white/15 text-muted-board hover:text-chalk rounded-lg px-3 py-1.5 transition-colors">
              Sign out
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">
        <div>
          <h1 className="font-display text-2xl font-semibold text-chalk mb-1">Your Children</h1>
          <p className="text-sm text-muted-board">Real progress, updated as they learn — not just the weekly summary email.</p>
        </div>

        {childrenLoading ? (
          <div className="flex h-48 items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-gold" /></div>
        ) : children.length === 0 ? (
          <div className="card-board p-6 text-center">
            <Users className="h-8 w-8 text-muted-board mx-auto mb-3" />
            <p className="text-sm text-chalk font-semibold mb-1">No children linked yet</p>
            <p className="text-sm text-muted-board">
              Ask your child to add your email address as their parent/guardian email in their own Account
              settings — you&apos;ll be linked here automatically, no matter which of you signs up first.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {children.map((child) => (
              <div key={child.child_id} className="card-board overflow-hidden">
                <button
                  onClick={() => toggleChild(child.child_id)}
                  className="w-full p-4 flex items-center justify-between text-left"
                >
                  <div>
                    <p className="font-display text-base font-semibold text-chalk">{child.full_name}</p>
                    <p className="text-xs text-muted-board">Form {child.grade} · {child.school || 'No school set'}</p>
                  </div>
                  {expandedChild === child.child_id ? <ChevronUp className="h-4 w-4 text-muted-board shrink-0" /> : <ChevronDown className="h-4 w-4 text-muted-board shrink-0" />}
                </button>

                {expandedChild === child.child_id && (
                  <div className="border-t border-white/10 p-4">
                    {progressLoading === child.child_id ? (
                      <div className="flex h-24 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-gold" /></div>
                    ) : (progressByChild[child.child_id]?.length ?? 0) === 0 ? (
                      <p className="text-sm text-muted-board">No progress recorded yet — {child.full_name.split(' ')[0]} hasn&apos;t started a lesson or practice question.</p>
                    ) : (
                      <div className="space-y-2">
                        {progressByChild[child.child_id].map((row) => (
                          <div key={row.topic_id} className="flex items-center gap-3 text-sm">
                            <TrendingUp className="h-3.5 w-3.5 text-muted-board shrink-0" />
                            <span className="text-chalk flex-1">{row.topic_name}</span>
                            <span className="text-xs text-muted-board">{row.subject_name}</span>
                            <span className={`font-mono-sc font-semibold w-12 text-right ${row.mastery_percentage < 40 ? 'text-rust' : row.mastery_percentage < 70 ? 'text-gold' : 'text-teal'}`}>
                              {row.mastery_percentage}%
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
