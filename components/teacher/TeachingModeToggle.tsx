'use client';

import { Clapperboard, FileText } from 'lucide-react';
import { TeachingMode } from '@/lib/teachingMode';

interface TeachingModeToggleProps {
  mode: TeachingMode;
  onChange: (mode: TeachingMode) => void;
  className?: string;
}

export function TeachingModeToggle({ mode, onChange, className = '' }: TeachingModeToggleProps) {
  return (
    <div className={`inline-flex items-center rounded-lg border border-white/10 bg-white/5 p-1 ${className}`}>
      <button
        onClick={() => onChange('video')}
        className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
          mode === 'video' ? 'bg-gold text-ink' : 'text-muted-board hover:text-chalk'
        }`}
      >
        <Clapperboard className="h-3.5 w-3.5" />
        Video teacher
      </button>
      <button
        onClick={() => onChange('text')}
        className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
          mode === 'text' ? 'bg-gold text-ink' : 'text-muted-board hover:text-chalk'
        }`}
      >
        <FileText className="h-3.5 w-3.5" />
        Text explanation
      </button>
    </div>
  );
}
