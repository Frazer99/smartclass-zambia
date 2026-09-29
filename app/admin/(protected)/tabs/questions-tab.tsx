import { useState } from 'react';
import { PracticeQuestion, Topic, Subject } from '@/lib/supabase-client';
import { CircleHelp as HelpCircle, Plus, X, Pencil, Trash2, Search } from 'lucide-react';

const QUESTION_TYPES = ['multiple_choice', 'numeric', 'short_answer'];
const DIFFICULTY_OPTIONS = ['introductory', 'standard', 'advanced'];

export function QuestionsTab({
  questions, topics, subjects,
  questionSearch, setQuestionSearch,
  questionTopicFilter, setQuestionTopicFilter,
  showQuestionForm, setShowQuestionForm,
  editingQuestion, questionForm, setQuestionForm,
  handleQuestionSubmit, handleQuestionEdit, handleQuestionDelete,
}: {
  questions: PracticeQuestion[]; topics: Topic[]; subjects: Subject[];
  questionSearch: string; setQuestionSearch: (v: string) => void;
  questionTopicFilter: string; setQuestionTopicFilter: (v: string) => void;
  showQuestionForm: boolean; setShowQuestionForm: (v: boolean) => void;
  editingQuestion: PracticeQuestion | null; questionForm: any; setQuestionForm: (v: any) => void;
  handleQuestionSubmit: () => void; handleQuestionEdit: (q: PracticeQuestion) => void; handleQuestionDelete: (id: string) => void;
}) {
  const [showTable, setShowTable] = useState(false);
  const filtered = questions.filter((q) => {
    const matchSearch = !questionSearch || q.question_text.toLowerCase().includes(questionSearch.toLowerCase());
    const matchTopic = !questionTopicFilter || q.topic_id === questionTopicFilter;
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
          <div className="flex items-center gap-1.5 text-chalk mb-1"><HelpCircle className="h-4 w-4" /></div>
          <div className="font-mono-sc text-xl font-bold text-chalk">{questions.length}</div>
          <div className="text-xs text-muted-board">Total Questions</div>
        </div>
        <div className="card-board px-4 py-3 min-w-[120px]">
          <div className="flex items-center gap-1.5 text-gold mb-1"><HelpCircle className="h-4 w-4" /></div>
          <div className="font-mono-sc text-xl font-bold text-chalk">{filtered.length}</div>
          <div className="text-xs text-muted-board">Showing</div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="card-board px-3 py-2 flex items-center gap-2 flex-1 min-w-[200px]">
          <Search className="h-4 w-4 text-gold shrink-0" />
          <input type="text" value={questionSearch} onChange={(e) => { setQuestionSearch(e.target.value); setShowTable(true); }}
            placeholder="Search questions..." className="flex-1 bg-transparent text-chalk placeholder:text-muted-board text-sm focus:outline-none" />
        </div>
        <select value={questionTopicFilter} onChange={(e) => { setQuestionTopicFilter(e.target.value); setShowTable(true); }}
          className="form-input max-w-[200px] text-chalk bg-board-deep">
          <option value="" className="bg-board-deep text-chalk">All topics</option>
          {topics.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
        <button type="button" onClick={() => setShowTable((visible) => !visible)} className="border border-gold/40 text-gold rounded-lg px-3 py-2 text-sm hover:bg-gold/10 transition-colors">
          {showTable ? 'Hide questions' : 'Show questions'}
        </button>
        <button onClick={() => setShowQuestionForm(!showQuestionForm)} className="flex items-center gap-1.5 btn-gold text-sm px-3 py-2">
          {showQuestionForm ? <><X className="h-4 w-4" /> Cancel</> : <><Plus className="h-4 w-4" /> Add Question</>}
        </button>
      </div>

      {/* Form */}
      {showQuestionForm && (
        <div className="card-board p-5 space-y-4 animate-slide-up">
          <h3 className="font-semibold text-chalk">{editingQuestion ? 'Edit Question' : 'New Practice Question'}</h3>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="text-xs text-muted-board mb-1 block">Topic <span className="text-rust">*</span></label>
              <select value={questionForm.topic_id} onChange={(e) => setQuestionForm({ ...questionForm, topic_id: e.target.value })} className="form-input">
                <option value="">Select topic...</option>
                {topics.map((t) => <option key={t.id} value={t.id}>{t.name} (Form {t.grade})</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-muted-board mb-1 block">Question Type</label>
              <select value={questionForm.question_type} onChange={(e) => setQuestionForm({ ...questionForm, question_type: e.target.value })} className="form-input">
                {QUESTION_TYPES.map((t) => <option key={t} value={t}>{t.replace('_', ' ')}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-muted-board mb-1 block">Difficulty</label>
              <select value={questionForm.difficulty} onChange={(e) => setQuestionForm({ ...questionForm, difficulty: e.target.value })} className="form-input">
                {DIFFICULTY_OPTIONS.map((d) => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-muted-board mb-1 block">Answer Key <span className="text-rust">*</span></label>
              <input type="text" value={questionForm.answer_key} onChange={(e) => setQuestionForm({ ...questionForm, answer_key: e.target.value })} className="form-input" placeholder="e.g. A or 42" />
            </div>
          </div>
          <div>
            <label className="text-xs text-muted-board mb-1 block">Question Text <span className="text-rust">*</span></label>
            <textarea value={questionForm.question_text} onChange={(e) => setQuestionForm({ ...questionForm, question_text: e.target.value })} className="form-input" rows={2} placeholder="Enter the question..." />
          </div>
          {questionForm.question_type === 'multiple_choice' && (
            <div>
              <label className="text-xs text-muted-board mb-1 block">Options (leave blank to skip)</label>
              <div className="grid gap-2 sm:grid-cols-2">
                {questionForm.options.map((opt: string, i: number) => (
                  <input key={i} type="text" value={opt}
                    onChange={(e) => { const newOpts = [...questionForm.options]; newOpts[i] = e.target.value; setQuestionForm({ ...questionForm, options: newOpts }); }}
                    className="form-input" placeholder={`Option ${String.fromCharCode(65 + i)}`} />
                ))}
              </div>
            </div>
          )}
          <div>
            <label className="text-xs text-muted-board mb-1 block">Explanation</label>
            <textarea value={questionForm.explanation} onChange={(e) => setQuestionForm({ ...questionForm, explanation: e.target.value })} className="form-input" rows={2} placeholder="Shown after answering..." />
          </div>
          <button onClick={handleQuestionSubmit} className="btn-gold flex items-center gap-1.5 text-sm px-4 py-2">
            <Plus className="h-4 w-4" /> {editingQuestion ? 'Update Question' : 'Create Question'}
          </button>
        </div>
      )}

      {/* Table */}
      {showTable && <div className="card-board overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/10 text-left text-xs text-muted-board uppercase tracking-widest">
                <th className="px-4 py-3 font-semibold">Question</th>
                <th className="px-4 py-3 font-semibold">Topic</th>
                <th className="px-4 py-3 font-semibold">Type</th>
                <th className="px-4 py-3 font-semibold">Answer</th>
                <th className="px-4 py-3 font-semibold">Difficulty</th>
                <th className="px-4 py-3 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-muted-board">No questions found.</td></tr>
              ) : (
                filtered.map((q) => {
                  const subj = topicSubject(q.topic_id);
                  return (
                    <tr key={q.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                      <td className="px-4 py-3 max-w-xs">
                        <p className="text-chalk text-xs line-clamp-2">{q.question_text}</p>
                        {subj && <span className="text-xs font-semibold mt-1 inline-block" style={{ color: subj.color }}>{subj.name}</span>}
                      </td>
                      <td className="px-4 py-3 text-muted-board text-xs">{topicName(q.topic_id)}</td>
                      <td className="px-4 py-3"><span className="text-xs border border-chalk/20 text-muted-board rounded-full px-2 py-0.5">{q.question_type.replace('_', ' ')}</span></td>
                      <td className="px-4 py-3 text-chalk font-mono-sc text-xs font-bold">{q.answer_key}</td>
                      <td className="px-4 py-3"><span className="text-xs border border-chalk/20 text-muted-board rounded-full px-2 py-0.5">{q.difficulty}</span></td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button onClick={() => handleQuestionEdit(q)} className="p-1.5 text-muted-board hover:text-gold transition-colors"><Pencil className="h-4 w-4" /></button>
                          <button onClick={() => handleQuestionDelete(q.id)} className="p-1.5 text-muted-board hover:text-rust transition-colors"><Trash2 className="h-4 w-4" /></button>
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
