'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useAuth } from '@/components/auth-provider';
import { supabase, Subject, PastPaper } from '@/lib/supabase-client';
import {
  Calculator,
  FlaskConical,
  Atom,
  TestTube,
  GraduationCap,
  FileText,
  Download,
  Clock,
  ListChecks,
} from 'lucide-react';

const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  Calculator,
  FlaskConical,
  Atom,
  TestTube,
};

export default function PastPapersPage() {
  const { profile } = useAuth();
  const searchParams = useSearchParams();
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [activeSubjectId, setActiveSubjectId] = useState('');
  const [papers, setPapers] = useState<PastPaper[]>([]);
  const [questionCounts, setQuestionCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!profile) return;
    fetchData();
  }, [profile]);

  async function fetchData() {
    if (!profile) return;
    // Learner profiles use internal levels 1-6; past-paper records use
    // official Grades 8-12.
    const grade = profile.grade + 7;

    const { data: subjectsData } = await supabase.from('subjects').select('*').order('display_order');
    const subs = ((subjectsData as Subject[]) || []).filter((s) => s.grades.includes(profile.grade));
    const { data: papersData } = await supabase
      .from('past_papers')
      .select('*')
      .eq('grade', grade)
      .order('year', { ascending: false });
    const list = (papersData as PastPaper[]) || [];
    setPapers(list);
    const paperSubjects = subs.filter((subject) => list.some((paper) => paper.subject_id === subject.id));
    setSubjects(paperSubjects);
    if (paperSubjects.length > 0) {
      const requestedSubject = searchParams.get('subject');
      setActiveSubjectId(paperSubjects.some((subject) => subject.id === requestedSubject) ? requestedSubject! : paperSubjects[0].id);
    } else {
      setActiveSubjectId('');
    }

    if (list.length > 0) {
      const { data: countsData } = await supabase
        .from('past_paper_questions')
        .select('past_paper_id')
        .in('past_paper_id', list.map((p) => p.id));
      const counts: Record<string, number> = {};
      (countsData || []).forEach((row: any) => {
        counts[row.past_paper_id] = (counts[row.past_paper_id] || 0) + 1;
      });
      setQuestionCounts(counts);
    }

    setLoading(false);
  }

  if (loading || !profile) {
    return <div className="flex h-72 items-center justify-center text-muted-board">Loading past papers...</div>;
  }

  const subjectPapers = papers.filter((p) => p.subject_id === activeSubjectId);
  const activeSubject = subjects.find((s) => s.id === activeSubjectId);
  const displayGrade = profile.grade + 7;

  const downloadPaper = async (storagePath: string) => {
    const { data, error } = await supabase.storage.from('content-materials').createSignedUrl(storagePath, 300);
    if (error || !data?.signedUrl) return;
    window.open(data.signedUrl, '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="font-display text-xl font-semibold text-chalk mb-1">Past Papers</h1>
        <p className="text-sm text-muted-board">
          Practice with real ECZ past papers for Grade {displayGrade}. Pick a subject, then a year — work through
          the whole paper or jump to specific questions.
        </p>
      </div>

      {/* Subject tabs */}
      {subjects.length > 0 && <div className="flex gap-2 flex-wrap">
        {subjects.map((s) => {
          const Icon = iconMap[s.icon] || GraduationCap;
          const isActive = s.id === activeSubjectId;
          return (
            <button
              key={s.id}
              onClick={() => setActiveSubjectId(s.id)}
              className={`flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold border-2 transition-all ${
                isActive
                  ? 'border-transparent text-ink'
                  : 'border-white/10 text-muted-board hover:text-chalk hover:border-white/20'
              }`}
              style={isActive ? { background: s.color } : undefined}
            >
              <Icon className="h-4 w-4" />
              {s.name}
            </button>
          );
        })}
      </div>}

      {subjects.length > 0 ? <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-display text-lg font-semibold text-chalk">{activeSubject?.name} Past Papers</h2>
          <span className="text-xs text-muted-board font-mono-sc">{subjectPapers.length} papers</span>
        </div>

        {subjectPapers.length === 0 ? (
          <div className="card-board p-8 text-center text-muted-board text-sm">
            No past papers uploaded yet for {activeSubject?.name} at Grade {displayGrade}. Check back soon, or ask
            an admin to add one under Content Materials.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {subjectPapers.map((paper) => {
              const count = questionCounts[paper.id] || 0;
              return (
                <div key={paper.id} className="card-topic p-4 flex flex-col">
                  <div className="flex items-start justify-between mb-1">
                    <span className="font-semibold text-ink text-sm">{paper.title}</span>
                    <span className="text-xs font-mono-sc text-ink/50 shrink-0">{paper.year}</span>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-ink/50 mb-3">
                    <span className="flex items-center gap-1">
                      <ListChecks className="h-3 w-3" /> {count} questions
                    </span>
                    {paper.duration_minutes && (
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" /> {paper.duration_minutes} min
                      </span>
                    )}
                    {paper.total_marks && <span>{paper.total_marks} marks</span>}
                  </div>
                  <div className="flex gap-2 mt-auto">
                    {paper.storage_path && (
                      <button
                        type="button"
                        onClick={() => downloadPaper(paper.storage_path!)}
                        className="p-1.5 border-2 border-ink rounded-lg text-ink hover:bg-ink hover:text-chalk transition-colors"
                        title="Open PDF"
                      >
                        <Download className="h-3.5 w-3.5" />
                      </button>
                    )}
                    <Link href={`/past-papers/${paper.id}`} className="flex-1">
                      <button className="w-full text-xs border-2 border-ink rounded-lg py-1.5 font-semibold text-ink hover:bg-ink hover:text-chalk transition-colors flex items-center justify-center gap-1">
                        <FileText className="h-3 w-3" /> Browse questions
                      </button>
                    </Link>
                    <Link href={`/past-papers/${paper.id}/run`} className="flex-1">
                      <button className="btn-gold w-full text-xs py-1.5 flex items-center justify-center gap-1">
                        Start whole paper →
                      </button>
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div> : (
        <div className="card-board p-8 text-center text-muted-board text-sm">
          No past papers are available for Grade {displayGrade} yet. Check back soon, or ask an admin to add one under
          Content Materials.
        </div>
      )}
    </div>
  );
}
