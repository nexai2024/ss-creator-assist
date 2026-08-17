import { useEffect, useMemo, useState } from 'react';
import { Plus, Search, BookOpen, Eye, ThumbsUp, ThumbsDown, FileText, ArrowLeft, Edit3, Save, X } from 'lucide-react';
import type { KbArticle, KbCategory, Tenant } from '@/types';
import { StatusBadge } from '@/components/Badges';
import { Modal } from '@/components/Modal';
import { LoadingSpinner, EmptyState, ErrorState } from '@/components/States';
import { useToast } from '@/components/Toast';
import { useMutation, useQuery } from 'convex/react';
import { api } from '../../convex/_generated/api';
import type { Id } from '../../convex/_generated/dataModel';

export function KnowledgePage({ tenant, tenants }: { tenant: Tenant | null; tenants: Tenant[] }) {
  const kb = useQuery(api.knowledge.list, tenant ? { tenantId: tenant.id as Id<'tenants'> } : 'skip');
  const articles = (kb?.articles ?? []) as KbArticle[];
  const categories = (kb?.categories ?? []) as KbCategory[];
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedArticle, setSelectedArticle] = useState<KbArticle | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const loading = Boolean(tenant) && kb === undefined;
  const error = null;

  const filtered = useMemo(() => {
    return articles.filter((a) => {
      if (statusFilter !== 'all' && a.status !== statusFilter) return false;
      if (search) {
        const s = search.toLowerCase();
        return a.title.toLowerCase().includes(s) || a.content.toLowerCase().includes(s);
      }
      return true;
    });
  }, [articles, search, statusFilter]);

  if (loading) return <div className="flex items-center justify-center py-24"><LoadingSpinner size={32} /></div>;
  if (error) return <ErrorState message={error} />;

  if (selectedArticle) {
    return (
      <ArticleDetail
        article={selectedArticle}
        categories={categories}
        tenants={tenants}
        onBack={() => setSelectedArticle(null)}
        onUpdated={(updated) => {
          setSelectedArticle(updated);
        }}
      />
    );
  }

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900">Knowledge Base</h1>
          <p className="text-sm text-neutral-500 mt-1">{filtered.length} articles · {categories.length} categories · {tenant ? tenant.name : 'All tenants'}</p>
        </div>
        <div className="flex gap-2">
          {tenant && (
            <a href={`/help/${tenant.slug}`} target="_blank" rel="noreferrer" className="btn-secondary">
              View help center
            </a>
          )}
          <button onClick={() => setShowCreate(true)} className="btn-primary">
            <Plus className="w-4 h-4" />
            New Article
          </button>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
          <input type="text" placeholder="Search articles by title or content..." value={search} onChange={(e) => setSearch(e.target.value)} className="input pl-10" />
        </div>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="input sm:w-40">
          <option value="all">All Status</option>
          <option value="published">Published</option>
          <option value="draft">Draft</option>
        </select>
      </div>

      {filtered.length === 0 ? (
        <div className="card"><EmptyState icon={<BookOpen className="w-7 h-7" />} title="No articles found" description="Try adjusting your search or create a new article." /></div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((article) => {
            const cat = categories.find((c) => c.id === article.category_id);
            const tenantInfo = tenants.find((t) => t.id === article.tenant_id);
            return (
              <button
                key={article.id}
                onClick={() => setSelectedArticle(article)}
                className="card card-hover p-5 text-left group"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="w-10 h-10 rounded-xl bg-primary-50 flex items-center justify-center">
                    <FileText className="w-5 h-5 text-primary-500" />
                  </div>
                  <StatusBadge status={article.status} />
                </div>
                <h3 className="text-sm font-semibold text-neutral-800 mb-1 line-clamp-2 group-hover:text-primary-700 transition-colors">{article.title}</h3>
                <p className="text-xs text-neutral-400 line-clamp-2 mb-3">{article.content.slice(0, 120)}...</p>
                <div className="flex items-center justify-between text-xs text-neutral-400">
                  <span>{cat?.name ?? 'Uncategorized'}</span>
                  <div className="flex items-center gap-3">
                    <span className="flex items-center gap-1"><Eye className="w-3.5 h-3.5" /> {article.views.toLocaleString()}</span>
                    <span className="flex items-center gap-1"><ThumbsUp className="w-3.5 h-3.5" /> {article.helpful_votes}</span>
                  </div>
                </div>
                {tenantInfo && !tenant && <p className="text-xs text-neutral-300 mt-2">{tenantInfo.name}</p>}
              </button>
            );
          })}
        </div>
      )}

      <CreateArticleModal
        open={showCreate}
        onClose={() => setShowCreate(false)}
        categories={categories}
        tenants={tenants}
        lockedTenantId={tenant?.id ?? null}
        onCreated={() => { setShowCreate(false); }}
      />
    </div>
  );
}

