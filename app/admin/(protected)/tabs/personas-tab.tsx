'use client';

import { Loader as Loader2, ImageIcon } from 'lucide-react';

export type TeacherPersona = {
  id: string;
  name: string;
  gender: string;
  subject_id: string;
  grade_min: number;
  grade_max: number;
  persona_description: string;
  subject?: { name: string; color: string } | null;
  voice_accent?: string;
  voice_gender?: string;
  voice_tone?: string;
};

export function PersonasTab({ personas, loading }: {
  personas: TeacherPersona[];
  loading: boolean;
}) {
  if (loading) return <div className="flex h-72 items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-gold" /></div>;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display text-lg font-semibold text-chalk mb-1">Teacher Personas</h2>
        <p className="text-sm text-muted-board">Teacher personas use the illustrated teacher with browser voice and text explanations.</p>
      </div>
      <div className="max-h-[38rem] space-y-4 overflow-y-auto pr-1">
        {personas.length === 0 ? <div className="card-board p-8 text-center text-muted-board">No teacher personas found. Apply the persona migration first.</div> : personas.map((persona) => {
          return <div key={persona.id} className="card-board p-5">
            <div className="flex items-center justify-between mb-3">
              <div>
                <div className="flex items-center gap-2"><h3 className="font-display text-base font-semibold text-chalk">{persona.name}</h3><span className="text-xs text-muted-board">{persona.subject?.name || 'Unknown subject'} · Grade {persona.grade_min + 7}–{persona.grade_max + 7}</span></div>
                <p className="text-xs text-muted-board mt-0.5 max-w-xl">{persona.persona_description}</p>
              </div>
                <span className="flex items-center gap-1.5 text-xs text-muted-board"><ImageIcon className="h-3.5 w-3.5" /> {persona.voice_accent || 'Zambian English'} · {persona.voice_tone || 'warm and patient'}</span>
            </div>
          </div>;
        })}
      </div>
    </div>
  );
}
