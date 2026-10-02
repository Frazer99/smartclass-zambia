import { useState } from 'react';
import { Subject, PastPaper } from '@/lib/supabase-client';
import { FileCheck, Plus, X, Pencil, Trash2, Upload, Search } from 'lucide-react';

export function PastPapersTab({
  papers, subjects, showForm, setShowForm,
  editingPaper, onSubmit, onEdit, onDelete, selectedFile, setSelectedFile,
  selectedAnswerFile, setSelectedAnswerFile,
}: {
  papers: PastPaper[];
  subjects: Subject[];
  showForm: boolean;
  setShowForm: (value: boolean) => void;
  editingPaper: PastPaper | null;
  onSubmit: () => void;
  onEdit: (paper: PastPaper) => void;
  onDelete: (id: string) => void;
  selectedFile: File | null;
  setSelectedFile: (file: File | null) => void;
  selectedAnswerFile: File | null; setSelectedAnswerFile: (file: File | null) => void;
}) {
  const [showTable, setShowTable] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const normalizedSearchQuery = searchQuery.trim().toLowerCase();
  const visiblePapers = normalizedSearchQuery
    ? papers.filter((paper) => [
      paper.title,
      paper.source,
      paper.year,
      paper.grade,
      (paper as any).subject?.name,
    ].some((value) => String(value ?? '').toLowerCase().includes(normalizedSearchQuery)))
    : papers;
  return (
    <div className="space-y-5">
      <div className="flex gap-4 flex-wrap">
        <div className="card-board px-4 py-3 min-w-[140px]">
          <FileCheck className="h-4 w-4 text-gold mb-1" />
          <div className="font-mono-sc text-xl font-bold text-chalk">{papers.length}</div>
          <div className="text-xs text-muted-board">Past Papers</div>
        </div>
      </div>

      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h2 className="font-display text-lg font-semibold text-chalk">Past papers</h2>
          <p className="text-sm text-muted-board">Add papers that pupils can browse and practise.</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <label className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-board" />
            <input value={searchQuery} onChange={(event) => { setSearchQuery(event.target.value); setShowTable(true); }} placeholder="Search past papers" aria-label="Search past papers" className="form-input w-56 pl-9" />
          </label>
          <button onClick={() => setShowForm(!showForm)} className="flex items-center gap-1.5 btn-gold text-sm px-3 py-2">
            {showForm ? <><X className="h-4 w-4" /> Cancel</> : <><Plus className="h-4 w-4" /> Add Paper</>}
          </button>
        </div>
      </div>

      {showForm && (
        <div className="card-board p-5 space-y-4 animate-slide-up">
          <h3 className="font-semibold text-chalk">Upload past-paper PDF</h3>
          <input className="form-input text-xs" type="file" accept="application/pdf,.pdf" onChange={(e) => setSelectedFile(e.target.files?.[0] || null)} />
          <label className="text-sm text-muted-board">Answer key or marking scheme PDF (optional)</label>
          <input className="form-input text-xs" type="file" accept="application/pdf,.pdf" onChange={(e) => setSelectedAnswerFile(e.target.files?.[0] || null)} />
          <p className="text-xs text-muted-board">The system reads the paper header and extracts its title, subject, Grade or Form, year, term, source, marks, duration, options, and questions automatically.</p>
          <button onClick={onSubmit} className="btn-gold flex items-center gap-1.5 text-sm px-4 py-2">
            <Upload className="h-4 w-4" /> Process PDF
          </button>
        </div>
      )}

      <button type="button" onClick={() => setShowTable((visible) => !visible)} className="border border-gold/40 text-gold rounded-lg px-3 py-2 text-sm hover:bg-gold/10 transition-colors">
        {showTable ? 'Hide past papers' : 'Show past papers'}
      </button>

      {showTable && <div className="card-board max-h-[38rem] overflow-auto">
        <div className="min-w-[760px]">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-white/10 text-left text-xs text-muted-board uppercase tracking-widest">
              <th className="px-4 py-3">Title</th><th className="px-4 py-3">Subject</th><th className="px-4 py-3">Grade / Form</th><th className="px-4 py-3">Year</th><th className="px-4 py-3">Source</th><th className="px-4 py-3 text-right">Actions</th>
            </tr></thead>
            <tbody>
              {visiblePapers.length === 0 ? <tr><td colSpan={6} className="px-4 py-8 text-center text-muted-board">{normalizedSearchQuery ? `No past papers match "${searchQuery}".` : 'No past papers found.'}</td></tr> : visiblePapers.map((paper) => (
                <tr key={paper.id} className="border-b border-white/5 hover:bg-white/5">
                  <td className="px-4 py-3 text-chalk font-medium">{paper.title}</td>
                  <td className="px-4 py-3 text-muted-board text-xs">{(paper as any).subject?.name || '—'}</td>
                  <td className="px-4 py-3 text-muted-board text-xs">{paper.grade}</td>
                  <td className="px-4 py-3 text-chalk font-mono-sc text-xs">{paper.year}</td>
                  <td className="px-4 py-3 text-muted-board text-xs">{paper.source}</td>
                  <td className="px-4 py-3 text-right"><div className="flex justify-end gap-1">
                    <button onClick={() => onEdit(paper)} className="p-1.5 text-muted-board hover:text-gold"><Pencil className="h-4 w-4" /></button>
                    <button onClick={() => onDelete(paper.id)} className="p-1.5 text-muted-board hover:text-rust"><Trash2 className="h-4 w-4" /></button>
                  </div></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>}
    </div>
  );
}

