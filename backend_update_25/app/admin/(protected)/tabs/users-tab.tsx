import { UserProfile, FORMS } from './constants';
import { Users, Shield, Search, X, Award, BookOpen, Target, Clock, Download } from 'lucide-react';
import { buildCsv, downloadCsv } from '@/lib/exportCsv';

function exportUserProgressCsv(user: UserProfile, progress: any[]) {
  const rows = progress.map((p) => [
    p.topic?.name || 'Unknown',
    Number(p.mastery_percentage),
    p.lessons_completed,
    p.total_attempts,
    p.correct_attempts,
    p.total_attempts ? Math.round((p.correct_attempts / p.total_attempts) * 100) : '',
  ]);
  const csv = buildCsv(
    ['Topic', 'Mastery %', 'Lessons Completed', 'Questions Answered', 'Correct Answers', 'Accuracy %'],
    rows
  );
  const dateStr = new Date().toISOString().slice(0, 10);
  downloadCsv(`smartclass-progress-${user.full_name.replace(/\s+/g, '-').toLowerCase()}-${dateStr}.csv`, csv);
}

export function UsersTab({
  users, userSearch, setUserSearch, userGradeFilter, setUserGradeFilter,
  toggleUserRole, currentUserId, selectedUser, setSelectedUser,
  openUserDetail, userProgress, userSessions, onApproveTeacher,
}: {
  users: UserProfile[]; userSearch: string; setUserSearch: (v: string) => void;
  userGradeFilter: number | null; setUserGradeFilter: (v: number | null) => void;
  toggleUserRole: (id: string, role: string) => void; currentUserId?: string;
  selectedUser: UserProfile | null; setSelectedUser: (u: UserProfile | null) => void;
  openUserDetail: (u: UserProfile) => void; userProgress: any[]; userSessions: any[];
  onApproveTeacher: (id: string) => void;
}) {
  const pendingTeachers = users.filter((u: any) => u.role === 'teacher' && !u.teacher_approved);
  const filtered = users.filter((u) => {
    const matchSearch = !userSearch || u.full_name.toLowerCase().includes(userSearch.toLowerCase());
    const matchGrade = userGradeFilter === null || u.grade === userGradeFilter;
    return matchSearch && matchGrade;
  });

  return (
    <div className="space-y-4">
      {pendingTeachers.length > 0 && (
        <div className="card-board p-4 border-2 border-gold/40">
          <h3 className="font-display text-sm font-semibold text-chalk mb-1">
            {pendingTeachers.length} teacher account{pendingTeachers.length > 1 ? 's' : ''} pending approval
          </h3>
          <p className="text-xs text-muted-board mb-3">
            Teacher access shows aggregated pupil performance for their school — approve only accounts you can
            actually verify belong to a real teacher there.
          </p>
          <div className="space-y-2">
            {pendingTeachers.map((t: any) => (
              <div key={t.id} className="flex items-center justify-between text-sm bg-white/5 rounded-lg px-3 py-2">
                <div>
                  <span className="text-chalk font-medium">{t.full_name}</span>
                  <span className="text-xs text-muted-board ml-2">{t.school || 'No school set'}</span>
                </div>
                <button
                  onClick={() => onApproveTeacher(t.id)}
                  className="btn-gold text-xs px-3 py-1.5"
                >
                  Approve
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="card-board px-3 py-2 flex items-center gap-2 flex-1 min-w-[200px]">
          <Search className="h-4 w-4 text-gold shrink-0" />
          <input type="text" value={userSearch} onChange={(e) => setUserSearch(e.target.value)}
            placeholder="Search by name..." className="flex-1 bg-transparent text-chalk placeholder:text-muted-board text-sm focus:outline-none" />
        </div>
        <div className="flex gap-1">
          <button onClick={() => setUserGradeFilter(null)}
            className={`text-xs px-3 py-2 rounded-lg border transition-colors ${userGradeFilter === null ? 'border-gold text-gold bg-gold/10' : 'border-white/10 text-muted-board hover:text-chalk'}`}>
            All
          </button>
          {FORMS.map((g) => (
            <button key={g} onClick={() => setUserGradeFilter(g)}
              className={`text-xs px-3 py-2 rounded-lg border transition-colors ${userGradeFilter === g ? 'border-gold text-gold bg-gold/10' : 'border-white/10 text-muted-board hover:text-chalk'}`}>
              F{g}
            </button>
          ))}
        </div>
      </div>

      {/* Stats */}
      <div className="flex gap-4 flex-wrap">
        <div className="card-board px-4 py-3 min-w-[120px]">
          <div className="flex items-center gap-1.5 text-chalk mb-1"><Users className="h-4 w-4" /></div>
          <div className="font-mono-sc text-xl font-bold text-chalk">{users.length}</div>
          <div className="text-xs text-muted-board">Total Users</div>
        </div>
        <div className="card-board px-4 py-3 min-w-[120px]">
          <div className="flex items-center gap-1.5 text-gold mb-1"><Shield className="h-4 w-4" /></div>
          <div className="font-mono-sc text-xl font-bold text-chalk">{users.filter((u) => u.role === 'admin').length}</div>
          <div className="text-xs text-muted-board">Admins</div>
        </div>
        <div className="card-board px-4 py-3 min-w-[120px]">
          <div className="flex items-center gap-1.5 text-teal mb-1"><Search className="h-4 w-4" /></div>
          <div className="font-mono-sc text-xl font-bold text-chalk">{filtered.length}</div>
          <div className="text-xs text-muted-board">Showing</div>
        </div>
      </div>

      {/* Users table */}
      <div className="card-board overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/10 text-left text-xs text-muted-board uppercase tracking-widest">
                <th className="px-4 py-3 font-semibold">Name</th>
                <th className="px-4 py-3 font-semibold">Form</th>
                <th className="px-4 py-3 font-semibold">School</th>
                <th className="px-4 py-3 font-semibold">Role</th>
                <th className="px-4 py-3 font-semibold">Joined</th>
                <th className="px-4 py-3 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-muted-board">No users found.</td></tr>
              ) : (
                filtered.map((u) => (
                  <tr key={u.id} className="border-b border-white/5 hover:bg-white/5 transition-colors cursor-pointer" onClick={() => openUserDetail(u)}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-gold/20 border border-gold/30 flex items-center justify-center text-xs font-bold text-gold shrink-0">
                          {u.full_name.split(' ').map((n) => n[0]).slice(0, 2).join('')}
                        </div>
                        <span className="font-medium text-chalk">{u.full_name}</span>
                        {u.id === currentUserId && <span className="text-xs text-teal">(you)</span>}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-muted-board">Form {u.grade}</td>
                    <td className="px-4 py-3 text-muted-board">{u.school || '—'}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs font-semibold rounded-full px-2.5 py-0.5 border ${u.role === 'admin' ? 'text-gold border-gold/40 bg-gold/10' : 'text-muted-board border-white/20'}`}>
                        {u.role}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-muted-board text-xs">{new Date(u.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</td>
                    <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                      <button onClick={() => toggleUserRole(u.id, u.role)} disabled={u.id === currentUserId}
                        className="text-xs border border-white/10 text-muted-board hover:text-gold rounded-lg px-2.5 py-1 transition-colors disabled:opacity-30 disabled:cursor-not-allowed">
                        {u.role === 'admin' ? 'Make Pupil' : 'Make Admin'}
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* User detail drawer */}
      {selectedUser && (
        <div className="fixed inset-0 z-50 flex justify-end" onClick={() => setSelectedUser(null)}>
          <div className="absolute inset-0 bg-black/50 animate-fade-in" />
          <div className="relative w-full max-w-md bg-board-deep border-l border-white/10 overflow-y-auto animate-slide-in-right" onClick={(e) => e.stopPropagation()}>
            <div className="sticky top-0 bg-board-deep border-b border-white/10 px-5 py-4 flex items-center justify-between">
              <h3 className="font-display text-lg font-semibold text-chalk">User Details</h3>
              <button onClick={() => setSelectedUser(null)} className="p-1.5 text-muted-board hover:text-chalk"><X className="h-5 w-5" /></button>
            </div>
            <div className="p-5 space-y-5">
              {/* Profile */}
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-full bg-gold/20 border-2 border-gold/40 flex items-center justify-center text-lg font-bold text-gold">
                  {selectedUser.full_name.split(' ').map((n) => n[0]).slice(0, 2).join('')}
                </div>
                <div>
                  <p className="font-semibold text-chalk text-lg">{selectedUser.full_name}</p>
                  <p className="text-sm text-muted-board">Form {selectedUser.grade} &middot; {selectedUser.role}</p>
                  {selectedUser.school && <p className="text-xs text-muted-board/70">{selectedUser.school}</p>}
                  <p className="text-xs text-muted-board/70">Joined {new Date(selectedUser.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
                </div>
              </div>

              {/* Progress stats */}
              <div className="grid grid-cols-3 gap-3">
                <div className="card-board p-3 text-center">
                  <BookOpen className="mx-auto h-4 w-4 text-teal mb-1" />
                  <p className="font-mono-sc text-lg font-bold text-chalk">{userProgress.reduce((s, p) => s + p.lessons_completed, 0)}</p>
                  <p className="text-xs text-muted-board">Lessons</p>
                </div>
                <div className="card-board p-3 text-center">
                  <Target className="mx-auto h-4 w-4 text-gold mb-1" />
                  <p className="font-mono-sc text-lg font-bold text-chalk">{userProgress.reduce((s, p) => s + p.total_attempts, 0)}</p>
                  <p className="text-xs text-muted-board">Attempts</p>
                </div>
                <div className="card-board p-3 text-center">
                  <Award className="mx-auto h-4 w-4 text-rust mb-1" />
                  <p className="font-mono-sc text-lg font-bold text-chalk">
                    {userProgress.length > 0 ? Math.round(userProgress.reduce((s, p) => s + Number(p.mastery_percentage), 0) / userProgress.length) : 0}%
                  </p>
                  <p className="text-xs text-muted-board">Avg Mastery</p>
                </div>
              </div>

              {/* Topic progress */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-sm font-semibold text-chalk">Topic Progress</h4>
                  {userProgress.length > 0 && (
                    <button
                      onClick={() => exportUserProgressCsv(selectedUser, userProgress)}
                      className="flex items-center gap-1 text-xs text-gold hover:underline"
                    >
                      <Download className="h-3 w-3" /> Export CSV
                    </button>
                  )}
                </div>
                {userProgress.length === 0 ? (
                  <p className="text-muted-board text-sm text-center py-4">No progress data yet.</p>
                ) : (
                  <div className="space-y-2 max-h-48 overflow-y-auto scrollbar-thin">
                    {userProgress.map((p) => {
                      const mastery = Number(p.mastery_percentage);
                      const color = mastery >= 70 ? 'hsl(163 34% 36%)' : mastery >= 40 ? 'hsl(41 76% 60%)' : 'hsl(17 59% 45%)';
                      return (
                        <div key={p.id} className="border border-white/10 rounded-lg p-3">
                          <div className="flex justify-between text-xs mb-1">
                            <span className="text-chalk font-medium">{p.topic?.name || 'Unknown'}</span>
                            <span className="text-muted-board font-mono-sc">{mastery}%</span>
                          </div>
                          <div className="track"><div className="track-fill" style={{ width: `${mastery}%`, background: color }} /></div>
                          <div className="flex gap-3 mt-1 text-xs text-muted-board">
                            <span>{p.lessons_completed} lessons</span>
                            <span>{p.total_attempts} attempts</span>
                            <span>{p.correct_attempts} correct</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Recent sessions */}
              <div>
                <h4 className="text-sm font-semibold text-chalk mb-2">Recent Sessions</h4>
                {userSessions.length === 0 ? (
                  <p className="text-muted-board text-sm text-center py-4">No sessions yet.</p>
                ) : (
                  <div className="space-y-2 max-h-48 overflow-y-auto scrollbar-thin">
                    {userSessions.map((s) => (
                      <div key={s.id} className="flex items-center gap-2 text-xs border border-white/10 rounded-lg p-2">
                        <Clock className="h-3.5 w-3.5 text-gold shrink-0" />
                        <span className="text-chalk flex-1 truncate">{s.lesson?.title || 'Lesson'}</span>
                        <span className={`shrink-0 ${s.status === 'completed' ? 'text-teal' : 'text-gold'}`}>{s.status}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Role toggle */}
              <button
                onClick={() => toggleUserRole(selectedUser.id, selectedUser.role)}
                disabled={selectedUser.id === currentUserId}
                className="w-full text-sm border border-white/10 text-muted-board hover:text-gold rounded-lg py-2 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
              >
                {selectedUser.role === 'admin' ? 'Demote to Pupil' : 'Promote to Admin'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
