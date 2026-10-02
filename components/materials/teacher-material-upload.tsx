'use client';

import { useEffect, useState } from 'react';
import { FileUp, Loader as Loader2, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import { supabase, Subject, Topic } from '@/lib/supabase-client';
import { createClientId } from '@/lib/client-id';

const FORMS = [1, 2, 3, 4, 5, 6];

export function TeacherMaterialUpload({ teacherGrade }: { teacherGrade: number }) {
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [topics, setTopics] = useState<Topic[]>([]);
  const [form, setForm] = useState({ title: '', source: '', subjectId: '', grade: String(teacherGrade || ''), topicId: '' });
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadedTitle, setUploadedTitle] = useState<string | null>(null);

  useEffect(() => {
    void Promise.all([
      supabase.from('subjects').select('*').order('display_order'),
      supabase.from('topics').select('*').order('grade, display_order'),
    ]).then(([subjectsResult, topicsResult]) => {
      setSubjects((subjectsResult.data || []) as Subject[]);
      setTopics((topicsResult.data || []) as Topic[]);
    });
  }, []);

  const scopedTopics = topics.filter((topic) =>
    topic.subject_id === form.subjectId && String(topic.grade) === form.grade,
  );

  const upload = async () => {
    if (!form.title.trim() || !form.source.trim() || !form.subjectId || !form.grade || !form.topicId || !file) {
      toast.error('Complete the title, source, subject, Form, topic, and file fields.');
      return;
    }
    const isPdf = file.type === 'application/pdf' || /\.pdf$/i.test(file.name);
    const isImage = file.type.startsWith('image/') || /\.(png|jpe?g|webp)$/i.test(file.name);
    if (!isPdf && !isImage) {
      toast.error('Upload a PDF or image file.');
      return;
    }

    setUploading(true);
    setUploadedTitle(null);
    let materialId: string | null = null;
    let storagePath: string | null = null;
    try {
      const { data: material, error: materialError } = await supabase.functions.invoke('content-materials', {
        body: {
          title: form.title.trim(),
          source: form.source.trim(),
          material_type: 'supplementary',
          subject_id: form.subjectId,
          topic_id: form.topicId,
          grade: Number(form.grade),
        },
      });
      if (materialError || !material?.data) throw new Error(materialError?.message || 'The material record could not be created.');
      materialId = material.data.id;
      storagePath = `${createClientId()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
      const { error: uploadError } = await supabase.storage.from('content-materials').upload(storagePath, file, {
        contentType: file.type || (isImage ? 'image/png' : 'application/pdf'),
        upsert: false,
      });
      if (uploadError) throw new Error(`File upload failed: ${uploadError.message}`);

      const { data: ingestResult, error: ingestError } = await supabase.functions.invoke('ingest-material', {
        body: {
          material_id: materialId,
          storage_path: storagePath,
          extracted_text: null,
          file_type: isImage ? 'image' : 'pdf',
          subject_id: form.subjectId,
          topic_id: form.topicId,
          grade: Number(form.grade),
          material_type: 'supplementary',
        },
      });
      if (ingestError || !ingestResult?.success || !ingestResult.extracted_characters) {
        throw new Error(ingestError?.message || 'The file was uploaded but could not be indexed.');
      }

      setUploadedTitle(form.title.trim());
      setForm({ ...form, title: '', source: '', topicId: '' });
      setFile(null);
      toast.success('Material uploaded and added to the AI teacher knowledge base.');
    } catch (error) {
      if (storagePath) await supabase.storage.from('content-materials').remove([storagePath]);
      if (materialId) await supabase.from('content_materials').delete().eq('id', materialId);
      toast.error(error instanceof Error ? error.message : 'Material upload failed.');
    } finally {
      setUploading(false);
    }
  };

  return (
    <section className="card-board p-5 space-y-4">
      <div className="flex items-center gap-2">
        <FileUp className="h-5 w-5 text-gold" />
        <div>
          <h2 className="font-display text-base font-semibold text-chalk">Upload teaching material</h2>
          <p className="text-sm text-muted-board">Add a PDF or image and assign it to the exact subject, Form, and topic.</p>
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <input value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} placeholder="Material title" className="form-input" />
        <input value={form.source} onChange={(event) => setForm({ ...form, source: event.target.value })} placeholder="Source, e.g. teacher notes" className="form-input" />
        <select value={form.subjectId} onChange={(event) => setForm({ ...form, subjectId: event.target.value, topicId: '' })} className="form-input">
          <option value="">Select subject</option>
          {subjects.map((subject) => <option key={subject.id} value={subject.id}>{subject.name}</option>)}
        </select>
        <select value={form.grade} onChange={(event) => setForm({ ...form, grade: event.target.value, topicId: '' })} className="form-input">
          <option value="">Select Form</option>
          {FORMS.map((grade) => <option key={grade} value={grade}>Form {grade}</option>)}
        </select>
        <select value={form.topicId} onChange={(event) => setForm({ ...form, topicId: event.target.value })} className="form-input sm:col-span-2">
          <option value="">Select topic</option>
          {scopedTopics.map((topic) => <option key={topic.id} value={topic.id}>{topic.name}</option>)}
        </select>
        <input type="file" accept="application/pdf,.pdf,image/*,.png,.jpg,.jpeg,.webp" onChange={(event) => setFile(event.target.files?.[0] || null)} className="form-input text-xs sm:col-span-2" />
      </div>
      <button type="button" onClick={upload} disabled={uploading} className="btn-gold inline-flex items-center gap-2 px-4 py-2.5 text-sm disabled:opacity-50">
        {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileUp className="h-4 w-4" />}
        {uploading ? 'Uploading and indexing...' : 'Upload material'}
      </button>
      {uploadedTitle && <p className="flex items-center gap-2 text-sm text-teal"><CheckCircle2 className="h-4 w-4" /> {uploadedTitle} is ready for AI teaching.</p>}
    </section>
  );
}
