'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/components/auth-provider';
import { supabase } from '@/lib/supabase-client';
import { Loader as Loader2, User, Lock, Mail } from 'lucide-react';
import { toast } from 'sonner';

const FORMS = [1, 2, 3, 4, 5, 6];

export default function AccountPage() {
  const { user, profile, refreshProfile } = useAuth();

  const [fullName, setFullName] = useState('');
  const [school, setSchool] = useState('');
  const [form, setForm] = useState(1);
  const [parentEmail, setParentEmail] = useState('');
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [savingProfile, setSavingProfile] = useState(false);

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [savingPassword, setSavingPassword] = useState(false);

  useEffect(() => {
    if (profile) {
      setFullName(profile.full_name || '');
      setSchool(profile.school || '');
      setForm(profile.grade || 1);
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
    </div>
  );
}
