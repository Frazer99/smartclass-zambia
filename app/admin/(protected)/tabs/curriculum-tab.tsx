import { useState } from 'react';
import { Subject, Topic, Lesson } from '@/lib/supabase-client';
import { BookOpen, Calculator, FlaskConical, Atom, TestTube, ChevronRight, ChevronDown, Plus, X, Upload, Loader as Loader2 } from 'lucide-react';

const subjectIconMap: Record<string, React.ComponentType<{ className?: string; style?: React.CSSProperties }>> = {
  Calculator, FlaskConical, Atom, TestTube,
};

export function CurriculumTab({
  subjects, topics, lessons,
  curriculumSubjectFilter, setCurriculumSubjectFilter,
  showTopicForm, setShowTopicForm, topicForm, setTopicForm, onTopicSubmit,
  syllabusUpload, setSyllabusUpload, onSyllabusUpload, uploadingSyllabus,
}: {
  subjects: Subject[]; topics: Topic[]; lessons: Lesson[];
  curriculumSubjectFilter: string; setCurriculumSubjectFilter: (v: string) => void;
  showTopicForm: boolean; setShowTopicForm: (v: boolean) => void;
  topicForm: any; setTopicForm: (v: any) => void; onTopicSubmit: () => void;
  syllabusUpload: any; setSyllabusUpload: (v: any) => void; onSyllabusUpload: () => void; uploadingSyllabus: boolean;
}) {
  const [showTopics, setShowTopics] = useState(false);
  const filteredTopics = curriculumSubjectFilter
    ? topics.filter((t) => t.subject_id === curriculumSubjectFilter)
    : topics;

  const subjectStats = subjects.map((s) => {
    const sTopics = topics.filter((t) => t.subject_id === s.id);
    const sTopicIds = sTopics.map((t) => t.id);
    const sLessons = lessons.filter((l) => sTopicIds.includes(l.topic_id));
    return { subject: s, topicCount: sTopics.length, lessonCount: sLessons.length };
  });

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-display text-lg font-semibold text-chalk">Curriculum topics</h2>
          <p className="text-sm text-muted-board">Create a topic first, then add lessons and questions to it.</p>
        </div>
        <button onClick={() => setShowTopicForm(!showTopicForm)} className="flex items-center gap-1.5 btn-gold text-sm px-3 py-2">
          {showTopicForm ? <><X className="h-4 w-4" /> Cancel</> : <><Plus className="h-4 w-4" /> Add Topic</>}
        </button>
      </div>

      <div className="card-board p-5 space-y-4">
        <div className="flex items-center gap-2">
          <Upload className="h-5 w-5 text-gold" />
          <div>
            <h3 className="font-display text-lg font-semibold text-chalk">Upload syllabus PDF</h3>
            <p className="text-xs text-muted-board">The system extracts the syllabus and proposes topics for this Form.</p>
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Subject" required><select className="form-input" value={syllabusUpload.subject_id} onChange={(e) => setSyllabusUpload({ ...syllabusUpload, subject_id: e.target.value })}><option value="">Select subject...</option>{subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></Field>
          <Field label="Form" required><select className="form-input" value={syllabusUpload.grade} onChange={(e) => setSyllabusUpload({ ...syllabusUpload, grade: e.target.value })}><option value="">Select form...</option>{[1, 2, 3, 4, 5, 6].map((g) => <option key={g} value={g}>Form {g}</option>)}</select></Field>
          <Field label="PDF file" required><input className="form-input text-xs" type="file" accept="application/pdf,.pdf" onChange={(e) => setSyllabusUpload({ ...syllabusUpload, file: e.target.files?.[0] || null })} /></Field>
        </div>
        <Field label="Title"><input className="form-input" value={syllabusUpload.title} onChange={(e) => setSyllabusUpload({ ...syllabusUpload, title: e.target.value })} placeholder="e.g. Mathematics Syllabus Form 3" /></Field>
        <button onClick={onSyllabusUpload} disabled={uploadingSyllabus} className="btn-gold flex items-center gap-1.5 text-sm px-4 py-2 disabled:opacity-50">
          {uploadingSyllabus ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
          {uploadingSyllabus ? 'Processing syllabus...' : 'Upload and generate topics'}
        </button>
      </div>

      {showTopicForm && (
        <div className="card-board p-5 space-y-4 animate-slide-up">
          <h3 className="font-semibold text-chalk">New curriculum topic</h3>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Subject" required><select className="form-input" value={topicForm.subject_id} onChange={(e) => setTopicForm({ ...topicForm, subject_id: e.target.value })}><option value="">Select subject...</option>{subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></Field>
            <Field label="Form" required><select className="form-input" value={topicForm.grade} onChange={(e) => setTopicForm({ ...topicForm, grade: e.target.value })}><option value="">Select form...</option>{[1, 2, 3, 4, 5, 6].map((g) => <option key={g} value={g}>Form {g}</option>)}</select></Field>
            <Field label="Topic name" required><input className="form-input" value={topicForm.name} onChange={(e) => setTopicForm({ ...topicForm, name: e.target.value })} placeholder="e.g. Linear equations" /></Field>
            <Field label="Category"><input className="form-input" value={topicForm.category} onChange={(e) => setTopicForm({ ...topicForm, category: e.target.value })} placeholder="e.g. Algebra" /></Field>
            <Field label="Syllabus reference"><input className="form-input" value={topicForm.syllabus_reference} onChange={(e) => setTopicForm({ ...topicForm, syllabus_reference: e.target.value })} placeholder="e.g. ECZ 2.1" /></Field>
            <Field label="Display order"><input className="form-input" type="number" value={topicForm.display_order} onChange={(e) => setTopicForm({ ...topicForm, display_order: Number(e.target.value) || 0 })} /></Field>
          </div>
          <Field label="Description"><textarea className="form-input" rows={2} value={topicForm.description} onChange={(e) => setTopicForm({ ...topicForm, description: e.target.value })} /></Field>
          <button onClick={onTopicSubmit} className="btn-gold flex items-center gap-1.5 text-sm px-4 py-2"><Plus className="h-4 w-4" /> Create Topic</button>
        </div>
      )}

      {/* Subject cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {subjectStats.map(({ subject, topicCount, lessonCount }) => {
          const Icon = subjectIconMap[subject.icon] || BookOpen;
          return (
            <div key={subject.id} className="card-board p-4 cursor-pointer hover:border-white/20 transition-colors"
              onClick={() => setCurriculumSubjectFilter(curriculumSubjectFilter === subject.id ? '' : subject.id)}
              style={curriculumSubjectFilter === subject.id ? { borderColor: subject.color } : undefined}>
              <div className="flex items-center gap-2 mb-2">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: `${subject.color}25` }}>
                  <Icon className="h-4 w-4" style={{ color: subject.color }} />
                </div>
                <span className="font-semibold text-chalk text-sm">{subject.name}</span>
              </div>
              <div className="flex gap-3 text-xs text-muted-board">
                <span>Grades {subject.grades.join(', ')}</span>
              </div>
              <div className="flex gap-3 text-xs mt-1">
                <span className="text-chalk font-mono-sc">{topicCount} topics</span>
                <span className="text-chalk font-mono-sc">{lessonCount} lessons</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Filter label */}
      <div className="flex items-center justify-between">
        <button type="button" onClick={() => setShowTopics((visible) => !visible)} aria-expanded={showTopics} className="flex items-center gap-2 text-left font-display text-base font-semibold text-chalk hover:text-gold transition-colors">
          <span>Topics {curriculumSubjectFilter && `(${subjects.find((s) => s.id === curriculumSubjectFilter)?.name})`}</span>
          <ChevronDown className={`h-4 w-4 transition-transform ${showTopics ? 'rotate-180' : ''}`} />
        </button>
        {curriculumSubjectFilter && (
          <button onClick={() => setCurriculumSubjectFilter('')} className="text-xs text-muted-board hover:text-chalk">Clear filter</button>
        )}
      </div>

      {/* Topics list */}
      {showTopics && <div className="space-y-2 animate-slide-up">
        {filteredTopics.length === 0 ? (
          <div className="card-board p-8 text-center text-muted-board text-sm">No topics found.</div>
        ) : (
          filteredTopics.map((topic) => {
            const tLessons = lessons.filter((l) => l.topic_id === topic.id);
            const subj = subjects.find((s) => s.id === topic.subject_id);
            return (
              <div key={topic.id} className="card-board p-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      {subj && <span className="text-xs font-semibold rounded-full px-2 py-0.5" style={{ background: `${subj.color}25`, color: subj.color }}>{subj.name}</span>}
                      <span className="text-xs text-muted-board">{topic.category}</span>
                      <span className="text-xs text-muted-board font-mono-sc">Form {topic.grade}</span>
                    </div>
                    <h4 className="font-semibold text-chalk text-sm">{topic.name}</h4>
                    {topic.description && <p className="text-xs text-muted-board mt-0.5">{topic.description}</p>}
                    <div className="flex gap-3 mt-2 text-xs text-muted-board">
                      <span className="font-mono-sc">{tLessons.length} lessons</span>
                      <span>Ref: {topic.syllabus_reference || '—'}</span>
                    </div>
                  </div>
                </div>
                {tLessons.length > 0 && (
                  <div className="mt-3 border-t border-white/5 pt-2 space-y-1">
                    {tLessons.map((l, i) => (
                      <div key={l.id} className="flex items-center gap-2 text-xs text-muted-board">
                        <ChevronRight className="h-3 w-3" />
                        <span className="text-chalk/80">{l.title}</span>
                        <span className="ml-auto text-muted-board/60">{l.difficulty}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>}
    </div>
  );
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return <div><label className="text-xs text-muted-board mb-1 block">{label} {required && <span className="text-rust">*</span>}</label>{children}</div>;
}
