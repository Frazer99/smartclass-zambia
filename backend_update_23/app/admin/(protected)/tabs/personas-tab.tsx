'use client';

import { useState } from 'react';
import { Loader as Loader2, Video, ImageIcon } from 'lucide-react';

interface TeacherPersona {
  id: string;
  name: string;
  gender: string;
  grade_min: number;
  grade_max: number;
  persona_description: string;
  liveavatar_avatar_id: string | null;
  liveavatar_voice_id: string | null;
  subject?: { name: string; color: string } | null;
}

interface PersonasTabProps {
  personas: TeacherPersona[];
  loading: boolean;
  onSave: (id: string, avatarId: string, voiceId: string) => Promise<void>;
}

/**
 * Self-service LiveAvatar wiring for each of the five named teacher
 * personas — previously the only way to set a persona's avatar_id was a
 * raw SQL UPDATE run by hand in the Supabase SQL Editor (which is how
 * Chipo's avatar_id actually got set). This closes that gap: an admin
 * pastes the avatar_id (and optionally voice_id) from their LiveAvatar
 * dashboard directly here.
 *
 * A persona without an avatar_id set isn't broken — LiveTeacherAvatar
 * falls back to the illustrated SVG avatar automatically (see
 * components/teacher/LiveTeacherAvatar.tsx) — so this page shows that
 * state plainly rather than as an error.
 */
export function PersonasTab({ personas, loading, onSave }: PersonasTabProps) {
  const [drafts, setDrafts] = useState<Record<string, { avatarId: string; voiceId: string }>>({});
  const [savingId, setSavingId] = useState<string | null>(null);

  const getDraft = (p: TeacherPersona) =>
    drafts[p.id] ?? { avatarId: p.liveavatar_avatar_id || '', voiceId: p.liveavatar_voice_id || '' };

  const setDraft = (id: string, field: 'avatarId' | 'voiceId', value: string) => {
    const persona = personas.find((p) => p.id === id);
    if (!persona) return;
    setDrafts((prev) => ({ ...prev, [id]: { ...getDraft(persona), [field]: value } }));
  };

  const handleSave = async (p: TeacherPersona) => {
    const draft = getDraft(p);
    setSavingId(p.id);
    await onSave(p.id, draft.avatarId.trim(), draft.voiceId.trim());
    setSavingId(null);
  };

  if (loading) {
    return <div className="flex h-72 items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-gold" /></div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display text-lg font-semibold text-chalk mb-1">Teacher Personas</h2>
        <p className="text-sm text-muted-board">
          Connect each named teacher to a real LiveAvatar avatar_id for live video, or leave it blank to keep the
          illustrated avatar — both work, nothing is required here.
        </p>
      </div>

      <div className="space-y-4">
        {personas.map((p) => {
          const draft = getDraft(p);
          const isConnected = !!p.liveavatar_avatar_id;
          return (
            <div key={p.id} className="card-board p-5">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-display text-base font-semibold text-chalk">{p.name}</h3>
                    <span className="text-xs text-muted-board">
                      {p.subject?.name || 'Unknown subject'} · Form {p.grade_min}–{p.grade_max}
                    </span>
                  </div>
                  <p className="text-xs text-muted-board mt-0.5 max-w-xl">{p.persona_description}</p>
                </div>
                {isConnected ? (
                  <span className="flex items-center gap-1.5 text-xs text-teal shrink-0 ml-3">
                    <Video className="h-3.5 w-3.5" /> Live avatar connected
                  </span>
                ) : (
                  <span className="flex items-center gap-1.5 text-xs text-muted-board shrink-0 ml-3">
                    <ImageIcon className="h-3.5 w-3.5" /> Using illustrated avatar
                  </span>
                )}
              </div>

              <div className="grid sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs uppercase tracking-widest text-muted-board font-semibold mb-1.5">
                    LiveAvatar avatar_id
                  </label>
                  <input
                    type="text"
                    value={draft.avatarId}
                    onChange={(e) => setDraft(p.id, 'avatarId', e.target.value)}
                    placeholder="e.g. b6c94c07-e4e5-483e-8bec-e838d5910b7d"
                    className="w-full px-3 py-2 rounded-lg border border-white/15 bg-white/5 text-chalk text-sm font-mono-sc placeholder:text-muted-board placeholder:font-sans focus:outline-none focus:ring-1 focus:ring-gold"
                  />
                </div>
                <div>
                  <label className="block text-xs uppercase tracking-widest text-muted-board font-semibold mb-1.5">
                    Voice ID <span className="normal-case font-normal text-muted-board/70">(optional)</span>
                  </label>
                  <input
                    type="text"
                    value={draft.voiceId}
                    onChange={(e) => setDraft(p.id, 'voiceId', e.target.value)}
                    placeholder="leave blank for the avatar's default voice"
                    className="w-full px-3 py-2 rounded-lg border border-white/15 bg-white/5 text-chalk text-sm font-mono-sc placeholder:text-muted-board placeholder:font-sans focus:outline-none focus:ring-1 focus:ring-gold"
                  />
                </div>
              </div>

              <button
                onClick={() => handleSave(p)}
                disabled={savingId === p.id}
                className="btn-gold text-sm px-4 py-2 mt-3 flex items-center gap-2"
              >
                {savingId === p.id ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Saving...</> : 'Save'}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
