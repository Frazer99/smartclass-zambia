'use client';

import { usePathname, useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';

export function BackHome() {
  const pathname = usePathname();
  const router = useRouter();

  if (pathname === '/') return null;

  const handleBack = () => {
    if (window.history.length > 1) {
      router.back();
    } else {
      router.push('/');
    }
  };

  return (
    <button
      type="button"
      onClick={handleBack}
      aria-label="Go back"
      title="Go back"
      className="fixed left-4 top-4 z-[70] inline-flex items-center gap-1.5 rounded-lg border border-white/15 bg-board-deep/95 px-3 py-2 text-xs font-semibold text-muted-board shadow-lg backdrop-blur transition-colors hover:border-gold/60 hover:text-chalk"
    >
      <ArrowLeft className="h-3.5 w-3.5" />
      Back
    </button>
  );
}
