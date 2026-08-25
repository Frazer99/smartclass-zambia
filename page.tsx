"use client";

import { useEffect, useState } from "react";
import RequireAuth from "@/components/RequireAuth";
import { api, ApiError } from "@/lib/api";

type Subject = { id: number; name: string };
type Topic = { id: number; title: string };

function useSubjects() {
  const [subjects, setSubjects] = useState<Subject[]>([]);
  useEffect(() => {
    api.get("/api/catalog/subjects").then(setSubjects);
  }, []);
  return subjects;
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="card">
      <h3 className="font-bold text-brand-900 mb-4">{title}</h3>
      {children}
    </div>
  );
}

function SyllabusUploader() {
  const subjects = useSubjects();
  const [subjectId, setSubjectId] = useState<number | "">("");
  const [formLevel, setFormLevel] = useState(4);
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!subjectId || !file) return;
    const fd = new FormData();
    fd.append("subject_id", String(subjectId));
    fd.append("form_level", String(formLevel));
    fd.append("file", file);
    setStatus("Uploading and parsing...");
    try {
      const res = await api.postForm("/api/admin/syllabus", fd);
      setStatus(`Uploaded. ${res.topics_created} new topic(s) created from this syllabus.`);
    } catch (err) {
      setStatus(err instanceof ApiError ? err.message : "Upload failed");
    }
  }

  return (
    <Section title="Upload syllabus (auto-generates topics)">
      <form onSubmit={submit} className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <select className="input" value={subjectId} onChange={(e) => setSubjectId(Number(e.target.value))} required>
            <option value="">Subject...</option>
            {subjects.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
          <select className="input" value={formLevel} onChange={(e) => setFormLevel(Number(e.target.value))}>
            {[2, 3, 4, 5, 6].map((f) => (
              <option key={f} value={f}>
                Form {f}
              </option>
            ))}
          </select>
        </div>
        <input className="input" type="file" accept=".pdf,.docx,.txt" onChange={(e) => setFile(e.target.files?.[0] || null)} required />
        <button className="btn-primary">Upload syllabus</button>
        {status && <p className="text-sm text-brand-700">{status}</p>}
      </form>
    </Section>
  );
}

function MaterialUploader() {
  const subjects = useSubjects();
  const [subjectId, setSubjectId] = useState<number | "">("");
  const [formLevel, setFormLevel] = useState(4);
  const [topics, setTopics] = useState<Topic[]>([]);
  const [topicId, setTopicId] = useState<number | "">("");
  const [title, setTitle] = useState("");
  const [materialType, setMaterialType] = useState("pamphlet");
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    if (!subjectId) return;
    api.get(`/api/catalog/topics?subject_id=${subjectId}&form_level=${formLevel}`).then(setTopics);
  }, [subjectId, formLevel]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!subjectId || !file || !title) return;
    const fd = new FormData();
    fd.append("subject_id", String(subjectId));
    fd.append("form_level", String(formLevel));
    fd.append("title", title);
    fd.append("material_type", materialType);
    if (topicId) fd.append("topic_id", String(topicId));
    fd.append("file", file);
    setStatus("Uploading...");
    try {
      await api.postForm("/api/admin/materials", fd);
      setStatus("Material uploaded and added to the AI teacher's knowledge base.");
      setTitle("");
      setFile(null);
    } catch (err) {
      setStatus(err instanceof ApiError ? err.message : "Upload failed");
    }
  }

  return (
    <Section title="Upload approved material (textbook, pamphlet, notes)">
      <form onSubmit={submit} className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <select className="input" value={subjectId} onChange={(e) => setSubjectId(Number(e.target.value))} required>
            <option value="">Subject...</option>
            {subjects.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
          <select className="input" value={formLevel} onChange={(e) => setFormLevel(Number(e.target.value))}>
            {[2, 3, 4, 5, 6].map((f) => (
              <option key={f} value={f}>
                Form {f}
              </option>
            ))}
          </select>
        </div>
        <select className="input" value={topicId} onChange={(e) => setTopicId(e.target.value ? Number(e.target.value) : "")}>
          <option value="">(Optional) Link to a specific topic...</option>
          {topics.map((t) => (
            <option key={t.id} value={t.id}>
              {t.title}
            </option>
          ))}
        </select>
        <input className="input" placeholder="Material title" value={title} onChange={(e) => setTitle(e.target.value)} required />
        <select className="input" value={materialType} onChange={(e) => setMaterialType(e.target.value)}>
          <option value="book">Textbook</option>
          <option value="pamphlet">Pamphlet</option>
          <option value="note">Notes</option>
          <option value="marking_scheme">Marking scheme</option>
        </select>
        <input className="input" type="file" accept=".pdf,.docx,.txt" onChange={(e) => setFile(e.target.files?.[0] || null)} required />
        <button className="btn-primary">Upload material</button>
        {status && <p className="text-sm text-brand-700">{status}</p>}
      </form>
    </Section>
  );
}

