'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { BookOpen, Download, FileText, Loader as Loader2, Search } from 'lucide-react';
import { useAuth } from '@/components/auth-provider';
import { supabase, Subject } from '@/lib/supabase-client';

type Material = {
  id: string;
  title: string;
  source: string;
  source_reference: string | null;
  content_summary: string | null;
  extracted_text: string | null;
  storage_path: string | null;
  material_type: string;
  grade: number | null;
  uploaded_at: string;
  subject: { name: string } | { name: string }[] | null;
};

export default function MaterialsPage() {
  const { profile } = useAuth();
  const searchParams = useSearchParams();
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [activeSubjectId, setActiveSubjectId] = useState('');
  const [materials, setMaterials] = useState<Material[]>([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [openMaterial, setOpenMaterial] = useState<string | null>(null);

  useEffect(() => {
    if (!profile) return;
    void (async () => {
      const { data } = await supabase.from('subjects').select('*').order('display_order');
      const availableSubjects = ((data || []) as Subject[]).filter((subject) => subject.grades.includes(profile.grade));
      setSubjects(availableSubjects);
      const requestedSubject = searchParams.get('subject');
      setActiveSubjectId(availableSubjects.some((subject) => subject.id === requestedSubject) ? requestedSubject! : '');
      setLoading(false);
    })();
  }, [profile, searchParams]);

  useEffect(() => {
    const searchTerm = query.trim();
    if (!activeSubjectId || !profile || !searchTerm) {
      setMaterials([]);
      setLoading(false);
      return;
    }
    void (async () => {
      setLoading(true);
      const safeSearchTerm = searchTerm.replace(/[%_(),]/g, ' ');
      const { data } = await supabase
        .from('content_materials')
        .select('id, title, source, source_reference, content_summary, extracted_text, storage_path, material_type, grade, uploaded_at, subject:subjects(name)')
        .eq('subject_id', activeSubjectId)
        .or(`title.ilike.%${safeSearchTerm}%,source.ilike.%${safeSearchTerm}%,content_summary.ilike.%${safeSearchTerm}%`)
        .order('uploaded_at', { ascending: false });
      setMaterials((data || []) as Material[]);
      setLoading(false);
    })();
  }, [activeSubjectId, profile, query]);

  const visibleMaterials = materials.filter((material) => {
    if (!query.trim()) return false;
    const subjectName = Array.isArray(material.subject) ? material.subject[0]?.name : material.subject?.name;
    const searchable = `${material.title} ${material.source} ${subjectName || ''} ${material.content_summary || ''}`.toLowerCase();
    return searchable.includes(query.toLowerCase());
  });

  const downloadMaterial = async (path: string) => {
    const { data } = await supabase.storage.from('content-materials').createSignedUrl(path, 300);
    if (data?.signedUrl) window.open(data.signedUrl, '_blank', 'noopener,noreferrer');
  };

  if (loading && subjects.length === 0) return <div className="flex h-72 items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-gold" /></div>;

  const activeSubject = subjects.find((subject) => subject.id === activeSubjectId);

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <div className="flex items-center gap-2 mb-1"><BookOpen className="h-5 w-5 text-gold" /><h1 className="font-display text-2xl font-semibold text-chalk">Study Materials</h1></div>
        <p className="text-sm text-muted-board">Select a subject to view only the materials assigned to it.</p>
      </div>
      <label htmlFor="materials-subject" className="sr-only">Select subject</label>
      <select id="materials-subject" value={activeSubjectId} onChange={(event) => { setActiveSubjectId(event.target.value); setQuery(''); setOpenMaterial(null); }} className="w-full rounded-lg border border-white/15 bg-board-deep px-4 py-3 text-sm text-chalk outline-none focus:border-gold">
        <option value="">Select a subject</option>
        {subjects.map((subject) => <option key={subject.id} value={subject.id}>{subject.name}</option>)}
      </select>
      {!activeSubjectId ? <div className="card-board p-8 text-center"><BookOpen className="h-8 w-8 text-muted-board mx-auto mb-3" /><p className="text-sm text-muted-board">Choose a subject to load its study materials.</p></div> : <>
        <h2 className="font-display text-lg font-semibold text-chalk">{activeSubject?.name} materials</h2>
        <label className="flex items-center gap-2 border border-white/15 rounded-lg px-3 py-2.5 bg-board-deep/40"><Search className="h-4 w-4 text-muted-board" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={`Search ${activeSubject?.name} materials`} className="w-full bg-transparent text-sm text-chalk outline-none placeholder:text-muted-board" /></label>
        {!query.trim() ? <div className="card-board p-8 text-center"><Search className="h-8 w-8 text-muted-board mx-auto mb-3" /><p className="text-sm text-muted-board">Search for a material in {activeSubject?.name}.</p></div> : loading ? <div className="flex h-40 items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-gold" /></div> : visibleMaterials.length === 0 ? <div className="card-board p-8 text-center"><FileText className="h-8 w-8 text-muted-board mx-auto mb-3" /><p className="text-sm text-muted-board">No materials found for &quot;{query}&quot;.</p></div> : <div className="space-y-3">{visibleMaterials.map((material) => { const subjectName = Array.isArray(material.subject) ? material.subject[0]?.name : material.subject?.name; return <article key={material.id} className="card-board overflow-hidden"><div className="p-5"><div className="flex items-start gap-3"><FileText className="h-5 w-5 text-gold mt-0.5 shrink-0" /><div className="min-w-0 flex-1"><h2 className="font-display font-semibold text-chalk">{material.title}</h2><p className="text-xs text-muted-board mt-1">{subjectName || 'General'}{material.grade ? ` · Form ${material.grade}` : ''} · {material.material_type}</p><p className="text-sm text-muted-board mt-3">{material.content_summary || `Source: ${material.source}`}</p></div></div><div className="flex flex-wrap gap-2 mt-4"><button onClick={() => setOpenMaterial(openMaterial === material.id ? null : material.id)} className="border border-white/15 rounded-lg px-3 py-2 text-xs text-chalk hover:border-gold transition-colors">{openMaterial === material.id ? 'Hide document text' : 'Read document text'}</button>{material.storage_path && <button onClick={() => void downloadMaterial(material.storage_path!)} className="inline-flex items-center gap-1.5 border border-white/15 rounded-lg px-3 py-2 text-xs text-chalk hover:border-gold transition-colors"><Download className="h-3.5 w-3.5" /> Download document</button>}</div></div>{openMaterial === material.id && <div className="border-t border-white/10 px-5 py-4"><div className="whitespace-pre-wrap text-sm leading-7 text-chalk/85 max-h-[32rem] overflow-y-auto">{material.extracted_text || 'The document text is not available yet. Download the source document if one is attached.'}</div></div>}</article>; })}</div>}
      </>}
    </div>
  );
}
