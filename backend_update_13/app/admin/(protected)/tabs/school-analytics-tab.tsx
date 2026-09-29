'use client';

import { Loader as Loader2, GraduationCap, MessageSquareWarning } from 'lucide-react';

const FORMS = [1, 2, 3, 4, 5, 6];

interface TopicAnalyticsRow {
  subject_name: string;
  topic_id: string;
  topic_name: string;
  pupil_count: number;
  avg_mastery: number | null;
  min_mastery: number | null;
  max_mastery: number | null;
}

interface MisconceptionRow {
  topic_name: string;
  detected_mistake: string;
  occurrence_count: number;
}

interface SchoolAnalyticsTabProps {
  schoolList: { school: string; pupil_count: number }[];
  topicAnalytics: TopicAnalyticsRow[];
  misconceptions: MisconceptionRow[];
  loading: boolean;
  schoolFilter: string;
  setSchoolFilter: (v: string) => void;
  gradeFilter: number | null;
  setGradeFilter: (v: number | null) => void;
}

/**
 * The realistic version of "teacher/school analytics" and a "parent
 * dashboard" (design doc sections 11-12) without a separate parent/
 * teacher account system — aggregated mastery and common misconceptions,
 * filterable by school and Form, admin-visible today. Backed by three
 * SECURITY DEFINER SQL functions (get_distinct_schools,
 * get_school_topic_analytics, get_common_misconceptions) that each check
 * the caller is an admin themselves, not relying on RLS alone.
 *
 * Sorted worst-mastery-first, matching the design's "most difficult
 * topics" framing — what a teacher needs to see first is what needs
 * attention, not an alphabetical list.
 */
export function SchoolAnalyticsTab({
  schoolList, topicAnalytics, misconceptions, loading,
  schoolFilter, setSchoolFilter, gradeFilter, setGradeFilter,
}: SchoolAnalyticsTabProps) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display text-lg font-semibold text-chalk mb-1">School Analytics</h2>
        <p className="text-sm text-muted-board">
          Aggregated mastery and common misconceptions across pupils — filter by school and Form to see how a
          specific class is doing.
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <select
          value={schoolFilter}
          onChange={(e) => setSchoolFilter(e.target.value)}
          className="bg-white/5 border border-white/15 text-chalk text-sm rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-gold"
        >
          <option value="">All schools</option>
          {schoolList.map((s) => (
            <option key={s.school} value={s.school}>{s.school} ({s.pupil_count})</option>
          ))}
        </select>

        <div className="flex gap-1.5">
          <button
            onClick={() => setGradeFilter(null)}
            className={`text-xs px-3 py-2 rounded-lg border transition-colors ${gradeFilter === null ? 'border-gold text-gold bg-gold/10' : 'border-white/10 text-muted-board hover:text-chalk'}`}
          >
            All Forms
          </button>
          {FORMS.map((g) => (
            <button
              key={g}
              onClick={() => setGradeFilter(g)}
              className={`text-xs px-3 py-2 rounded-lg border transition-colors ${gradeFilter === g ? 'border-gold text-gold bg-gold/10' : 'border-white/10 text-muted-board hover:text-chalk'}`}
            >
              Form {g}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex h-48 items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-gold" /></div>
      ) : (
        <>
          {/* Topic mastery table */}
          <div className="card-board p-5">
            <div className="flex items-center gap-2 mb-4">
              <GraduationCap className="h-5 w-5 text-gold" />
              <h3 className="font-display text-base font-semibold text-chalk">Topic Mastery</h3>
              <span className="text-xs text-muted-board ml-auto">Sorted lowest mastery first</span>
            </div>
            {topicAnalytics.length === 0 ? (
              <p className="text-sm text-muted-board">
                No mastery data yet for this filter — pupils need at least one assessable interaction
                (a practice question, past-paper question, or graded chat exchange) on a topic before it shows up here.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs uppercase tracking-wide text-muted-board border-b border-white/10">
                      <th className="py-2 pr-3">Subject</th>
                      <th className="py-2 pr-3">Topic</th>
                      <th className="py-2 pr-3 text-right">Pupils</th>
                      <th className="py-2 pr-3 text-right">Avg Mastery</th>
                      <th className="py-2 pl-3 text-right">Range</th>
                    </tr>
                  </thead>
                  <tbody>
                    {topicAnalytics.map((row) => (
                      <tr key={row.topic_id} className="border-b border-white/5">
                        <td className="py-2.5 pr-3 text-muted-board">{row.subject_name}</td>
                        <td className="py-2.5 pr-3 text-chalk font-medium">{row.topic_name}</td>
                        <td className="py-2.5 pr-3 text-right font-mono-sc text-muted-board">{row.pupil_count}</td>
                        <td className="py-2.5 pr-3 text-right font-mono-sc">
                          <span className={
                            (row.avg_mastery ?? 0) < 40 ? 'text-rust font-semibold' :
                            (row.avg_mastery ?? 0) < 70 ? 'text-gold font-semibold' : 'text-teal font-semibold'
                          }>
                            {row.avg_mastery ?? '—'}%
                          </span>
                        </td>
                        <td className="py-2.5 pl-3 text-right font-mono-sc text-xs text-muted-board">
                          {row.min_mastery ?? '—'}%–{row.max_mastery ?? '—'}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Common misconceptions */}
          <div className="card-board p-5">
            <div className="flex items-center gap-2 mb-1">
              <MessageSquareWarning className="h-5 w-5 text-gold" />
              <h3 className="font-display text-base font-semibold text-chalk">Common Misconceptions</h3>
            </div>
            <p className="text-xs text-muted-board mb-4">
              Grouped by exact wording, not meaning — similar mistakes described differently by the AI won&apos;t
              merge into one count. Good for spotting a clearly recurring, consistently-worded issue; still worth
              skimming the list yourself for patterns a raw count would miss.
            </p>
            {misconceptions.length === 0 ? (
              <p className="text-sm text-muted-board">No misconceptions detected yet for this filter.</p>
            ) : (
              <div className="space-y-2">
                {misconceptions.map((m, i) => (
                  <div key={i} className="flex items-center gap-3 text-sm">
                    <span className="text-xs text-gold font-mono-sc w-20 shrink-0">{m.topic_name}</span>
                    <span className="text-chalk flex-1">{m.detected_mistake}</span>
                    <span className="text-xs text-muted-board font-mono-sc shrink-0">×{m.occurrence_count}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