type QuestionDraft = { question_number: string; question_text: string; marks: string; answer_guide: string };

function PastPaperUploader() {
  const subjects = useSubjects();
  const [subjectId, setSubjectId] = useState<number | "">("");
  const [formLevel, setFormLevel] = useState(4);
  const [year, setYear] = useState(2025);
  const [term, setTerm] = useState("");
  const [title, setTitle] = useState("");
  const [questions, setQuestions] = useState<QuestionDraft[]>([
    { question_number: "1", question_text: "", marks: "", answer_guide: "" },
  ]);
  const [status, setStatus] = useState<string | null>(null);

  function updateQ(i: number, field: keyof QuestionDraft, value: string) {
    setQuestions((qs) => qs.map((q, idx) => (idx === i ? { ...q, [field]: value } : q)));
  }

  function addQuestion() {
    setQuestions((qs) => [...qs, { question_number: String(qs.length + 1), question_text: "", marks: "", answer_guide: "" }]);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!subjectId || !title) return;
    setStatus("Creating past paper...");
    try {
      await api.post("/api/admin/past-papers", {
        subject_id: subjectId,
        form_level: formLevel,
        year,
        term: term || undefined,
        title,
        questions: questions
          .filter((q) => q.question_text.trim())
          .map((q) => ({
            question_number: q.question_number,
            question_text: q.question_text,
            marks: q.marks ? Number(q.marks) : undefined,
            answer_guide: q.answer_guide || undefined,
          })),
      });
      setStatus("Past paper created with question-level breakdown.");
      setTitle("");
      setQuestions([{ question_number: "1", question_text: "", marks: "", answer_guide: "" }]);
    } catch (err) {
      setStatus(err instanceof ApiError ? err.message : "Failed to create past paper");
    }
  }

  return (
    <Section title="Add a past paper (with question-level breakdown)">
      <form onSubmit={submit} className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <select className="input" value={subjectId} onChange={(e) => setSubjectId(Number(e.target.value))} required>
            <option value="">Subject...</option>
            {subjects.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
          <select className="input" value={formLevel} onChange={(e) => setFormLevel(Number(e.target.value))}>
            {[2, 3, 4, 5, 6].map((f) => (
              <option key={f} value={f}>
                Form {f}
              </option>
            ))}
          </select>
        </div>
        <input className="input" placeholder="Paper title, e.g. ECZ Mathematics Form 4 Paper 1" value={title} onChange={(e) => setTitle(e.target.value)} required />
        <div className="grid grid-cols-2 gap-3">
          <input className="input" type="number" placeholder="Year" value={year} onChange={(e) => setYear(Number(e.target.value))} />
          <input className="input" placeholder="Term / Specimen (optional)" value={term} onChange={(e) => setTerm(e.target.value)} />
        </div>

        <div className="space-y-3">
          {questions.map((q, i) => (
            <div key={i} className="border border-brand-100 rounded-lg p-3 space-y-2">
              <div className="grid grid-cols-4 gap-2">
                <input className="input" placeholder="No. e.g. 1 or 2a" value={q.question_number} onChange={(e) => updateQ(i, "question_number", e.target.value)} />
                <input className="input col-span-1" placeholder="Marks" value={q.marks} onChange={(e) => updateQ(i, "marks", e.target.value)} />
                <input
                  className="input col-span-2"
                  placeholder="Question text"
                  value={q.question_text}
                  onChange={(e) => updateQ(i, "question_text", e.target.value)}
                />
              </div>
              <textarea
                className="input"
                placeholder="Answer guide / marking scheme (grounds the AI teacher's walkthrough)"
                value={q.answer_guide}
                onChange={(e) => updateQ(i, "answer_guide", e.target.value)}
              />
            </div>
          ))}
        </div>
        <button type="button" className="btn-secondary text-sm" onClick={addQuestion}>
          + Add another question
        </button>
        <div>
          <button className="btn-primary">Save past paper</button>
        </div>
        {status && <p className="text-sm text-brand-700">{status}</p>}
      </form>
    </Section>
  );
}

function AdminInner() {
  return (
    <div className="max-w-4xl mx-auto px-4 py-10 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-brand-900">Admin -- Content Management</h1>
        <p className="text-brand-700">
          Upload the approved syllabus, textbooks/pamphlets and past papers here. Subjects and topics that learners see
          are generated from what you upload.
        </p>
      </div>
      <SyllabusUploader />
      <MaterialUploader />
      <PastPaperUploader />
    </div>
  );
}

export default function AdminPage() {
  return (
    <RequireAuth adminOnly>
      <AdminInner />
    </RequireAuth>
  );
}