function ArticleDetail({
  article,
  categories,
  tenants,
  onBack,
  onUpdated,
}: {
  article: KbArticle;
  categories: KbCategory[];
  tenants: Tenant[];
  onBack: () => void;
  onUpdated: (a: KbArticle) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ title: article.title, content: article.content, category_id: article.category_id ?? '', status: article.status });
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();
  const updateMut = useMutation(api.knowledge.update);
  const cat = categories.find((c) => c.id === article.category_id);
  const tenantInfo = tenants.find((t) => t.id === article.tenant_id);

  const handleSave = async () => {
    setSaving(true);
    try {
      const data = await updateMut({
        tenantId: article.tenant_id as Id<'tenants'>,
        articleId: article.id as Id<'kbArticles'>,
        title: form.title,
        content: form.content,
        categoryId: form.category_id ? form.category_id as Id<'kbCategories'> : null,
        status: form.status,
      });
      onUpdated(data as KbArticle);
      setEditing(false);
      toast('Article saved successfully', 'success');
    } catch {
      toast('Failed to save article', 'error');
    }
    setSaving(false);
  };

  return (
    <div className="space-y-5 animate-fade-in max-w-4xl mx-auto">
      <button onClick={onBack} className="btn-ghost -ml-2">
        <ArrowLeft className="w-4 h-4" />
        Back to articles
      </button>

      <div className="card p-6">
        {!editing ? (
          <>
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-2">
                <StatusBadge status={article.status} />
                {cat && <span className="badge bg-primary-50 text-primary-700">{cat.name}</span>}
              </div>
              <button onClick={() => setEditing(true)} className="btn-secondary">
                <Edit3 className="w-4 h-4" />
                Edit
              </button>
            </div>
            <h1 className="text-xl font-bold text-neutral-900 mb-3">{article.title}</h1>
            <div className="prose prose-sm max-w-none">
              <p className="text-sm text-neutral-600 leading-relaxed whitespace-pre-wrap">{article.content}</p>
            </div>
            <div className="grid grid-cols-3 gap-4 mt-6 pt-5 border-t border-neutral-100">
              <Metric icon={Eye} label="Views" value={article.views.toLocaleString()} />
              <Metric icon={ThumbsUp} label="Helpful" value={article.helpful_votes} />
              <Metric icon={ThumbsDown} label="Unhelpful" value={article.unhelpful_votes} />
            </div>
            <div className="flex items-center justify-between mt-4 text-xs text-neutral-400">
              <span>Created {new Date(article.created_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</span>
              <span>Updated {new Date(article.updated_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</span>
            </div>
            {tenantInfo && <p className="text-xs text-neutral-300 mt-2">Tenant: {tenantInfo.name}</p>}
          </>
        ) : (
          <>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-neutral-900">Edit Article</h2>
              <div className="flex gap-2">
                <button onClick={() => setEditing(false)} className="btn-secondary"><X className="w-4 h-4" /> Cancel</button>
                <button onClick={handleSave} disabled={saving} className="btn-primary"><Save className="w-4 h-4" /> {saving ? 'Saving...' : 'Save'}</button>
              </div>
            </div>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-neutral-700 mb-1.5 block">Title</label>
                <input type="text" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className="input" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-neutral-700 mb-1.5 block">Category</label>
                  <select value={form.category_id} onChange={(e) => setForm({ ...form, category_id: e.target.value })} className="input">
                    <option value="">Uncategorized</option>
                    {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-sm font-medium text-neutral-700 mb-1.5 block">Status</label>
                  <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as KbArticle['status'] })} className="input">
                    <option value="draft">Draft</option>
                    <option value="published">Published</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="text-sm font-medium text-neutral-700 mb-1.5 block">Content</label>
                <textarea value={form.content} onChange={(e) => setForm({ ...form, content: e.target.value })} rows={12} className="input resize-none font-mono text-sm" />
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function CreateArticleModal({
  open,
  onClose,
  categories,
  tenants,
  lockedTenantId,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  categories: KbCategory[];
  tenants: Tenant[];
  lockedTenantId: string | null;
  onCreated: () => void;
}) {
  const [form, setForm] = useState({
    tenant_id: lockedTenantId ?? tenants[0]?.id ?? '',
    title: '',
    content: '',
    category_id: '',
    status: 'draft' as KbArticle['status'],
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();
  const createMut = useMutation(api.knowledge.create);

  useEffect(() => {
    if (lockedTenantId) setForm((f) => ({ ...f, tenant_id: lockedTenantId }));
  }, [lockedTenantId]);

  const handleSubmit = async () => {
    if (!form.title || !form.content || !form.tenant_id) {
      setError('Title and content are required');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await createMut({
        tenantId: form.tenant_id as Id<'tenants'>,
        title: form.title,
        content: form.content,
        categoryId: form.category_id ? form.category_id as Id<'kbCategories'> : undefined,
        status: form.status,
      });
      setForm({ tenant_id: lockedTenantId ?? tenants[0]?.id ?? '', title: '', content: '', category_id: '', status: 'draft' });
      toast('Article created successfully', 'success');
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create article');
    }
    setSubmitting(false);
  };

  return (
    <Modal open={open} onClose={onClose} title="Create Knowledge Base Article" size="lg">
      <div className="space-y-4">
        {error && <div className="px-4 py-3 rounded-lg bg-danger-50 text-danger-700 text-sm">{error}</div>}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {lockedTenantId ? (
            <div>
              <label className="text-sm font-medium text-neutral-700 mb-1.5 block">Tenant</label>
              <div className="px-3 py-2.5 rounded-lg bg-neutral-50 text-sm text-neutral-700 border border-neutral-200">
                {tenants.find((t) => t.id === lockedTenantId)?.name ?? lockedTenantId}
              </div>
            </div>
          ) : (
            <div>
              <label className="text-sm font-medium text-neutral-700 mb-1.5 block">Tenant *</label>
              <select value={form.tenant_id} onChange={(e) => setForm({ ...form, tenant_id: e.target.value })} className="input">
                {tenants.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>
          )}
          <div>
            <label className="text-sm font-medium text-neutral-700 mb-1.5 block">Category</label>
            <select value={form.category_id} onChange={(e) => setForm({ ...form, category_id: e.target.value })} className="input">
              <option value="">Uncategorized</option>
              {categories.filter((c) => c.tenant_id === form.tenant_id).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
        </div>
        <div>
          <label className="text-sm font-medium text-neutral-700 mb-1.5 block">Title *</label>
          <input type="text" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className="input" placeholder="Article title" />
        </div>
        <div>
          <label className="text-sm font-medium text-neutral-700 mb-1.5 block">Content *</label>
          <textarea value={form.content} onChange={(e) => setForm({ ...form, content: e.target.value })} rows={8} className="input resize-none" placeholder="Write the article content..." />
        </div>
        <div>
          <label className="text-sm font-medium text-neutral-700 mb-1.5 block">Status</label>
          <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as KbArticle['status'] })} className="input sm:w-48">
            <option value="draft">Draft</option>
            <option value="published">Published</option>
          </select>
        </div>
        <div className="flex justify-end gap-3 pt-2">
          <button onClick={onClose} className="btn-secondary">Cancel</button>
          <button onClick={handleSubmit} disabled={submitting} className="btn-primary">
            {submitting ? <LoadingSpinner size={16} /> : <Plus className="w-4 h-4" />}
            Create Article
          </button>
        </div>
      </div>
    </Modal>
  );
}

function Metric({ icon: Icon, label, value }: { icon: typeof Eye; label: string; value: string | number }) {
  return (
    <div className="flex items-center gap-2">
      <Icon className="w-4 h-4 text-neutral-400" />
      <div>
        <p className="text-lg font-bold text-neutral-800 leading-tight">{value}</p>
        <p className="text-xs text-neutral-400">{label}</p>
      </div>
    </div>
  );
}
