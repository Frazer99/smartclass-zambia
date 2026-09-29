'use client';

import { useEffect, useState } from 'react';
import { BookOpen, Download, FileText, Loader as Loader2, Search } from 'lucide-react';
import { supabase } from '@/lib/supabase-client';

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
  const [materials, setMaterials] = useState<Material[]>([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [openMaterial, setOpenMaterial] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      const { data } = await supabase
        .from('content_materials')
        .select('id, title, source, source_reference, content_summary, extracted_text, storage_path, material_type, grade, uploaded_at, subject:subjects(name)')
        .order('uploaded_at', { ascending: false });
      setMaterials((data || []) as Material[]);
      setLoading(false);
    })();
  }, []);

  const visibleMaterials = materials.filter((material) => {
    if (!query.trim()) return true;
    const subjectName = Array.isArray(material.subject) ? material.subject[0]?.name : material.subject?.name;
    const searchable = `${material.title} ${material.source} ${subjectName || ''} ${material.content_summary || ''}`.toLowerCase();
    return searchable.includes(query.toLowerCase());
  });

  const downloadMaterial = async (path: string) => {
    const { data } = await supabase.storage.from('content-materials').createSignedUrl(path, 300);
    if (data?.signedUrl) window.open(data.signedUrl, '_blank', 'noopener,noreferrer');
  };

  if (loading) return <div className="flex h-72 items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-gold" /></div>;

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <div className="flex items-center gap-2 mb-1"><BookOpen className="h-5 w-5 text-gold" /><h1 className="font-display text-2xl font-semibold text-chalk">Study Materials</h1></div>
        <p className="text-sm text-muted-board">Browse curriculum documents and reference material whenever you need it.</p>
      </div>
      <label className="flex items-center gap-2 border border-white/15 rounded-lg px-3 py-2.5 bg-board-deep/40"><Search className="h-4 w-4 text-muted-board" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search materials" className="w-full bg-transparent text-sm text-chalk outline-none placeholder:text-muted-board" /></label>
      {visibleMaterials.length === 0 ? <div className="card-board p-8 text-center"><FileText className="h-8 w-8 text-muted-board mx-auto mb-3" /><p className="text-sm text-muted-board">No materials found.</p></div> : <div className="space-y-3">{visibleMaterials.map((material) => { const subjectName = Array.isArray(material.subject) ? material.subject[0]?.name : material.subject?.name; return <article key={material.id} className="card-board overflow-hidden"><div className="p-5"><div className="flex items-start gap-3"><FileText className="h-5 w-5 text-gold mt-0.5 shrink-0" /><div className="min-w-0 flex-1"><h2 className="font-display font-semibold text-chalk">{material.title}</h2><p className="text-xs text-muted-board mt-1">{subjectName || 'General'}{material.grade ? ` · Form ${material.grade}` : ''} · {material.material_type}</p><p className="text-sm text-muted-board mt-3">{material.content_summary || `Source: ${material.source}`}</p></div></div><div className="flex flex-wrap gap-2 mt-4"><button onClick={() => setOpenMaterial(openMaterial === material.id ? null : material.id)} className="border border-white/15 rounded-lg px-3 py-2 text-xs text-chalk hover:border-gold transition-colors">{openMaterial === material.id ? 'Hide document text' : 'Read document text'}</button>{material.storage_path && <button onClick={() => void downloadMaterial(material.storage_path!)} className="inline-flex items-center gap-1.5 border border-white/15 rounded-lg px-3 py-2 text-xs text-chalk hover:border-gold transition-colors"><Download className="h-3.5 w-3.5" /> Download document</button>}</div></div>{openMaterial === material.id && <div className="border-t border-white/10 px-5 py-4"><div className="whitespace-pre-wrap text-sm leading-7 text-chalk/85 max-h-[32rem] overflow-y-auto">{material.extracted_text || 'The document text is not available yet. Download the source document if one is attached.'}</div></div>}</article>; })}</div>}
    </div>
  );
}
