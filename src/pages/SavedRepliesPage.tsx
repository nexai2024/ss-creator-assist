import { useState, useMemo } from 'react';
import { Plus, Search, Trash2, Edit3, Copy, Check, Zap, FileText } from 'lucide-react';
import type { Tenant, SavedReply } from '@/types';
import { useSavedReplies } from '@/hooks/useSolopreneur';
import { LoadingSpinner, EmptyState, TableSkeleton } from '@/components/States';
import { useToast } from '@/components/Toast';
import { Modal } from '@/components/Modal';

export function SavedRepliesPage({ tenant }: { tenant: Tenant | null }) {
  const { replies, loading, create, update, remove, incrementUsage } = useSavedReplies(tenant?.id ?? null);
  const { toast } = useToast();
  const [search, setSearch] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [editing, setEditing] = useState<SavedReply | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const categories = useMemo(() => {
    const cats = new Set(replies.map((r) => r.category));
    return ['All', ...Array.from(cats).sort()];
  }, [replies]);

  const [activeCat, setActiveCat] = useState('All');

  const filtered = useMemo(() => {
    let result = replies;
    if (activeCat !== 'All') result = result.filter((r) => r.category === activeCat);
    if (search) {
      const s = search.toLowerCase();
      result = result.filter((r) => r.title.toLowerCase().includes(s) || r.content.toLowerCase().includes(s) || (r.shortcut ?? '').toLowerCase().includes(s));
    }
    return result;
  }, [replies, search, activeCat]);

  const handleCopy = (reply: SavedReply) => {
    navigator.clipboard.writeText(reply.content);
    setCopiedId(reply.id);
    incrementUsage(reply.id);
    setTimeout(() => setCopiedId(null), 2000);
    toast('Reply copied to clipboard', 'success');
  };

  if (!tenant) {
    return (
      <div className="animate-fade-in">
        <h1 className="text-2xl font-bold text-neutral-900 mb-2">Saved Replies</h1>
        <div className="card">
          <EmptyState icon={<Zap className="w-7 h-7" />} title="Select a tenant" description="Choose a tenant to manage saved replies." />
        </div>
      </div>
    );
  }

  if (loading) return <TableSkeleton />;

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900">Saved Replies</h1>
          <p className="text-sm text-neutral-500 mt-1">Reusable response templates. Copy with one click, or type the shortcut in any reply box.</p>
        </div>
        <button onClick={() => setShowCreate(true)} className="btn-primary">
          <Plus className="w-4 h-4" /> New Reply
        </button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="card p-3 text-center">
          <p className="text-lg font-bold text-neutral-800">{replies.length}</p>
          <p className="text-xs text-neutral-400">Total Replies</p>
        </div>
        <div className="card p-3 text-center">
          <p className="text-lg font-bold text-neutral-800">{replies.reduce((s, r) => s + r.usage_count, 0)}</p>
          <p className="text-xs text-neutral-400">Times Used</p>
        </div>
        <div className="card p-3 text-center">
          <p className="text-lg font-bold text-neutral-800">{categories.length - 1}</p>
          <p className="text-xs text-neutral-400">Categories</p>
        </div>
        <div className="card p-3 text-center">
          <p className="text-lg font-bold text-neutral-800">{replies.length > 0 ? Math.round(replies.reduce((s, r) => s + r.usage_count, 0) / replies.length) : 0}</p>
          <p className="text-xs text-neutral-400">Avg per Reply</p>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
          <input type="text" placeholder="Search replies..." value={search} onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-neutral-200 bg-neutral-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-400 transition-all" />
        </div>
        <div className="flex gap-1.5 flex-wrap">
          {categories.map((cat) => (
            <button key={cat} onClick={() => setActiveCat(cat)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                activeCat === cat ? 'bg-primary-500 text-white' : 'bg-white border border-neutral-200 text-neutral-600 hover:bg-neutral-50'
              }`}>{cat}</button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="card">
          <EmptyState icon={<Zap className="w-7 h-7" />} title="No saved replies yet" description="Create reusable templates to respond faster to common questions." />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {filtered.map((reply) => (
            <div key={reply.id} className="card p-4 card-hover">
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-8 h-8 rounded-lg bg-primary-50 flex items-center justify-center flex-shrink-0">
                    <FileText className="w-4 h-4 text-primary-500" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-neutral-800 truncate">{reply.title}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-xs px-1.5 py-0.5 rounded bg-neutral-100 text-neutral-500">{reply.category}</span>
                      {reply.shortcut && <span className="text-xs font-mono text-primary-500">{reply.shortcut}</span>}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <button onClick={() => handleCopy(reply)} className="p-1.5 rounded-lg text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700" title="Copy">
                    {copiedId === reply.id ? <Check className="w-4 h-4 text-success-500" /> : <Copy className="w-4 h-4" />}
                  </button>
                  <button onClick={() => setEditing(reply)} className="p-1.5 rounded-lg text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700" title="Edit">
                    <Edit3 className="w-4 h-4" />
                  </button>
                  <button onClick={() => { remove(reply.id); toast('Reply deleted', 'success'); }} className="p-1.5 rounded-lg text-danger-400 hover:bg-danger-50" title="Delete">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
              <p className="text-sm text-neutral-600 line-clamp-3 whitespace-pre-wrap">{reply.content}</p>
              <div className="mt-3 pt-2 border-t border-neutral-50 flex items-center justify-between">
                <span className="text-xs text-neutral-400">Used {reply.usage_count} time{reply.usage_count !== 1 ? 's' : ''}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {showCreate && (
        <ReplyModal title="New Saved Reply" onClose={() => setShowCreate(false)}
          onSave={async (data) => {
            const created = await create(data);
            if (created) { toast('Saved reply created', 'success'); setShowCreate(false); }
            else toast('Failed to create reply', 'error');
          }} />
      )}
      {editing && (
        <ReplyModal title="Edit Saved Reply" initial={editing} onClose={() => setEditing(null)}
          onSave={async (data) => { await update(editing.id, data); toast('Reply updated', 'success'); setEditing(null); }} />
      )}
    </div>
  );
}

function ReplyModal({ title, initial, onClose, onSave }: {
  title: string;
  initial?: SavedReply;
  onClose: () => void;
  onSave: (data: { title: string; content: string; category: string; shortcut: string | null }) => Promise<void>;
}) {
  const [replyTitle, setReplyTitle] = useState(initial?.title ?? '');
  const [content, setContent] = useState(initial?.content ?? '');
  const [category, setCategory] = useState(initial?.category ?? 'General');
  const [shortcut, setShortcut] = useState(initial?.shortcut ?? '');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!replyTitle.trim() || !content.trim()) return;
    setSaving(true);
    await onSave({ title: replyTitle, content, category, shortcut: shortcut.trim() || null });
    setSaving(false);
  };

  return (
    <Modal open={true} onClose={onClose} title={title} size="md">
      <div className="space-y-4">
        <div>
          <label className="text-sm font-medium text-neutral-700 mb-1.5 block">Title</label>
          <input type="text" value={replyTitle} onChange={(e) => setReplyTitle(e.target.value)} className="input" placeholder="e.g. Welcome message" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-sm font-medium text-neutral-700 mb-1.5 block">Category</label>
            <input type="text" value={category} onChange={(e) => setCategory(e.target.value)} className="input" placeholder="General" />
          </div>
          <div>
            <label className="text-sm font-medium text-neutral-700 mb-1.5 block">Shortcut (optional)</label>
            <input type="text" value={shortcut} onChange={(e) => setShortcut(e.target.value)} className="input font-mono" placeholder="/welcome" />
          </div>
        </div>
        <div>
          <label className="text-sm font-medium text-neutral-700 mb-1.5 block">Content</label>
          <textarea value={content} onChange={(e) => setContent(e.target.value)} rows={5} className="input resize-none" placeholder="Type your reply template..." />
        </div>
        <div className="flex justify-end gap-3 pt-2">
          <button onClick={onClose} className="btn-secondary">Cancel</button>
          <button onClick={handleSave} disabled={saving || !replyTitle.trim() || !content.trim()} className="btn-primary">
            {saving ? <LoadingSpinner size={16} /> : <Check className="w-4 h-4" />} Save Reply
          </button>
        </div>
      </div>
    </Modal>
  );
}
