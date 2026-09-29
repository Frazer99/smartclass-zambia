'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase, Subject } from '@/lib/supabase-client';
import { CalendarClock, Loader as Loader2 } from 'lucide-react';

interface ExamDateRow {
  id: string;
  subject_id: string;
  exam_date: string;
  subject: { name: string; color: string } | null;
}

interface Recommendation {
  recommendation_type: 'weak_topic' | 'past_paper';
  item_id: string;
  title: string;
  detail: string;
}

function daysRemaining(dateStr: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const exam = new Date(dateStr);
  exam.setHours(0, 0, 0, 0);
  return Math.round((exam.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

/**
 * A pupil sets an exam date per subject (not one date for everything —
 * past papers and topic mastery are both already subject-scoped
 * throughout this project, so a single blended date couldn't produce a
 * genuinely targeted recommendation for a pupil taking, say, Maths and
 * Physics on different days). Expanding a subject calls
 * get_exam_prep_recommendations(subject_id) — real weak-topic and
 * past-paper suggestions grounded in this pupil's own mastery and
 * attempt history, not a generic "revise everything" reminder.
 */
export function ExamCountdown({ subjects }: { subjects: Subject[] }) {
  const [examDates, setExamDates] = useState<ExamDateRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newSubjectId, setNewSubjectId] = useState('');
  const [newDate, setNewDate] = useState('');
  const [saving, setSaving] = useState(false);
  const [expandedSubject, setExpandedSubject] = useState<string | null>(null);
  const [recommendations, setRecommendations] = useState<Record<string, Recommendation[]>>({});
  const [recsLoading, setRecsLoading] = useState<string | null>(null);

  const fetchExamDates = async () => {
    setLoading(true);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { setLoading(false); return; }
    const { data } = await supabase
      .from('exam_dates')
      .select('*, subject:subjects(name, color)')
      .eq('student_id', session.user.id)
      .order('exam_date', { ascending: true });
    setExamDates((data as any) || []);
    setLoading(false);
  };

  useEffect(() => {
    fetchExamDates();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleAddExamDate = async () => {
    if (!newSubjectId || !newDate) return;
    setSaving(true);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { setSaving(false); return; }
    const { error } = await supabase.from('exam_dates').upsert(
      { student_id: session.user.id, subject_id: newSubjectId, exam_date: newDate, updated_at: new Date().toISOString() },
      { onConflict: 'student_id,subject_id' }
    );
    setSaving(false);
    if (!error) {
      setShowAddForm(false);
      setNewSubjectId('');
      setNewDate('');
      fetchExamDates();
    }
  };

  const toggleRecommendations = async (subjectId: string) => {
    if (expandedSubject === subjectId) { setExpandedSubject(null); return; }
    setExpandedSubject(subjectId);
    if (!recommendations[subjectId]) {
      setRecsLoading(subjectId);
      const { data } = await supabase.rpc('get_exam_prep_recommendations', { p_subject_id: subjectId });
      setRecommendations((prev) => ({ ...prev, [subjectId]: data || [] }));
      setRecsLoading(null);
    }
  };

  if (loading) return null;

  return (
    <div className="card-board p-5">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <CalendarClock className="h-5 w-5 text-gold" />
          <h2 className="font-display text-lg font-semibold text-chalk">Exam Countdown</h2>
        </div>
        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className="text-xs border border-white/15 text-muted-board hover:text-chalk rounded-lg px-3 py-1.5 transition-colors"
        >
          {showAddForm ? 'Cancel' : '+ Add exam date'}
        </button>
      </div>

      {showAddForm && (
        <div className="flex flex-wrap gap-2 mb-4 pb-4 border-b border-white/10">
          <select
            value={newSubjectId}
            onChange={(e) => setNewSubjectId(e.target.value)}
            className="bg-white/5 border border-white/15 text-chalk text-sm rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-gold"
          >
            <option value="">Select subject</option>
            {subjects.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
          <input
            type="date"
            value={newDate}
            onChange={(e) => setNewDate(e.target.value)}
            min={new Date().toISOString().slice(0, 10)}
            className="bg-white/5 border border-white/15 text-chalk text-sm rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-gold"
          />
          <button
            onClick={handleAddExamDate}
            disabled={saving || !newSubjectId || !newDate}
            className="btn-gold text-sm px-4 py-2 disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      )}

      {examDates.length === 0 ? (
        <p className="text-sm text-muted-board">
          No exam dates set yet — add one above to get a countdown and revision recommendations.
        </p>
      ) : (
        <div className="space-y-3">
          {examDates.map((exam) => {
            const days = daysRemaining(exam.exam_date);
            const urgent = days <= 7 && days >= 0;
            const soon = days > 7 && days <= 30;
            const subjectRecs = recommendations[exam.subject_id] || [];
            const weakTopics = subjectRecs.filter((r) => r.recommendation_type === 'weak_topic');
            const pastPapers = subjectRecs.filter((r) => r.recommendation_type === 'past_paper');

            return (
              <div key={exam.id}>
                <button
                  onClick={() => toggleRecommendations(exam.subject_id)}
                  className="w-full flex items-center justify-between text-left"
                >
                  <div>
                    <p className="text-sm font-semibold text-chalk">{exam.subject?.name || 'Subject'}</p>
                    <p className="text-xs text-muted-board">
                      {new Date(exam.exam_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
                    </p>
                  </div>
                  <span className={`font-mono-sc text-sm font-bold ${days < 0 ? 'text-muted-board' : urgent ? 'text-rust' : soon ? 'text-gold' : 'text-teal'}`}>
                    {days < 0 ? 'Past' : days === 0 ? 'Today' : `${days} day${days === 1 ? '' : 's'}`}
                  </span>
                </button>

                {expandedSubject === exam.subject_id && (
                  <div className="mt-2 pl-3 border-l-2 border-gold/30 space-y-3">
                    {recsLoading === exam.subject_id ? (
                      <div className="py-2"><Loader2 className="h-4 w-4 animate-spin text-gold" /></div>
                    ) : (
                      <>
                        {weakTopics.length > 0 && (
                          <div>
                            <p className="text-xs uppercase tracking-widest text-muted-board font-semibold mb-1">Focus on these topics</p>
                            <div className="space-y-1">
                              {weakTopics.map((r) => (
                                <div key={r.item_id} className="flex items-center justify-between text-xs">
                                  <span className="text-chalk">{r.title}</span>
                                  <span className="text-muted-board shrink-0 ml-2">{r.detail}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                        {pastPapers.length > 0 && (
                          <div>
                            <p className="text-xs uppercase tracking-widest text-muted-board font-semibold mb-1">Revise these past papers</p>
                            <div className="space-y-1">
                              {pastPapers.map((r) => (
                                <Link
                                  key={r.item_id}
                                  href={`/past-papers/${r.item_id}`}
                                  className="flex items-center justify-between text-xs hover:text-gold transition-colors"
                                >
                                  <span className="text-chalk">{r.title}</span>
                                  <span className="text-muted-board shrink-0 ml-2">{r.detail}</span>
                                </Link>
                              ))}
                            </div>
                          </div>
                        )}
                        {weakTopics.length === 0 && pastPapers.length === 0 && (
                          <p className="text-xs text-muted-board">No recommendations yet for this subject — start a lesson or practice question to build up your profile.</p>
                        )}
                      </>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
