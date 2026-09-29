import { useEffect, useState } from 'react';
import { Subject, ContentMaterial } from '@/lib/supabase-client';
import { FileText, Check, Loader as Loader2, Award, Building2, RefreshCw, Plus, X, Pencil, Trash2, ExternalLink, Sparkles } from 'lucide-react';

const MATERIAL_TYPES = ['curriculum', 'syllabus', 'past_paper', 'textbook', 'video', 'supplementary'];
const STATUS_OPTIONS = ['pending', 'approved', 'ingested'];
const FORMS = [1, 2, 3, 4, 5, 6];
type MaterialFilter = 'all' | 'approved' | 'pending' | 'ingested';

export function MaterialsTab({
  materials, subjects, showAddForm, setShowAddForm, form, setForm, handleAdd, handleUpdate, handleDelete,
  handleSync, syncing, syncResult, editingId, setEditingId,
  handleGenerateEmbeddings, embedding, embeddingResult,
  selectedFile, setSelectedFile,
}: any) {
  const [activeFilter, setActiveFilter] = useState<MaterialFilter>('all');
  const [showFilteredMaterials, setShowFilteredMaterials] = useState(false);
  const filteredMaterials = activeFilter === 'all'
    ? materials
    : materials.filter((material: ContentMaterial) => material.status === activeFilter);

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
        <StatCard value={String(materials.filter((m: ContentMaterial) => m.status === 'pending').length)} label="Pending" icon={<Loader2 className="h-4 w-4" />} color="text-gold" active={activeFilter === 'pending'} onClick={() => selectFilter('pending')} />
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

      <div className="flex items-center justify-between">
        <h2 className="font-display text-lg font-semibold text-chalk">All Materials</h2>
        <button onClick={() => setShowAddForm(!showAddForm)} className="flex items-center gap-1.5 btn-gold text-sm px-3 py-2">
          {showAddForm ? <><X className="h-4 w-4" /> Cancel</> : <><Plus className="h-4 w-4" /> Add Material</>}
        </button>
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
              <select value={form.material_type} onChange={(e) => setForm({ ...form, material_type: e.target.value })} className="form-input">
                {MATERIAL_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </FormField>
            <FormField label="Subject">
              <select value={form.subject_id} onChange={(e) => setForm({ ...form, subject_id: e.target.value })} className="form-input">
                <option value="">— All subjects —</option>
                {subjects.map((s: Subject) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </FormField>
            <FormField label="Form">
              <select value={form.grade} onChange={(e) => setForm({ ...form, grade: e.target.value })} className="form-input">
                <option value="">— All grades —</option>
                {FORMS.map((g) => <option key={g} value={g}>Form {g}</option>)}
              </select>
            </FormField>
            <FormField label="Status">
              <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} className="form-input">
                {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </FormField>
            <FormField label="PDF or video file" required>
              <input
                type="file"
                accept="application/pdf,.pdf,video/*,.mp4,.webm,.mov,.m4v,.mkv"
                onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                className="form-input text-xs"
              />
            </FormField>
          </div>
          <p className="text-xs text-muted-board">PDF uploads use local text extraction and OCR. Video uploads are transcribed with Whisper, then indexed for AI search. Keep video files under 25 MB for transcription.</p>
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
        <div className="card-board overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/10 text-left text-xs text-muted-board uppercase tracking-widest">
                <th className="px-4 py-3 font-semibold">Title</th>
                <th className="px-4 py-3 font-semibold">Source</th>
                <th className="px-4 py-3 font-semibold">Type</th>
                <th className="px-4 py-3 font-semibold">Subject</th>
                <th className="px-4 py-3 font-semibold">Status</th>
                <th className="px-4 py-3 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredMaterials.length === 0 ? (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-muted-board">
                  {activeFilter === 'all' ? 'No materials found. Use sync or add manually.' : `No ${activeFilter} materials found.`}
                </td></tr>
              ) : (
                filteredMaterials.map((m: ContentMaterial) => (
                  <tr key={m.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                    <td className="px-4 py-3">
                      <p className="font-medium text-chalk">{m.title}</p>
                      {m.content_summary && <p className="text-xs text-muted-board mt-0.5 line-clamp-1">{m.content_summary}</p>}
                      {(m as any).ingestion_error && <p className="text-xs text-rust mt-0.5 line-clamp-2">{(m as any).ingestion_error}</p>}
                      {m.source_reference && (
                        <a href={`https://${m.source_reference}`} target="_blank" rel="noopener noreferrer" className="text-xs text-gold/70 hover:text-gold inline-flex items-center gap-0.5 mt-0.5">
                          <ExternalLink className="h-3 w-3" /> {m.source_reference}
                        </a>
                      )}
                    </td>
                    <td className="px-4 py-3 text-muted-board text-xs">{m.source}</td>
                    <td className="px-4 py-3"><span className="text-xs border border-chalk/20 text-muted-board rounded-full px-2 py-0.5">{m.material_type}</span></td>
                    <td className="px-4 py-3 text-muted-board text-xs">{(m as any).subject?.name || '—'}{m.grade ? ` (G${m.grade})` : ''}</td>
                    <td className="px-4 py-3"><StatusBadge status={m.status} /></td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        {editingId === m.id ? (
                          <>
                            <select value={m.status} onChange={(e) => handleUpdate(m.id, { status: e.target.value })} className="bg-white/5 border border-white/10 rounded text-xs text-chalk px-1.5 py-1">
                              {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
                            </select>
                            <button onClick={() => setEditingId(null)} className="p-1.5 text-muted-board hover:text-chalk"><X className="h-4 w-4" /></button>
                          </>
                        ) : (
                          <>
                            <button onClick={() => setEditingId(m.id)} className="p-1.5 text-muted-board hover:text-gold transition-colors"><Pencil className="h-4 w-4" /></button>
                            <button onClick={() => handleDelete(m.id)} className="p-1.5 text-muted-board hover:text-rust transition-colors"><Trash2 className="h-4 w-4" /></button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
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
