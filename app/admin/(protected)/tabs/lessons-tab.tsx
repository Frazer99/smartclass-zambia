import { useState } from 'react';
import { Lesson, Topic, Subject } from '@/lib/supabase-client';
import { BookOpen, Plus, X, Pencil, Trash2, Search, Loader as Loader2 } from 'lucide-react';

const DIFFICULTY_OPTIONS = ['introductory', 'standard', 'advanced'];

export function LessonsTab({
  lessons, topics, subjects,
  lessonSearch, setLessonSearch,
  lessonTopicFilter, setLessonTopicFilter,
  showLessonForm, setShowLessonForm,
  editingLesson, lessonForm, setLessonForm,
  handleLessonSubmit, handleLessonEdit, handleLessonDelete,
}: {
  lessons: Lesson[]; topics: Topic[]; subjects: Subject[];
  lessonSearch: string; setLessonSearch: (v: string) => void;
  lessonTopicFilter: string; setLessonTopicFilter: (v: string) => void;
  showLessonForm: boolean; setShowLessonForm: (v: boolean) => void;
  editingLesson: Lesson | null; lessonForm: any; setLessonForm: (v: any) => void;
  handleLessonSubmit: () => void; handleLessonEdit: (l: Lesson) => void; handleLessonDelete: (id: string) => void;
}) {
  const [showTable, setShowTable] = useState(false);
  const filtered = lessons.filter((l) => {
    const matchSearch = !lessonSearch || l.title.toLowerCase().includes(lessonSearch.toLowerCase());
    const matchTopic = !lessonTopicFilter || l.topic_id === lessonTopicFilter;
    return matchSearch && matchTopic;
  });

  const topicName = (id: string) => topics.find((t) => t.id === id)?.name || 'Unknown';
  const topicSubject = (id: string) => {
    const t = topics.find((t) => t.id === id);
    return subjects.find((s) => s.id === t?.subject_id);
  };

  return (
    <div className="space-y-4">
      {/* Stats */}
      <div className="flex gap-4 flex-wrap">
        <div className="card-board px-4 py-3 min-w-[120px]">
          <div className="flex items-center gap-1.5 text-chalk mb-1"><BookOpen className="h-4 w-4" /></div>
          <div className="font-mono-sc text-xl font-bold text-chalk">{lessons.length}</div>
          <div className="text-xs text-muted-board">Total Lessons</div>
        </div>
        <div className="card-board px-4 py-3 min-w-[120px]">
          <div className="flex items-center gap-1.5 text-gold mb-1"><BookOpen className="h-4 w-4" /></div>
          <div className="font-mono-sc text-xl font-bold text-chalk">{filtered.length}</div>
          <div className="text-xs text-muted-board">Showing</div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="card-board px-3 py-2 flex items-center gap-2 flex-1 min-w-[200px]">
          <Search className="h-4 w-4 text-gold shrink-0" />
          <input type="text" value={lessonSearch} onChange={(e) => { setLessonSearch(e.target.value); setShowTable(true); }}
            placeholder="Search lessons..." className="flex-1 bg-transparent text-chalk placeholder:text-muted-board text-sm focus:outline-none" />
        </div>
        <select value={lessonTopicFilter} onChange={(e) => { setLessonTopicFilter(e.target.value); setShowTable(true); }}
          className="form-input max-w-[200px] text-chalk bg-board-deep">
          <option value="" className="bg-board-deep text-chalk">All topics</option>
          {topics.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
        <button type="button" onClick={() => setShowTable((visible) => !visible)} className="border border-gold/40 text-gold rounded-lg px-3 py-2 text-sm hover:bg-gold/10 transition-colors">
          {showTable ? 'Hide lessons' : 'Show lessons'}
        </button>
        <button onClick={() => setShowLessonForm(!showLessonForm)} className="flex items-center gap-1.5 btn-gold text-sm px-3 py-2">
          {showLessonForm ? <><X className="h-4 w-4" /> Cancel</> : <><Plus className="h-4 w-4" /> Add Lesson</>}
        </button>
      </div>

      {/* Form */}
      {showLessonForm && (
        <div className="card-board p-5 space-y-4 animate-slide-up">
          <h3 className="font-semibold text-chalk">{editingLesson ? 'Edit Lesson' : 'New Lesson'}</h3>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="text-xs text-muted-board mb-1 block">Topic <span className="text-rust">*</span></label>
              <select value={lessonForm.topic_id} onChange={(e) => setLessonForm({ ...lessonForm, topic_id: e.target.value })} className="form-input">
                <option value="">Select topic...</option>
                {topics.map((t) => <option key={t.id} value={t.id}>{t.name} (Form {t.grade})</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-muted-board mb-1 block">Title <span className="text-rust">*</span></label>
              <input type="text" value={lessonForm.title} onChange={(e) => setLessonForm({ ...lessonForm, title: e.target.value })} className="form-input" placeholder="e.g. Introduction to Algebra" />
            </div>
            <div>
              <label className="text-xs text-muted-board mb-1 block">Difficulty</label>
              <select value={lessonForm.difficulty} onChange={(e) => setLessonForm({ ...lessonForm, difficulty: e.target.value })} className="form-input">
                {DIFFICULTY_OPTIONS.map((d) => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-muted-board mb-1 block">Display Order</label>
              <input type="number" value={lessonForm.display_order} onChange={(e) => setLessonForm({ ...lessonForm, display_order: parseInt(e.target.value) || 0 })} className="form-input" />
            </div>
          </div>
          <div>
            <label className="text-xs text-muted-board mb-1 block">Intro</label>
            <textarea value={lessonForm.intro} onChange={(e) => setLessonForm({ ...lessonForm, intro: e.target.value })} className="form-input" rows={2} placeholder="Lesson introduction..." />
          </div>
          <div>
            <label className="text-xs text-muted-board mb-1 block">Summary</label>
            <textarea value={lessonForm.summary} onChange={(e) => setLessonForm({ ...lessonForm, summary: e.target.value })} className="form-input" rows={2} placeholder="Lesson summary..." />
          </div>
          <button onClick={handleLessonSubmit} className="btn-gold flex items-center gap-1.5 text-sm px-4 py-2">
            <Plus className="h-4 w-4" /> {editingLesson ? 'Update Lesson' : 'Create Lesson'}
          </button>
        </div>
      )}

      {/* Table */}
      {showTable && <div className="card-board overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/10 text-left text-xs text-muted-board uppercase tracking-widest">
                <th className="px-4 py-3 font-semibold">Title</th>
                <th className="px-4 py-3 font-semibold">Topic</th>
                <th className="px-4 py-3 font-semibold">Subject</th>
                <th className="px-4 py-3 font-semibold">Difficulty</th>
                <th className="px-4 py-3 font-semibold">Order</th>
                <th className="px-4 py-3 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-muted-board">No lessons found.</td></tr>
              ) : (
                filtered.map((l) => {
                  const subj = topicSubject(l.topic_id);
                  return (
                    <tr key={l.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                      <td className="px-4 py-3 font-medium text-chalk">{l.title}</td>
                      <td className="px-4 py-3 text-muted-board text-xs">{topicName(l.topic_id)}</td>
                      <td className="px-4 py-3">
                        {subj && <span className="text-xs font-semibold rounded-full px-2 py-0.5" style={{ background: `${subj.color}25`, color: subj.color }}>{subj.name}</span>}
                      </td>
                      <td className="px-4 py-3"><span className="text-xs border border-chalk/20 text-muted-board rounded-full px-2 py-0.5">{l.difficulty}</span></td>
                      <td className="px-4 py-3 text-muted-board font-mono-sc text-xs">{l.display_order}</td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button onClick={() => handleLessonEdit(l)} className="p-1.5 text-muted-board hover:text-gold transition-colors"><Pencil className="h-4 w-4" /></button>
                          <button onClick={() => handleLessonDelete(l.id)} className="p-1.5 text-muted-board hover:text-rust transition-colors"><Trash2 className="h-4 w-4" /></button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>}
    </div>
  );
}
