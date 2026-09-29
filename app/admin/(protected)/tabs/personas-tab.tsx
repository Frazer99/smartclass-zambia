'use client';

import { useState } from 'react';
import { Loader as Loader2, Video, ImageIcon } from 'lucide-react';
import { LiveTeacherAvatar } from '@/components/teacher/LiveTeacherAvatar';

export type TeacherPersona = {
  id: string;
  name: string;
  gender: string;
  subject_id: string;
  grade_min: number;
  grade_max: number;
  persona_description: string;
  liveavatar_avatar_id: string | null;
  liveavatar_voice_id: string | null;
  subject?: { name: string; color: string } | null;
};

export function PersonasTab({ personas, loading, onSave }: {
  personas: TeacherPersona[];
  loading: boolean;
  onSave: (id: string, avatarId: string, voiceId: string) => Promise<boolean>;
}) {
  const [drafts, setDrafts] = useState<Record<string, { avatarId: string; voiceId: string }>>({});
  const [savingId, setSavingId] = useState<string | null>(null);
  const [previewId, setPreviewId] = useState<string | null>(null);
  const getDraft = (persona: TeacherPersona) => drafts[persona.id] ?? {
    avatarId: persona.liveavatar_avatar_id || '',
    voiceId: persona.liveavatar_voice_id || '',
  };
  const setDraft = (persona: TeacherPersona, field: 'avatarId' | 'voiceId', value: string) => {
    setDrafts((current) => ({ ...current, [persona.id]: { ...getDraft(persona), [field]: value } }));
  };
  const save = async (persona: TeacherPersona) => {
    const draft = getDraft(persona);
    setSavingId(persona.id);
    const saved = await onSave(persona.id, draft.avatarId.trim(), draft.voiceId.trim());
    if (saved && draft.avatarId.trim()) setPreviewId(persona.id);
    setSavingId(null);
  };

  if (loading) return <div className="flex h-72 items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-gold" /></div>;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display text-lg font-semibold text-chalk mb-1">Teacher Personas</h2>
        <p className="text-sm text-muted-board">Connect each teacher to a LiveAvatar, or leave the IDs blank to use the illustrated avatar.</p>
      </div>
      <div className="space-y-4">
        {personas.length === 0 ? <div className="card-board p-8 text-center text-muted-board">No teacher personas found. Apply the persona migration first.</div> : personas.map((persona) => {
          const draft = getDraft(persona);
          return <div key={persona.id} className="card-board p-5">
            <div className="flex items-center justify-between mb-3">
              <div>
                <div className="flex items-center gap-2"><h3 className="font-display text-base font-semibold text-chalk">{persona.name}</h3><span className="text-xs text-muted-board">{persona.subject?.name || 'Unknown subject'} · Grade {persona.grade_min + 7}–{persona.grade_max + 7}</span></div>
                <p className="text-xs text-muted-board mt-0.5 max-w-xl">{persona.persona_description}</p>
              </div>
              {persona.liveavatar_avatar_id ? <span className="flex items-center gap-1.5 text-xs text-teal"><Video className="h-3.5 w-3.5" /> Live avatar connected</span> : <span className="flex items-center gap-1.5 text-xs text-muted-board"><ImageIcon className="h-3.5 w-3.5" /> Illustrated avatar</span>}
            </div>
            <div className="grid sm:grid-cols-2 gap-3">
              <label className="block text-xs uppercase tracking-widest text-muted-board font-semibold">LiveAvatar avatar ID<input value={draft.avatarId} onChange={(e) => setDraft(persona, 'avatarId', e.target.value)} placeholder="Avatar ID" className="w-full mt-1 px-3 py-2 rounded-lg border border-white/15 bg-white/5 text-chalk text-sm font-mono-sc focus:outline-none focus:ring-1 focus:ring-gold" /></label>
              <label className="block text-xs uppercase tracking-widest text-muted-board font-semibold">Voice ID <span className="normal-case font-normal">(optional)</span><input value={draft.voiceId} onChange={(e) => setDraft(persona, 'voiceId', e.target.value)} placeholder="Voice ID" className="w-full mt-1 px-3 py-2 rounded-lg border border-white/15 bg-white/5 text-chalk text-sm font-mono-sc focus:outline-none focus:ring-1 focus:ring-gold" /></label>
            </div>
            <button onClick={() => save(persona)} disabled={savingId === persona.id} className="btn-gold text-sm px-4 py-2 mt-3">{savingId === persona.id ? 'Saving...' : 'Save'}</button>
            {previewId === persona.id && draft.avatarId.trim() && (
              <div className="mt-4 flex items-center gap-3 border-t border-white/10 pt-3">
                <LiveTeacherAvatar
                  subjectId={persona.subject_id}
                  grade={persona.grade_min}
                  teacherName={persona.name}
                  enabled
                  size="sm"
                  onConnectionChange={(connected) => {
                    if (connected) setPreviewId(persona.id);
                  }}
                />
                <span className="text-xs text-muted-board">Connecting saved LiveAvatar configuration...</span>
              </div>
            )}
          </div>;
        })}
      </div>
    </div>
  );
}
