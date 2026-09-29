'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/auth-provider';
import { supabase, Subject } from '@/lib/supabase-client';
import { Loader as Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Wordmark } from '@/components/brand/Logo';

const FORMS = [1, 2, 3, 4, 5, 6];

const gradeDescriptions: Record<number, { stage: string; subjects: string }> = {
  1: { stage: 'Junior Secondary', subjects: 'Mathematics, Science' },
  2: { stage: 'Junior Secondary', subjects: 'Mathematics, Science' },
  3: { stage: 'Junior Secondary', subjects: 'Mathematics, Science' },
  4: { stage: 'Senior Secondary', subjects: 'Mathematics, Physics, Chemistry' },
  5: { stage: 'Senior Secondary', subjects: 'Mathematics, Physics, Chemistry' },
  6: { stage: 'Senior Secondary — Exam Prep', subjects: 'Mathematics, Physics, Chemistry' },
};

export default function OnboardingPage() {
  const { user, profile, loading, refreshProfile } = useAuth();
  const router = useRouter();
  const [selectedGrade, setSelectedGrade] = useState(1);
  const [saving, setSaving] = useState(false);
  const [subjects, setSubjects] = useState<Subject[]>([]);

  useEffect(() => {
    if (!loading && !user) router.push('/login');
  }, [user, loading, router]);

  useEffect(() => {
    if (!loading && profile && profile.grade) {
      setSelectedGrade(profile.grade);
    }
  }, [profile, loading]);

  useEffect(() => {
    fetchSubjects();
  }, []);

  const fetchSubjects = async () => {
    const { data } = await supabase.from('subjects').select('*').order('display_order');
    if (data) setSubjects(data as Subject[]);
  };

  const availableSubjects = subjects.filter((s) => s.grades.includes(selectedGrade));

  const handleContinue = async () => {
    if (!user) return;
    setSaving(true);
    const metadata = user.user_metadata || {};
    const fullName = profile?.full_name || metadata.full_name || user.email?.split('@')[0] || 'Student';
    const { error } = await supabase
      .from('profiles')
      .upsert(
        {
          id: user.id,
          full_name: fullName,
          grade: selectedGrade,
          school: profile?.school ?? metadata.school ?? null,
        },
        { onConflict: 'id' },
      );

    if (error) {
      console.error('Could not save onboarding profile:', error);
      toast.error(error.message || 'Could not save your grade. Please try again.');
      setSaving(false);
      return;
    }
    await refreshProfile();
    router.push('/dashboard');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-board flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-gold" />
      </div>
    );
  }

  const firstName = profile?.full_name?.split(' ')[0] || 'there';

  return (
    <div className="relative min-h-screen bg-board text-chalk flex flex-col items-center justify-center px-4 py-12">
      <div className="chalk-noise" />
      <div className="dust" style={{ top: '10%', left: '12%', width: 4, height: 4, animationDelay: '0s' }} />
      <div className="dust" style={{ top: '80%', left: '80%', width: 5, height: 5, animationDelay: '3s' }} />
      <div className="dust" style={{ top: '50%', left: '92%', width: 3, height: 3, animationDelay: '6s' }} />

      <div className="relative z-10 w-full max-w-lg">
        {/* Logo */}
        <div className="text-center mb-8">
          <Wordmark size="lg" className="justify-center" />
          <svg className="mx-auto mt-2" width="160" height="12" viewBox="0 0 160 12">
            <path d="M2 9 Q 40 -1, 80 7 T 158 5" fill="none" stroke="hsl(41 76% 60%)" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </div>

        {/* Card */}
        <div className="card-paper p-8" style={{ transform: 'rotate(-0.4deg)' }}>
          <h2 className="font-display text-2xl font-semibold text-ink mb-1">
            Welcome, {firstName}!
          </h2>
          <p className="text-sm text-ink/60 mb-6">
            Which form are you in? This sets your subjects and curriculum.
          </p>

          {/* Form picker */}
          <div className="grid grid-cols-6 gap-2 mb-6">
            {FORMS.map((g) => (
              <button
                key={g}
                type="button"
                onClick={() => setSelectedGrade(g)}
                className={`grade-chip py-3 ${selectedGrade === g ? 'active' : ''}`}
              >
                {g}
              </button>
            ))}
          </div>

          {/* Form description */}
          <div className="bg-paper-edge/30 border border-ink/10 rounded-lg p-4 mb-4">
            <p className="font-semibold text-ink text-sm mb-0.5">
              Form {selectedGrade} &middot; {gradeDescriptions[selectedGrade].stage}
            </p>
            <p className="text-xs text-ink/50 mb-3">{gradeDescriptions[selectedGrade].stage}</p>

            {/* Subject badges */}
            <div className="flex flex-wrap gap-2">
              {availableSubjects.map((s) => (
                <span
                  key={s.id}
                  className="text-xs font-semibold rounded-full px-3 py-1 border-2"
                  style={{ borderColor: s.color, color: s.color }}
                >
                  {s.name}
                </span>
              ))}
            </div>
          </div>

          <p className="text-xs text-ink/50 mb-6">
            {selectedGrade <= 3
              ? 'You will study Mathematics and Science following the Zambian Curriculum.'
              : 'You will study Mathematics, Physics, and Chemistry following the Zambian Curriculum.'}
          </p>

          <button
            onClick={handleContinue}
            disabled={saving}
            className="btn-gold w-full py-3 flex items-center justify-center gap-2"
          >
            {saving ? (
              <><Loader2 className="h-4 w-4 animate-spin" /> Saving...</>
            ) : (
              `Start Form ${selectedGrade} →`
            )}
          </button>
        </div>

        <p className="text-center text-xs text-muted-board mt-4">
          You can always change your grade later from your account settings.
        </p>
      </div>
    </div>
  );
}
