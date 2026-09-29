'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/auth-provider';
import { supabase } from '@/lib/supabase-client';
import { exportAllUserData, downloadJson } from '@/lib/exportUserData';
import { Loader as Loader2, User, Lock, Mail, Download, TriangleAlert } from 'lucide-react';
import { toast } from 'sonner';

const FORMS = [1, 2, 3, 4, 5, 6];

export default function AccountPage() {
  const { user, profile, refreshProfile } = useAuth();
  const router = useRouter();

  const [fullName, setFullName] = useState('');
  const [school, setSchool] = useState('');
  const [form, setForm] = useState(1);
  const [preferredLanguage, setPreferredLanguage] = useState('en');
  const [parentEmail, setParentEmail] = useState('');
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [savingProfile, setSavingProfile] = useState(false);

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [savingPassword, setSavingPassword] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [deletingAccount, setDeletingAccount] = useState(false);

  useEffect(() => {
    if (profile) {
      setFullName(profile.full_name || '');
      setSchool(profile.school || '');
      setForm(profile.grade || 1);
      setPreferredLanguage(profile.preferred_language || 'en');
      setParentEmail(profile.parent_email || '');
      setNotificationsEnabled(profile.email_notifications_enabled ?? true);
    }
  }, [profile]);

  async function handleSaveProfile() {
    if (!user) return;
    if (!fullName.trim()) {
      toast.error('Name is required.');
      return;
    }
    setSavingProfile(true);
    // Note: this update intentionally never includes `role` — even if it
    // did, a database trigger (prevent_self_role_escalation) silently
    // keeps role unchanged for anyone who isn't already an admin, so this
    // form can't be used to self-promote no matter what it submits.
    const { error } = await supabase
      .from('profiles')
      .update({
        full_name: fullName.trim(),
        school: school.trim() || null,
        grade: form,
        preferred_language: preferredLanguage,
        parent_email: parentEmail.trim() || null,
        email_notifications_enabled: notificationsEnabled,
      })
      .eq('id', user.id);
    setSavingProfile(false);
    if (error) {
      toast.error('Failed to update profile.');
      return;
    }
    await refreshProfile();
    toast.success('Profile updated.');
  }

  async function handleChangePassword() {
    if (!newPassword || newPassword.length < 6) {
      toast.error('New password must be at least 6 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("Passwords don't match.");
      return;
    }
    setSavingPassword(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setSavingPassword(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setNewPassword('');
    setConfirmPassword('');
    toast.success('Password changed.');
  }

  // Real data portability — everything the pupil's own account owns
  // across the platform, RLS-scoped to their own rows automatically
  // (see lib/exportUserData.ts), not just the progress export already
  // available from /progress.
  async function handleExportData() {
    if (!user) return;
    setExporting(true);
    try {
      const data = await exportAllUserData(user.id);
      const dateStr = new Date().toISOString().slice(0, 10);
      downloadJson(`smartclass-my-data-${dateStr}.json`, data);
      toast.success('Your data has been downloaded.');
    } catch (e) {
      toast.error('Failed to export your data. Please try again.');
    } finally {
      setExporting(false);
    }
  }

  // Genuine self-service deletion — not admin-triggered. Calls the same
  // delete-user-account function the admin panel uses, which allows a
  // caller to delete their own account without needing admin privileges
  // (see the function's own comment for why one function serves both
  // cases). Irreversible — the typed "DELETE" confirmation below is the
  // real safeguard, this function doesn't ask again.
  async function handleDeleteMyAccount() {
    if (!user || deleteConfirmText !== 'DELETE') return;
    setDeletingAccount(true);
    try {
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
      const { data: { session: authSession } } = await supabase.auth.getSession();
      if (!authSession) { toast.error('Please log in again.'); setDeletingAccount(false); return; }

      const response = await fetch(`${supabaseUrl}/functions/v1/delete-user-account`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authSession.access_token}` },
        body: JSON.stringify({ userId: user.id }),
      });
      const data = await response.json();
      if (!response.ok) {
        toast.error(data.error || 'Failed to delete your account.');
        setDeletingAccount(false);
        return;
      }
      await supabase.auth.signOut();
      router.push('/login');
    } catch {
      toast.error('Failed to delete your account. Please try again.');
      setDeletingAccount(false);
    }
  }

  if (!profile) {
    return <div className="flex h-72 items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-gold" /></div>;
  }

  return (
    <div className="space-y-6 animate-fade-in max-w-xl">
      <div>
        <h1 className="font-display text-xl font-semibold text-chalk mb-1">My Account</h1>
        <p className="text-sm text-muted-board">Update your details or change your password.</p>
      </div>

      <div className="card-board p-5">
        <div className="flex items-center gap-2 mb-4">
          <User className="h-5 w-5 text-gold" />
          <h2 className="font-display text-lg font-semibold text-chalk">Profile</h2>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-xs uppercase tracking-widest text-muted-board font-semibold mb-1.5">Email</label>
            <input
              type="email"
              value={user?.email || ''}
              disabled
              className="w-full px-3 py-2.5 rounded-lg border border-white/10 bg-white/5 text-muted-board font-sans text-sm cursor-not-allowed"
            />
            <p className="text-xs text-muted-board mt-1">Contact support to change your email address.</p>
          </div>

          <div>
            <label className="block text-xs uppercase tracking-widest text-muted-board font-semibold mb-1.5">Full name</label>
            <input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              disabled={savingProfile}
              className="w-full px-3 py-2.5 rounded-lg border border-white/15 bg-white/5 text-chalk placeholder:text-muted-board font-sans text-sm focus:outline-none focus:ring-1 focus:ring-gold"
            />
          </div>

          <div>
            <label className="block text-xs uppercase tracking-widest text-muted-board font-semibold mb-1.5">
              School <span className="normal-case font-normal text-muted-board/70">(optional)</span>
            </label>
            <input
              type="text"
              value={school}
              onChange={(e) => setSchool(e.target.value)}
              disabled={savingProfile}
              placeholder="e.g. Kabulonga Girls Secondary School"
              className="w-full px-3 py-2.5 rounded-lg border border-white/15 bg-white/5 text-chalk placeholder:text-muted-board font-sans text-sm focus:outline-none focus:ring-1 focus:ring-gold"
            />
          </div>

          <div>
            <label className="block text-xs uppercase tracking-widest text-muted-board font-semibold mb-1.5">Form</label>
            <div className="flex flex-wrap gap-2">
              {FORMS.map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => setForm(f)}
                  disabled={savingProfile}
                  className={`grade-chip-board py-2 px-3.5 ${form === f ? 'active' : ''}`}
                >
                  Form {f}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs uppercase tracking-widest text-muted-board font-semibold mb-1.5">
              Teaching Language <span className="normal-case font-normal text-gold">(beta)</span>
            </label>
            <select
              value={preferredLanguage}
              onChange={(e) => setPreferredLanguage(e.target.value)}
              disabled={savingProfile}
              className="w-full px-3 py-2.5 rounded-lg border border-white/15 bg-white/5 text-chalk font-sans text-sm focus:outline-none focus:ring-1 focus:ring-gold"
            >
              <option value="en">English</option>
              <option value="bem">Bemba</option>
              <option value="nya">Nyanja</option>
              <option value="toi">Tonga</option>
              <option value="loz">Lozi</option>
            </select>
            <p className="text-xs text-muted-board mt-1">
              Your teacher will try to respond mainly in this language, mixing in English for technical terms
              where that's natural. Quality in local languages is still new — switch back to English any time if
              it's not reading clearly.
            </p>
          </div>

          <button
            onClick={handleSaveProfile}
            disabled={savingProfile}
            className="btn-gold px-5 py-2.5 flex items-center gap-2"
          >
            {savingProfile ? <><Loader2 className="h-4 w-4 animate-spin" /> Saving...</> : 'Save changes'}
          </button>
        </div>
      </div>

      <div className="card-board p-5">
        <div className="flex items-center gap-2 mb-4">
          <Mail className="h-5 w-5 text-gold" />
          <h2 className="font-display text-lg font-semibold text-chalk">Notifications</h2>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-xs uppercase tracking-widest text-muted-board font-semibold mb-1.5">
              Parent/guardian email <span className="normal-case font-normal text-muted-board/70">(optional)</span>
            </label>
            <input
              type="email"
              value={parentEmail}
              onChange={(e) => setParentEmail(e.target.value)}
              disabled={savingProfile}
              placeholder="parent@example.com"
              className="w-full px-3 py-2.5 rounded-lg border border-white/15 bg-white/5 text-chalk placeholder:text-muted-board font-sans text-sm focus:outline-none focus:ring-1 focus:ring-gold"
            />
            <p className="text-xs text-muted-board mt-1">
              If set, the weekly progress digest goes here instead of your own email.
            </p>
          </div>

          <label className="flex items-center gap-2.5 cursor-pointer">
            <input
              type="checkbox"
              checked={notificationsEnabled}
              onChange={(e) => setNotificationsEnabled(e.target.checked)}
              disabled={savingProfile}
              className="h-4 w-4 rounded border-white/30 accent-gold"
            />
            <span className="text-sm text-chalk">Send me a weekly progress email</span>
          </label>

          <button
            onClick={handleSaveProfile}
            disabled={savingProfile}
            className="btn-gold px-5 py-2.5 flex items-center gap-2"
          >
            {savingProfile ? <><Loader2 className="h-4 w-4 animate-spin" /> Saving...</> : 'Save changes'}
          </button>
        </div>
      </div>

      <div className="card-board p-5">
        <div className="flex items-center gap-2 mb-4">
          <Lock className="h-5 w-5 text-gold" />
          <h2 className="font-display text-lg font-semibold text-chalk">Change Password</h2>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-xs uppercase tracking-widest text-muted-board font-semibold mb-1.5">New password</label>
            <input
              type="password"
              placeholder="At least 6 characters"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              disabled={savingPassword}
              className="w-full px-3 py-2.5 rounded-lg border border-white/15 bg-white/5 text-chalk placeholder:text-muted-board font-sans text-sm focus:outline-none focus:ring-1 focus:ring-gold"
            />
          </div>
          <div>
            <label className="block text-xs uppercase tracking-widest text-muted-board font-semibold mb-1.5">Confirm new password</label>
            <input
              type="password"
              placeholder="Type it again"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              disabled={savingPassword}
              className="w-full px-3 py-2.5 rounded-lg border border-white/15 bg-white/5 text-chalk placeholder:text-muted-board font-sans text-sm focus:outline-none focus:ring-1 focus:ring-gold"
            />
          </div>
          <button
            onClick={handleChangePassword}
            disabled={savingPassword}
            className="btn-gold px-5 py-2.5 flex items-center gap-2"
          >
            {savingPassword ? <><Loader2 className="h-4 w-4 animate-spin" /> Updating...</> : 'Change password'}
          </button>
        </div>
      </div>

      <div className="card-board p-5">
        <div className="flex items-center gap-2 mb-4">
          <Download className="h-5 w-5 text-gold" />
          <h2 className="font-display text-lg font-semibold text-chalk">Your Data</h2>
        </div>
        <p className="text-sm text-muted-board mb-3">
          Download everything your account owns — profile, progress, mastery, subscription and payment history,
          and your practice/chat activity — as a single file.
        </p>
        <button
          onClick={handleExportData}
          disabled={exporting}
          className="border border-white/15 text-chalk text-sm rounded-lg px-4 py-2 hover:bg-white/5 transition-colors flex items-center gap-2"
        >
          {exporting ? <><Loader2 className="h-4 w-4 animate-spin" /> Preparing...</> : <><Download className="h-4 w-4" /> Download my data</>}
        </button>
      </div>

      <div className="card-board p-5 border-2 border-rust/30">
        <div className="flex items-center gap-2 mb-2">
          <TriangleAlert className="h-5 w-5 text-rust" />
          <h2 className="font-display text-lg font-semibold text-chalk">Delete My Account</h2>
        </div>
        <p className="text-sm text-muted-board mb-3">
          <strong className="text-rust">Permanent and irreversible.</strong> Deletes your account and everything
          tied to it — progress, lessons, subscription — right away. Consider downloading your data above first,
          since there's no way to get it back afterward. Type <code className="text-gold">DELETE</code> below to
          enable the button.
        </p>
        <div className="flex gap-2">
          <input
            type="text"
            value={deleteConfirmText}
            onChange={(e) => setDeleteConfirmText(e.target.value)}
            placeholder='Type "DELETE" to confirm'
            disabled={deletingAccount}
            className="flex-1 bg-white/5 border border-rust/40 rounded-lg px-3 py-2 text-sm text-chalk placeholder:text-muted-board focus:outline-none focus:ring-1 focus:ring-rust"
          />
          <button
            onClick={handleDeleteMyAccount}
            disabled={deleteConfirmText !== 'DELETE' || deletingAccount}
            className="bg-rust text-chalk text-sm font-semibold px-4 py-2 rounded-lg disabled:opacity-30 disabled:cursor-not-allowed shrink-0 flex items-center gap-2"
          >
            {deletingAccount ? <><Loader2 className="h-4 w-4 animate-spin" /> Deleting...</> : 'Delete My Account'}
          </button>
        </div>
      </div>
    </div>
  );
}
