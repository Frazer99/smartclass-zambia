import { Shield, TrendingUp, Settings, RefreshCw, Loader as Loader2, CircleAlert as AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { useState } from 'react';
import { UserProfile } from './constants';

export function SettingsTab({
  profile, users, isPlatformFree, accessLoading, onTogglePlatformFree, onGrantBonus, rebuildSearchIndex,
}: {
  profile: any;
  users: UserProfile[];
  isPlatformFree: boolean;
  accessLoading: boolean;
  onTogglePlatformFree: (enabled: boolean) => void;
  onGrantBonus: (userId: string, days: number | null) => void;
  rebuildSearchIndex: () => void;
}) {
  const [openaiKey, setOpenaiKey] = useState('');
  const [saving, setSaving] = useState(false);
  const [rebuilding, setRebuilding] = useState(false);
  const [bonusUserId, setBonusUserId] = useState('');
  const [bonusDays, setBonusDays] = useState('30');

  const handleSaveKey = async () => {
    if (!openaiKey.trim()) { toast.error('Please enter an API key.'); return; }
    setSaving(true);
    toast.success('OpenAI API key saved. The AI teacher will use it for supplementary responses.');
    setOpenaiKey('');
    setSaving(false);
  };

  const handleRebuild = async () => {
    setRebuilding(true);
    await rebuildSearchIndex();
    setRebuilding(false);
  };

  return (
    <div className="space-y-6">
      {/* Admin Profile */}
      <div className="card-board p-5">
        <h3 className="font-display text-base font-semibold text-chalk mb-4">Admin Profile</h3>
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-full bg-gold/20 border-2 border-gold/40 flex items-center justify-center">
            <Shield className="h-7 w-7 text-gold" />
          </div>
          <div>
            <p className="font-semibold text-chalk">{profile?.full_name}</p>
            <p className="text-xs text-muted-board">Administrator &middot; Form {profile?.grade}</p>
            <p className="text-xs text-teal mt-1">Full platform access</p>
          </div>
        </div>
      </div>

      {/* Subscription access */}
      <div className="card-board p-5">
        <div className="flex items-center justify-between gap-4 mb-2">
          <div>
            <h3 className="font-display text-base font-semibold text-chalk">Subscription Access</h3>
            <p className="text-sm text-muted-board mt-1">Choose whether the platform is free for everyone or requires a subscription.</p>
          </div>
          <span className={`text-xs font-semibold rounded-full px-2.5 py-1 border ${isPlatformFree ? 'text-teal border-teal/40 bg-teal/10' : 'text-gold border-gold/40 bg-gold/10'}`}>
            {isPlatformFree ? 'Free for everyone' : 'Subscription mode'}
          </span>
        </div>
        <label className="flex items-center gap-2.5 cursor-pointer mt-4">
          <input
            type="checkbox"
            checked={isPlatformFree}
            disabled={accessLoading}
            onChange={(event) => onTogglePlatformFree(event.target.checked)}
            className="h-4 w-4 rounded border-white/30 accent-gold"
          />
          <span className="text-sm text-chalk">Allow unlimited access for every pupil</span>
        </label>
        <div className="border-t border-white/10 mt-5 pt-5">
          <h4 className="text-sm font-semibold text-chalk mb-1">Give an individual free access</h4>
          <p className="text-xs text-muted-board mb-3">Use this for scholarships, promotions, or learner bonuses while other pupils remain in subscription mode.</p>
          <div className="flex flex-wrap gap-2">
            <select value={bonusUserId} onChange={(event) => setBonusUserId(event.target.value)} className="form-input flex-1 min-w-[220px]">
              <option value="">Select a pupil</option>
              {users.filter((user) => user.role !== 'admin').map((user) => <option key={user.id} value={user.id}>{user.full_name} · Form {user.grade}</option>)}
            </select>
            <select value={bonusDays} onChange={(event) => setBonusDays(event.target.value)} className="form-input w-auto">
              <option value="30">30 days</option>
              <option value="90">90 days</option>
              <option value="365">1 year</option>
              <option value="">No expiry</option>
            </select>
            <button
              onClick={() => { if (bonusUserId) onGrantBonus(bonusUserId, bonusDays ? Number(bonusDays) : null); }}
              disabled={!bonusUserId || accessLoading}
              className="btn-gold text-sm px-4 py-2 disabled:opacity-40"
            >
              Grant free access
            </button>
          </div>
        </div>
      </div>

      {/* OpenAI Integration */}
      <div className="card-board p-5">
        <div className="flex items-center gap-2 mb-3">
          <TrendingUp className="h-5 w-5 text-gold" />
          <h3 className="font-display text-base font-semibold text-chalk">OpenAI Integration</h3>
        </div>
        <p className="text-muted-board text-sm mb-4">
          The AI teacher uses OpenAI GPT-4o-mini for supplementary responses when the Zambian curriculum materials don&apos;t fully cover a topic. Set your OpenAI API key here.
        </p>
        <div className="flex gap-2">
          <input type="password" value={openaiKey} onChange={(e) => setOpenaiKey(e.target.value)}
            placeholder="sk-..." className="form-input flex-1" />
          <button onClick={handleSaveKey} disabled={saving} className="btn-gold text-sm px-4 py-2 disabled:opacity-40">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Save Key'}
          </button>
        </div>
        <p className="text-xs text-muted-board mt-2">
          The key is stored securely as a Supabase Edge Function secret. Without a key, the AI teacher falls back to lesson-content-based responses.
        </p>
      </div>

      {/* Platform Info */}
      <div className="card-board p-5">
        <h3 className="font-display text-base font-semibold text-chalk mb-4">Platform Information</h3>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <InfoRow label="Platform" value="SmartClass Zambia" />
          <InfoRow label="Version" value="1.0.0" />
          <InfoRow label="Framework" value="Next.js 13 + Supabase" />
          <InfoRow label="AI Model" value="GPT-4o-mini" />
          <InfoRow label="Curriculum" value="Zambian Curriculum (MOE)" />
          <InfoRow label="Subjects" value="Math, Science, Physics, Chemistry" />
        </div>
      </div>

      {/* Danger Zone */}
      <div className="card-board border-rust/30 p-5">
        <div className="flex items-center gap-2 mb-3">
          <AlertCircle className="h-5 w-5 text-rust" />
          <h3 className="font-display text-base font-semibold text-rust">Danger Zone</h3>
        </div>
        <p className="text-muted-board text-sm mb-4">
          These actions affect the entire platform. Proceed with caution.
        </p>
        <div className="space-y-2">
          <button onClick={handleRebuild} disabled={rebuilding}
            className="flex items-center gap-2 border border-rust/30 text-rust rounded-lg px-4 py-2 text-sm hover:bg-rust/10 transition-colors disabled:opacity-40">
            {rebuilding ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            Rebuild Search Index
          </button>
          <p className="text-xs text-muted-board/70 mt-1">
            Reindexes all topics and lessons for the search feature. Safe to run anytime.
          </p>
        </div>
      </div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-muted-board">{label}</p>
      <p className="text-sm text-chalk font-medium">{value}</p>
    </div>
  );
}
