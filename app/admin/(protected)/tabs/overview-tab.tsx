import { useState } from 'react';
import { Users, Layers, BookOpen, GraduationCap, FileText, Check, Loader as Loader2, Award, Activity, Clock, UserPlus, CircleAlert as AlertCircle, ChevronDown, Megaphone, Trash2 } from 'lucide-react';
import { FORMS } from './constants';
import { Announcement } from '@/lib/supabase-client';

type ActivityItem = {
  id: string;
  type: 'lesson_completed' | 'practice_attempt' | 'user_joined';
  user_name: string;
  detail: string;
  timestamp: string;
};

type UserProfile = {
  id: string;
  full_name: string;
  grade: number;
  role: string;
  created_at: string;
};

export function OverviewTab({
  userCount, topicCount, lessonCount, questionCount, materialCount, approvedMaterials,
  usersByGrade, topicsBySubject, activityFeed, recentSignups, announcements, onPostAnnouncement, onDeleteAnnouncement,
}: {
  userCount: number; topicCount: number; lessonCount: number; questionCount: number;
  materialCount: number; approvedMaterials: number;
  usersByGrade: Record<number, number>;
  topicsBySubject: { subject: string; count: number; color: string }[];
  activityFeed: ActivityItem[];
  recentSignups: UserProfile[];
  announcements: Announcement[];
  onPostAnnouncement: (title: string, body: string) => Promise<boolean>;
  onDeleteAnnouncement: (id: string) => Promise<boolean>;
}) {
  const [showDetails, setShowDetails] = useState(false);
  const [expandedStats, setExpandedStats] = useState<Set<string>>(new Set());
  const [expandedOverviewSections, setExpandedOverviewSections] = useState<Set<string>>(new Set());
  const [announcementTitle, setAnnouncementTitle] = useState('');
  const [announcementBody, setAnnouncementBody] = useState('');
  const [postingAnnouncement, setPostingAnnouncement] = useState(false);
  const [deletingAnnouncementId, setDeletingAnnouncementId] = useState<string | null>(null);
  const maxGradeCount = Math.max(...Object.values(usersByGrade), 1);
  const maxTopicCount = Math.max(...topicsBySubject.map((t) => t.count), 1);

  const submitAnnouncement = async () => {
    if (!announcementTitle.trim() || !announcementBody.trim()) return;
    setPostingAnnouncement(true);
    const posted = await onPostAnnouncement(announcementTitle.trim(), announcementBody.trim());
    if (posted) {
      setAnnouncementTitle('');
      setAnnouncementBody('');
    }
    setPostingAnnouncement(false);
  };

  const deleteAnnouncement = async (announcement: Announcement) => {
    if (!window.confirm(`Delete the announcement “${announcement.title}”?`)) return;
    setDeletingAnnouncementId(announcement.id);
    await onDeleteAnnouncement(announcement.id);
    setDeletingAnnouncementId(null);
  };

  const toggleStat = (label: string) => {
    setExpandedStats((current) => {
      const next = new Set(current);
      if (next.has(label)) next.delete(label);
      else next.add(label);
      return next;
    });
  };

  const toggleOverviewSection = (section: string) => {
    setExpandedOverviewSections((current) => {
      const next = new Set(current);
      if (next.has(section)) next.delete(section);
      else next.add(section);
      return next;
    });
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <StatCard value={String(userCount)} label="Users" icon={<Users className="h-4 w-4" />} expanded={expandedStats.has('Users')} onClick={() => toggleStat('Users')} />
        <StatCard value={String(topicCount)} label="Topics" icon={<Layers className="h-4 w-4" />} color="text-gold" expanded={expandedStats.has('Topics')} onClick={() => toggleStat('Topics')} />
        <StatCard value={String(lessonCount)} label="Lessons" icon={<BookOpen className="h-4 w-4" />} color="text-teal" expanded={expandedStats.has('Lessons')} onClick={() => toggleStat('Lessons')} />
        <StatCard value={String(questionCount)} label="Questions" icon={<GraduationCap className="h-4 w-4" />} color="text-rust" expanded={expandedStats.has('Questions')} onClick={() => toggleStat('Questions')} />
        <StatCard value={String(materialCount)} label="Materials" icon={<FileText className="h-4 w-4" />} color="text-gold" expanded={expandedStats.has('Materials')} onClick={() => toggleStat('Materials')} />
        <StatCard value={String(approvedMaterials)} label="Approved" icon={<Check className="h-4 w-4" />} color="text-teal" expanded={expandedStats.has('Approved')} onClick={() => toggleStat('Approved')} />
      </div>

      <div className="card-board p-5">
        <div className="flex items-center gap-2 mb-4">
          <Megaphone className="h-4 w-4 text-gold" />
          <h3 className="font-display text-base font-semibold text-chalk">Post an announcement</h3>
        </div>
        <div className="grid gap-3 lg:grid-cols-[0.7fr_1.3fr_auto] items-end">
          <input
            value={announcementTitle}
            onChange={(event) => setAnnouncementTitle(event.target.value)}
            placeholder="Announcement title"
            className="form-input"
          />
          <textarea
            value={announcementBody}
            onChange={(event) => setAnnouncementBody(event.target.value)}
            placeholder="Write a message for pupils..."
            rows={2}
            className="form-input resize-y"
          />
          <button
            type="button"
            onClick={submitAnnouncement}
            disabled={postingAnnouncement || !announcementTitle.trim() || !announcementBody.trim()}
            className="btn-gold whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {postingAnnouncement ? 'Posting...' : 'Post announcement'}
          </button>
        </div>
        {announcements.length > 0 && (
          <div className="mt-4 space-y-2">
            <p className="text-xs uppercase tracking-widest text-muted-board">Recent announcements</p>
            {announcements.slice(0, 3).map((announcement) => (
              <div key={announcement.id} className="border border-white/10 rounded-lg px-3 py-2 flex items-start gap-3">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-chalk">{announcement.title}</p>
                  <p className="text-xs text-muted-board mt-1 whitespace-pre-wrap">{announcement.body}</p>
                </div>
                <button
                  type="button"
                  onClick={() => deleteAnnouncement(announcement)}
                  disabled={deletingAnnouncementId === announcement.id}
                  aria-label={`Delete ${announcement.title}`}
                  title="Delete announcement"
                  className="shrink-0 rounded-md p-1.5 text-muted-board hover:bg-rust/15 hover:text-rust disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="card-board p-5">
          <button type="button" onClick={() => toggleOverviewSection('users-by-form')} aria-expanded={expandedOverviewSections.has('users-by-form')} className="w-full flex items-center justify-between text-left mb-4">
            <span className="font-display text-base font-semibold text-chalk">Users by Form</span>
            <ChevronDown className={`h-4 w-4 text-muted-board transition-transform ${expandedOverviewSections.has('users-by-form') ? 'rotate-180' : ''}`} />
          </button>
          {expandedOverviewSections.has('users-by-form') && <div className="space-y-3 animate-slide-up">
            {FORMS.map((g) => {
              const count = usersByGrade[g] || 0;
              const pct = (count / maxGradeCount) * 100;
              return (
                <div key={g} className="flex items-center gap-3">
                  <span className="text-xs text-muted-board font-mono-sc w-16 shrink-0">Form {g}</span>
                  <div className="flex-1 track"><div className="track-fill" style={{ width: `${pct}%`, background: 'hsl(41 76% 60%)' }} /></div>
                  <span className="text-xs text-chalk font-mono-sc w-8 text-right">{count}</span>
                </div>
              );
            })}
          </div>}
        </div>

        <div className="card-board p-5">
          <button type="button" onClick={() => toggleOverviewSection('topics-by-subject')} aria-expanded={expandedOverviewSections.has('topics-by-subject')} className="w-full flex items-center justify-between text-left mb-4">
            <span className="font-display text-base font-semibold text-chalk">Topics by Subject</span>
            <ChevronDown className={`h-4 w-4 text-muted-board transition-transform ${expandedOverviewSections.has('topics-by-subject') ? 'rotate-180' : ''}`} />
          </button>
          {expandedOverviewSections.has('topics-by-subject') && <div className="space-y-3 animate-slide-up">
            {topicsBySubject.map((s) => {
              const pct = (s.count / maxTopicCount) * 100;
              return (
                <div key={s.subject} className="flex items-center gap-3">
                  <span className="text-xs text-muted-board w-24 shrink-0 truncate">{s.subject}</span>
                  <div className="flex-1 track"><div className="track-fill" style={{ width: `${pct}%`, background: s.color }} /></div>
                  <span className="text-xs text-chalk font-mono-sc w-8 text-right">{s.count}</span>
                </div>
              );
            })}
          </div>}
        </div>
      </div>

      <button
        type="button"
        onClick={() => setShowDetails((visible) => !visible)}
        aria-expanded={showDetails}
        className="w-full flex items-center justify-between border-b border-gold/30 py-2 text-left text-sm font-semibold text-gold hover:text-chalk transition-colors"
      >
        <span>More dashboard details</span>
        <ChevronDown className={`h-4 w-4 transition-transform ${showDetails ? 'rotate-180' : ''}`} />
      </button>

      {showDetails && <>
      {/* Activity Feed + Recent Signups */}
      <div className="grid gap-4 lg:grid-cols-2 animate-slide-up">
        <div className="card-board p-5">
          <div className="flex items-center gap-2 mb-4">
            <button type="button" onClick={() => toggleOverviewSection('recent-activity')} aria-expanded={expandedOverviewSections.has('recent-activity')} className="w-full flex items-center gap-2 text-left">
              <Activity className="h-4 w-4 text-gold" />
              <span className="font-display text-base font-semibold text-chalk">Recent Activity</span>
              <ChevronDown className={`ml-auto h-4 w-4 text-muted-board transition-transform ${expandedOverviewSections.has('recent-activity') ? 'rotate-180' : ''}`} />
            </button>
          </div>
          {expandedOverviewSections.has('recent-activity') && <div className="animate-slide-up">
          {activityFeed.length === 0 ? (
            <p className="text-muted-board text-sm text-center py-4">No activity yet.</p>
          ) : (
            <div className="space-y-2 max-h-64 overflow-y-auto scrollbar-thin">
              {activityFeed.map((a) => (
                <div key={a.id} className="flex items-start gap-2 text-xs border-b border-white/5 pb-2">
                  {a.type === 'lesson_completed' ? <Award className="h-3.5 w-3.5 text-teal shrink-0 mt-0.5" /> : <Clock className="h-3.5 w-3.5 text-gold shrink-0 mt-0.5" />}
                  <div className="flex-1 min-w-0">
                    <span className="text-chalk font-medium">{a.user_name}</span>{' '}
                    <span className="text-muted-board">{a.type === 'lesson_completed' ? 'completed' : 'answered'}</span>{' '}
                    <span className="text-chalk/80 truncate">{a.detail}</span>
                  </div>
                  <span className="text-muted-board/60 shrink-0">{timeAgo(a.timestamp)}</span>
                </div>
              ))}
            </div>
          )}
          </div>}
        </div>

        <div className="card-board p-5">
          <div className="flex items-center gap-2 mb-4">
            <button type="button" onClick={() => toggleOverviewSection('recent-signups')} aria-expanded={expandedOverviewSections.has('recent-signups')} className="w-full flex items-center gap-2 text-left">
              <UserPlus className="h-4 w-4 text-teal" />
              <span className="font-display text-base font-semibold text-chalk">Recent Signups</span>
              <ChevronDown className={`ml-auto h-4 w-4 text-muted-board transition-transform ${expandedOverviewSections.has('recent-signups') ? 'rotate-180' : ''}`} />
            </button>
          </div>
          {expandedOverviewSections.has('recent-signups') && <div className="animate-slide-up">
          {recentSignups.length === 0 ? (
            <p className="text-muted-board text-sm text-center py-4">No users yet.</p>
          ) : (
            <div className="space-y-2">
              {recentSignups.map((u) => (
                <div key={u.id} className="flex items-center gap-3 text-sm border-b border-white/5 pb-2">
                  <div className="w-8 h-8 rounded-full bg-gold/20 border border-gold/30 flex items-center justify-center text-xs font-bold text-gold shrink-0">
                    {u.full_name.split(' ').map((n) => n[0]).slice(0, 2).join('')}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-chalk font-medium truncate">{u.full_name}</p>
                    <p className="text-xs text-muted-board">Form {u.grade}</p>
                  </div>
                  <span className="text-xs text-muted-board/60 shrink-0">{timeAgo(u.created_at)}</span>
                </div>
              ))}
            </div>
          )}
          </div>}
        </div>
      </div>

      <div className="card-board p-5">
        <h3 className="font-display text-base font-semibold text-chalk mb-3">Platform Health</h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <HealthCheck label="Curriculum Sync" status={approvedMaterials > 0 ? 'ok' : 'warning'} detail={`${approvedMaterials} approved`} />
          <HealthCheck label="Content Coverage" status={topicCount > 0 ? 'ok' : 'error'} detail={`${topicCount} topics`} />
          <HealthCheck label="Practice Questions" status={questionCount > 0 ? 'ok' : 'warning'} detail={`${questionCount} questions`} />
          <HealthCheck label="User Registrations" status={userCount > 0 ? 'ok' : 'warning'} detail={`${userCount} users`} />
        </div>
      </div>
      </>}
    </div>
  );
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

function StatCard({ value, label, icon, color = 'text-chalk', expanded, onClick }: { value: string; label: string; icon: React.ReactNode; color?: string; expanded: boolean; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} aria-expanded={expanded} className="card-board px-4 py-3 min-w-[120px] text-left hover:border-gold/50 transition-colors">
      <div className={`flex items-center gap-1.5 ${color} mb-1`}>{icon}</div>
      {expanded && <div className="font-mono-sc text-xl font-bold text-chalk">{value}</div>}
      <div className="text-xs text-muted-board">{label}</div>
    </button>
  );
}

function HealthCheck({ label, status, detail }: { label: string; status: 'ok' | 'warning' | 'error'; detail: string }) {
  const colors = {
    ok: 'text-teal border-teal/30 bg-teal/5',
    warning: 'text-gold border-gold/30 bg-gold/5',
    error: 'text-rust border-rust/30 bg-rust/5',
  };
  const icons = {
    ok: <Check className="h-3.5 w-3.5" />,
    warning: <Loader2 className="h-3.5 w-3.5" />,
    error: <AlertCircle className="h-3.5 w-3.5" />,
  };
  return (
    <div className={`border rounded-lg p-3 ${colors[status]}`}>
      <div className="flex items-center gap-1.5 mb-1">{icons[status]}<span className="text-xs font-semibold">{label}</span></div>
      <p className="text-xs text-muted-board">{detail}</p>
    </div>
  );
}
