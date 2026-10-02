'use client';

import Link from 'next/link';
import { Home } from 'lucide-react';

export function BackHome() {
  return (
    <Link
      href="/"
      aria-label="Back home"
      title="Back home"
      className="fixed bottom-4 left-4 z-[70] inline-flex items-center gap-1.5 rounded-lg border border-white/15 bg-board-deep/95 px-3 py-2 text-xs font-semibold text-muted-board shadow-lg backdrop-blur transition-colors hover:border-gold/60 hover:text-chalk"
    >
      <Home className="h-3.5 w-3.5" />
      Back home
    </Link>
  );
}
