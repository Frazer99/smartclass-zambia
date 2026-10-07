'use client';

import { useEffect, useState } from 'react';
import { FileUp, Loader as Loader2, CheckCircle2, Pencil, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { supabase, Subject, Topic } from '@/lib/supabase-client';
import { createClientId } from '@/lib/client-id';
import { extractPdfTextLocally } from '@/lib/pdf-text-extraction';

const FORMS = [1, 2, 3, 4, 5, 6];
type TeacherMaterial = {
  id: string;
  title: string;
  source: string;
  storage_path?: string | null;
  subject?: { name: string }[] | null;
};

export function TeacherMaterialUpload({ teacherGrade }: { teacherGrade: number }) {
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [topics, setTopics] = useState<Topic[]>([]);
  const [form, setForm] = useState({ title: '', source: '', subjectId: '', grade: String(teacherGrade || ''), topicId: '' });
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadedTitle, setUploadedTitle] = useState<string | null>(null);
  const [materials, setMaterials] = useState<TeacherMaterial[]>([]);
  const [editingMaterial, setEditingMaterial] = useState<string | null>(null);
  const [editingValues, setEditingValues] = useState({ title: '', source: '' });

  const loadMaterials = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data } = await supabase
      .from('content_materials')
      .select('id, title, source, storage_path, subject:subjects(name)')
      .eq('uploaded_by', user.id)
      .order('uploaded_at', { ascending: false });
    setMaterials((data || []) as TeacherMaterial[]);
  };

  useEffect(() => {
    void Promise.all([
      supabase.from('subjects').select('*').order('display_order'),
      supabase.from('topics').select('*').order('grade, display_order'),
    ]).then(([subjectsResult, topicsResult]) => {
      setSubjects((subjectsResult.data || []) as Subject[]);
      setTopics((topicsResult.data || []) as Topic[]);
    });
    void loadMaterials();
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
      const extractedText = isPdf ? await extractPdfTextLocally(file) : null;
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
          extracted_text: extractedText,
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
      await loadMaterials();
      toast.success('Material uploaded and added to the AI teacher knowledge base.');
    } catch (error) {
      if (storagePath) await supabase.storage.from('content-materials').remove([storagePath]);
      if (materialId) await supabase.from('content_materials').delete().eq('id', materialId);
      toast.error(error instanceof Error ? error.message : 'Material upload failed.');
    } finally {
      setUploading(false);
    }
  };

  const saveMaterial = async (materialId: string) => {
    const { data: { session } } = await supabase.auth.getSession();
    const response = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/content-materials/${materialId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', ...(session ? { Authorization: `Bearer ${session.access_token}` } : {}) },
      body: JSON.stringify(editingValues),
    });
    if (!response.ok) { const payload = await response.json().catch(() => null); toast.error(payload?.error || 'Material update failed.'); return; }
    setEditingMaterial(null);
    await loadMaterials();
    toast.success('Material details updated.');
  };

  const deleteMaterial = async (material: TeacherMaterial) => {
    if (!confirm(`Delete ${material.title}?`)) return;
    const { data: { session } } = await supabase.auth.getSession();
    const response = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/content-materials/${material.id}`, {
      method: 'DELETE',
      headers: session ? { Authorization: `Bearer ${session.access_token}` } : {},
    });
    if (!response.ok) { const payload = await response.json().catch(() => null); toast.error(payload?.error || 'Material deletion failed.'); return; }
    if (material.storage_path) await supabase.storage.from('content-materials').remove([material.storage_path]);
    await loadMaterials();
    toast.success('Material deleted.');
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
      <div className="border-t border-white/10 pt-4 space-y-3">
        <h3 className="font-display text-sm font-semibold text-chalk">Your uploaded materials</h3>
        {materials.length === 0 ? <p className="text-sm text-muted-board">No materials uploaded by you yet.</p> : materials.map((material) => (
          <div key={material.id} className="flex flex-wrap items-center gap-2 rounded-lg border border-white/10 p-3">
            {editingMaterial === material.id ? <>
              <input value={editingValues.title} onChange={(event) => setEditingValues({ ...editingValues, title: event.target.value })} className="form-input min-w-[12rem] flex-1" aria-label="Material title" />
              <input value={editingValues.source} onChange={(event) => setEditingValues({ ...editingValues, source: event.target.value })} className="form-input min-w-[10rem] flex-1" aria-label="Material source" />
              <button type="button" onClick={() => void saveMaterial(material.id)} className="text-xs text-teal">Save</button>
              <button type="button" onClick={() => setEditingMaterial(null)} className="text-xs text-muted-board">Cancel</button>
            </> : <>
              <div className="min-w-0 flex-1"><p className="truncate text-sm text-chalk">{material.title}</p><p className="text-xs text-muted-board">{material.subject?.[0]?.name || 'Unassigned'} · {material.source}</p></div>
              <button type="button" onClick={() => { setEditingMaterial(material.id); setEditingValues({ title: material.title, source: material.source }); }} className="inline-flex items-center gap-1 text-xs text-gold"><Pencil className="h-3.5 w-3.5" /> Edit</button>
              <button type="button" onClick={() => void deleteMaterial(material)} className="inline-flex items-center gap-1 text-xs text-rust"><Trash2 className="h-3.5 w-3.5" /> Delete</button>
            </>}
          </div>
        ))}
      </div>
    </section>
  );
}
