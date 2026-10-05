import { useEffect, useState } from 'react';
import { Subject, Topic, ContentMaterial } from '@/lib/supabase-client';
import { FileText, Check, Loader as Loader2, Award, Building2, RefreshCw, Plus, X, Pencil, Trash2, ExternalLink, Sparkles, Search, ChevronDown } from 'lucide-react';

const MATERIAL_TYPES = ['curriculum', 'syllabus', 'past_paper', 'textbook', 'video', 'supplementary'];
const STATUS_OPTIONS = ['approved', 'ingested'];
const FORMS = [1, 2, 3, 4, 5, 6];
type MaterialFilter = 'all' | 'approved' | 'ingested';

export function MaterialsTab({
  materials, subjects, showAddForm, setShowAddForm, form, setForm, handleAdd, handleUpdate, handleDelete,
  topics,
  handleSync, syncing, syncResult, editingId, setEditingId,
  handleGenerateEmbeddings, embedding, embeddingResult,
  handleExtractCurrentMaterials, materialExtraction,
  selectedFile, setSelectedFile,
}: any) {
  const scopedTopics = (topics as Topic[]).filter((topic) =>
    form.subject_id && form.grade
      ? topic.subject_id === form.subject_id && String(topic.grade) === String(form.grade)
      : false,
  );
  const [activeFilter, setActiveFilter] = useState<MaterialFilter>('all');
  const [showFilteredMaterials, setShowFilteredMaterials] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [openMaterialId, setOpenMaterialId] = useState<string | null>(null);
  const statusFilteredMaterials = activeFilter === 'all'
    ? materials
    : materials.filter((material: ContentMaterial) => material.status === activeFilter);
  const normalizedSearchQuery = searchQuery.trim().toLowerCase();
  const filteredMaterials = normalizedSearchQuery
    ? statusFilteredMaterials.filter((material: ContentMaterial) => {
      const subjectName = (material as any).subject?.name || '';
      return [material.title, material.source, material.material_type, subjectName]
        .some((value) => String(value).toLowerCase().includes(normalizedSearchQuery));
    })
    : statusFilteredMaterials;

  useEffect(() => {
    if (showFilteredMaterials) {
      document.getElementById('all-materials')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [showFilteredMaterials]);

  const selectFilter = (filter: MaterialFilter) => {
    setActiveFilter(filter);
    setShowFilteredMaterials(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex gap-4 flex-wrap">
        <StatCard value={String(materials.length)} label="Total" icon={<FileText className="h-4 w-4" />} active={activeFilter === 'all'} onClick={() => selectFilter('all')} />
        <StatCard value={String(materials.filter((m: ContentMaterial) => m.status === 'approved').length)} label="Approved" icon={<Check className="h-4 w-4" />} color="text-teal" active={activeFilter === 'approved'} onClick={() => selectFilter('approved')} />
        <StatCard value={String(materials.filter((m: ContentMaterial) => m.status === 'ingested').length)} label="Ingested" icon={<Award className="h-4 w-4" />} color="text-rust" active={activeFilter === 'ingested'} onClick={() => selectFilter('ingested')} />
      </div>

      <div className="card-board p-5">
        <div className="flex items-center gap-2 mb-3">
          <Building2 className="h-5 w-5 text-gold" />
          <h2 className="font-display text-lg font-semibold text-chalk">Curriculum Sync</h2>
        </div>
        <p className="text-muted-board text-sm mb-4">
          Sync from the Ministry of Education (Directorate of Curriculum Development) and ECZ. Past papers are ECZ documents, uploaded manually below when a direct ECZ system integration isn't available. This ensures the AI teacher teaches from approved Zambian curriculum materials first.
        </p>
        <div className="flex flex-wrap gap-3">
          <button onClick={() => handleSync('moe')} disabled={syncing !== null}
            className="flex items-center gap-2 border-2 border-teal/40 text-teal rounded-lg px-4 py-2.5 text-sm font-semibold hover:bg-teal/10 transition-colors disabled:opacity-40">
            {syncing === 'moe' ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            Sync Ministry of Education
          </button>
          <button onClick={() => handleSync('ecz')} disabled={syncing !== null}
            className="flex items-center gap-2 border-2 border-gold/40 text-gold rounded-lg px-4 py-2.5 text-sm font-semibold hover:bg-gold/10 transition-colors disabled:opacity-40">
            {syncing === 'ecz' ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            Sync ECZ Past Papers
          </button>
          <button onClick={() => handleSync('all')} disabled={syncing !== null}
            className="flex items-center gap-2 btn-gold text-sm px-4 py-2.5 disabled:opacity-40">
            {syncing === 'all' ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            Sync All Sources
          </button>
        </div>
        {syncResult && (
          <div className="mt-4 border border-teal/30 bg-teal/10 rounded-lg p-3 text-sm text-chalk">
            <span className="font-semibold text-teal">{syncResult.source}:</span> {syncResult.message}
          </div>
        )}
      </div>

      <div className="card-board p-5">
        <div className="flex items-center gap-2 mb-3">
          <Sparkles className="h-5 w-5 text-gold" />
          <h2 className="font-display text-lg font-semibold text-chalk">Semantic Search (Embeddings)</h2>
        </div>
        <p className="text-muted-board text-sm mb-4">
          Generates real pgvector embeddings for any material, search-index entry, or past-paper question that
          doesn't have one yet, so Mr. Chomba can find conceptually related content even when a pupil's wording
          doesn't share keywords with the source material. New materials added above are embedded automatically —
          this backfills anything created before embeddings existed, or before an OpenAI API key was configured.
          Requires <code className="text-gold">OPENAI_API_KEY</code> to be set as an Edge Function secret.
        </p>
        <button onClick={handleGenerateEmbeddings} disabled={embedding}
          className="flex items-center gap-2 btn-gold text-sm px-4 py-2.5 disabled:opacity-40">
          {embedding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
          {embedding ? 'Generating embeddings...' : 'Generate Embeddings'}
        </button>
        {embeddingResult && (
          <div className="mt-4 border border-gold/30 bg-gold/10 rounded-lg p-3 text-sm text-chalk">
            <span className="font-semibold text-gold">Embedded {embeddingResult.embedded} rows</span>
            {embeddingResult.failed > 0 && <span className="text-rust"> · {embeddingResult.failed} failed</span>}
            {embeddingResult.remaining > 0 && !embedding && (
              <span className="text-muted-board"> · {embeddingResult.remaining} still remaining — click again to continue</span>
            )}
          </div>
        )}
      </div>

      <div className="card-board p-5">
        <div className="flex items-center gap-2 mb-3">
          <RefreshCw className="h-5 w-5 text-gold" />
          <h2 className="font-display text-lg font-semibold text-chalk">Extract Stored PDFs</h2>
        </div>
        <p className="text-muted-board text-sm mb-4">
          Re-extracts every stored PDF with the page-aware browser extractor and refreshes its AI index. Existing records are updated in place.
        </p>
        <button onClick={handleExtractCurrentMaterials} disabled={Boolean(materialExtraction)}
          className="flex items-center gap-2 btn-gold text-sm px-4 py-2.5 disabled:opacity-40">
          {materialExtraction ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          {materialExtraction ? `Extracting ${materialExtraction.processed + materialExtraction.failed}/${materialExtraction.total}...` : 'Extract Current Materials'}
        </button>
        {materialExtraction && (
          <p className="mt-3 text-sm text-muted-board">
            Completed {materialExtraction.processed} · Failed {materialExtraction.failed} · Total {materialExtraction.total}
          </p>
        )}
      </div>

      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h2 className="font-display text-lg font-semibold text-chalk">All Materials</h2>
        <div className="flex items-center gap-2 flex-wrap">
          <label className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-board" />
            <input
              value={searchQuery}
              onChange={(event) => { setSearchQuery(event.target.value); setShowFilteredMaterials(true); }}
              placeholder="Search materials"
              aria-label="Search materials"
              className="form-input w-56 pl-9"
            />
          </label>
          <button type="button" onClick={() => setShowFilteredMaterials(!showFilteredMaterials)} className="flex items-center gap-1.5 border border-white/15 rounded-lg px-3 py-2 text-sm text-chalk hover:border-gold transition-colors">
            {showFilteredMaterials ? <><X className="h-4 w-4" /> Close materials</> : <><FileText className="h-4 w-4" /> Open all materials</>}
          </button>
          <button onClick={() => setShowAddForm(!showAddForm)} className="flex items-center gap-1.5 btn-gold text-sm px-3 py-2">
            {showAddForm ? <><X className="h-4 w-4" /> Cancel</> : <><Plus className="h-4 w-4" /> Add Material</>}
          </button>
        </div>
      </div>

      {showAddForm && (
        <div className="card-board p-5 space-y-4 animate-slide-up">
          <h3 className="font-semibold text-chalk">New Content material</h3>
          <div className="grid gap-3 sm:grid-cols-2">
            <FormField label="Title" required>
              <input type="text" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className="form-input" placeholder="e.g. ECZ Mathematics Past Paper 2023" />
            </FormField>
            <FormField label="Source" required>
              <input type="text" value={form.source} onChange={(e) => setForm({ ...form, source: e.target.value })} className="form-input" placeholder="e.g. Examinations Council of Zambia" />
            </FormField>
            <FormField label="Material Type">
              <select value={form.material_type} onChange={(e) => setForm({ ...form, material_type: e.target.value, topic_id: '' })} className="form-input">
                {MATERIAL_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </FormField>
            <FormField label="Subject">
              <select value={form.subject_id} onChange={(e) => setForm({ ...form, subject_id: e.target.value, topic_id: '' })} className="form-input">
                <option value="">— All subjects —</option>
                {subjects.map((s: Subject) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </FormField>
            <FormField label="Form">
              <select value={form.grade} onChange={(e) => setForm({ ...form, grade: e.target.value, topic_id: '' })} className="form-input">
                <option value="">— All grades —</option>
                {FORMS.map((g) => <option key={g} value={g}>Form {g}</option>)}
              </select>
            </FormField>
            {form.material_type !== 'curriculum' && form.material_type !== 'syllabus' && (
              <FormField label="Topic" required>
                <select value={form.topic_id} onChange={(e) => setForm({ ...form, topic_id: e.target.value })} className="form-input">
                  <option value="">— Select topic —</option>
                  {scopedTopics.map((topic) => <option key={topic.id} value={topic.id}>{topic.name}</option>)}
                </select>
              </FormField>
            )}
            <FormField label="PDF, image, or video file" required>
              <input
                type="file"
                accept="application/pdf,.pdf,image/*,.png,.jpg,.jpeg,.webp,video/*,.mp4,.webm,.mov,.m4v,.mkv"
                onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                className="form-input text-xs"
              />
            </FormField>
          </div>
          <p className="text-xs text-muted-board">PDF and image uploads are OCR-indexed for AI search. Video uploads are transcribed with Whisper. Assign every study material to its subject, Form, and topic.</p>
          <FormField label="Source Reference (URL)">
            <input type="text" value={form.source_reference} onChange={(e) => setForm({ ...form, source_reference: e.target.value })} className="form-input" placeholder="e.g. ecz.edu.zm/pastpapers/maths" />
          </FormField>
          <FormField label="Content Summary">
            <textarea value={form.content_summary} onChange={(e) => setForm({ ...form, content_summary: e.target.value })} className="form-input" rows={3} placeholder="Brief description of what this material covers..." />
          </FormField>
          <button onClick={handleAdd} className="btn-gold flex items-center gap-1.5 text-sm px-4 py-2">
            <Plus className="h-4 w-4" /> Add Material
          </button>
        </div>
      )}

      {showFilteredMaterials && <div id="all-materials" className="scroll-mt-6">
        <div className="card-board max-h-[38rem] overflow-y-auto divide-y divide-white/10">
          {filteredMaterials.length === 0 ? <p className="px-4 py-8 text-center text-muted-board">{normalizedSearchQuery ? `No materials match "${searchQuery}".` : activeFilter === 'all' ? 'No materials found. Use sync or add manually.' : `No ${activeFilter} materials found.`}</p> : filteredMaterials.map((m: ContentMaterial) => {
            const expanded = openMaterialId === m.id;
            return <article key={m.id}>
              <button type="button" onClick={() => setOpenMaterialId(expanded ? null : m.id)} className="flex w-full items-center justify-between gap-3 px-4 py-4 text-left hover:bg-white/[0.04]">
                <div className="min-w-0"><p className="truncate font-medium text-chalk">{m.title}</p><p className="mt-1 text-xs text-muted-board">{(m as any).subject?.name || '—'}{m.grade ? ` · Form ${m.grade}` : ''} · {m.material_type}</p></div>
                <div className="flex shrink-0 items-center gap-3"><StatusBadge status={m.status} /><ChevronDown className={`h-4 w-4 text-muted-board transition-transform ${expanded ? 'rotate-180' : ''}`} /></div>
              </button>
              {expanded && <div className="space-y-3 border-t border-white/10 px-4 py-4">
                <div className="grid gap-2 text-xs text-muted-board sm:grid-cols-2"><span>Source: <strong className="text-chalk">{m.source}</strong></span><span>Type: <strong className="text-chalk">{m.material_type}</strong></span></div>
                {m.content_summary && <p className="text-sm text-muted-board">{m.content_summary}</p>}
                {(m as any).ingestion_error && <p className="text-xs text-rust">{(m as any).ingestion_error}</p>}
                {m.source_reference && <a href={`https://${m.source_reference}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-gold/70 hover:text-gold"><ExternalLink className="h-3 w-3" /> {m.source_reference}</a>}
                <div className="flex items-center gap-2">
                  {editingId === m.id ? <><select value={m.status} onChange={(e) => handleUpdate(m.id, { status: e.target.value })} className="bg-white/5 border border-white/10 rounded text-xs text-chalk px-1.5 py-1">{STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}</select><button onClick={() => setEditingId(null)} className="p-1.5 text-muted-board hover:text-chalk"><X className="h-4 w-4" /></button></> : <><button onClick={() => setEditingId(m.id)} className="inline-flex items-center gap-1.5 border border-white/15 rounded-lg px-2.5 py-1.5 text-xs text-muted-board hover:text-gold"><Pencil className="h-3.5 w-3.5" /> Edit status</button><button onClick={() => handleDelete(m.id)} className="inline-flex items-center gap-1.5 border border-rust/40 rounded-lg px-2.5 py-1.5 text-xs text-rust hover:bg-rust/10"><Trash2 className="h-3.5 w-3.5" /> Delete</button></>}
                </div>
              </div>}
            </article>;
          })}
        </div>
      </div>}
    </div>
  );
}

function StatCard({ value, label, icon, color = 'text-chalk', active = false, onClick }: { value: string; label: string; icon: React.ReactNode; color?: string; active?: boolean; onClick?: () => void }) {
  return (
    <button type="button" onClick={onClick} aria-pressed={active} className={`card-board px-4 py-3 min-w-[120px] text-left hover:border-gold/50 transition-colors cursor-pointer ${active ? 'border-gold ring-1 ring-gold/40' : ''}`}>
      <div className={`flex items-center gap-1.5 ${color} mb-1`}>{icon}</div>
      <div className="font-mono-sc text-xl font-bold text-chalk">{value}</div>
      <div className="text-xs text-muted-board">{label}</div>
    </button>
  );
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    approved: 'text-teal border-teal/40 bg-teal/10',
    pending: 'text-gold border-gold/40 bg-gold/10',
    ingested: 'text-rust border-rust/40 bg-rust/10',
  };
  return <span className={`text-xs font-semibold rounded-full px-2.5 py-0.5 border ${colors[status] || colors.pending}`}>{status}</span>;
}

function FormField({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-xs text-muted-board mb-1 block">{label} {required && <span className="text-rust">*</span>}</label>
      {children}
    </div>
  );
}
