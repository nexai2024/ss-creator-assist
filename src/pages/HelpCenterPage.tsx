import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { BookOpen, LifeBuoy, Search, ThumbsDown, ThumbsUp } from 'lucide-react';
import { LoadingSpinner, EmptyState, ErrorState } from '@/components/States';
import { useMutation, useQuery } from 'convex/react';
import { api } from '../../convex/_generated/api';
import type { Id } from '../../convex/_generated/dataModel';

type HelpCenterPayload = {
  tenant: { id: string; name: string; slug: string };
  branding: { logo_url: string | null; primary_color: string; help_center_subdomain: string | null };
  articles: Array<{
    id: string;
    title: string;
    slug: string;
    content: string;
    category_id: string | null;
    views: number;
    helpful_votes: number;
    updated_at: string;
  }>;
  categories: Array<{ id: string; name: string; slug: string; description: string | null }>;
};

type ArticlePayload = {
  id: string;
  title: string;
  slug: string;
  content: string;
  views: number;
  helpful_votes: number;
  unhelpful_votes: number;
  updated_at: string;
  category: { id: string; name: string } | null;
};

export function HelpCenterLayout({ children, data }: { children: ReactNode; data: HelpCenterPayload }) {
  const color = data.branding.primary_color || '#3b82f6';
  return (
    <div className="min-h-screen bg-neutral-50">
      <header className="border-b border-neutral-200 bg-white">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between gap-4">
          <Link to={`/help/${data.tenant.slug}`} className="flex items-center gap-3 min-w-0">
            {data.branding.logo_url ? (
              <img src={data.branding.logo_url} alt="" className="w-9 h-9 rounded-lg object-cover" />
            ) : (
              <div className="w-9 h-9 rounded-lg flex items-center justify-center text-white text-sm font-bold" style={{ background: color }}>
                {data.tenant.name.charAt(0)}
              </div>
            )}
            <div className="min-w-0">
              <p className="text-sm font-semibold text-neutral-900 truncate">{data.tenant.name}</p>
              <p className="text-xs text-neutral-400">Help Center</p>
            </div>
          </Link>
          <Link to={`/help/${data.tenant.slug}/contact`} className="btn-secondary text-sm">
            <LifeBuoy className="w-4 h-4" />
            Contact support
          </Link>
        </div>
      </header>
      <main className="max-w-4xl mx-auto px-4 py-8">{children}</main>
    </div>
  );
}

export function HelpCenterHomePage() {
  const { slug } = useParams();
  const data = useQuery(api.public.helpCenter, slug ? { slug } : 'skip') as HelpCenterPayload | null | undefined;
  const [search, setSearch] = useState('');
  const [categoryId, setCategoryId] = useState('all');

  const error = data === null ? 'This help center is not available.' : null;

  const filtered = useMemo(() => {
    if (!data) return [];
    return data.articles.filter((a) => {
      if (categoryId !== 'all' && a.category_id !== categoryId) return false;
      if (!search) return true;
      const s = search.toLowerCase();
      return a.title.toLowerCase().includes(s) || a.content.toLowerCase().includes(s);
    });
  }, [data, search, categoryId]);

  if (error) return <div className="p-8"><ErrorState message={error} /></div>;
  if (!data) return <FullPagePublicLoader />;

  return (
    <HelpCenterLayout data={data}>
      <h1 className="text-2xl font-bold text-neutral-900 mb-1">How can we help?</h1>
      <p className="text-sm text-neutral-500 mb-6">Search published articles from {data.tenant.name}.</p>
      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
        <input className="input pl-10" placeholder="Search articles..." value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>
      {data.categories.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-6">
          <button onClick={() => setCategoryId('all')} className={`px-3 py-1.5 rounded-lg text-sm ${categoryId === 'all' ? 'bg-primary-600 text-white' : 'bg-white border border-neutral-200 text-neutral-600'}`}>All</button>
          {data.categories.map((c) => (
            <button key={c.id} onClick={() => setCategoryId(c.id)} className={`px-3 py-1.5 rounded-lg text-sm ${categoryId === c.id ? 'bg-primary-600 text-white' : 'bg-white border border-neutral-200 text-neutral-600'}`}>{c.name}</button>
          ))}
        </div>
      )}
      {filtered.length === 0 ? (
        <div className="card"><EmptyState icon={<BookOpen className="w-7 h-7" />} title="No articles yet" description="Published knowledge base articles will appear here." /></div>
      ) : (
        <div className="space-y-3">
          {filtered.map((article) => (
            <Link key={article.id} to={`/help/${data.tenant.slug}/${article.slug}`} className="card card-hover p-5 block">
              <h2 className="text-sm font-semibold text-neutral-900 mb-1">{article.title}</h2>
              <p className="text-sm text-neutral-500 line-clamp-2">{article.content}</p>
            </Link>
          ))}
        </div>
      )}
    </HelpCenterLayout>
  );
}

export function HelpArticlePage() {
  const { slug, articleSlug } = useParams();
  const center = useQuery(api.public.helpCenter, slug ? { slug } : 'skip') as HelpCenterPayload | null | undefined;
  const loadArticle = useMutation(api.public.article);
  const voteMut = useMutation(api.public.voteArticle);
  const [article, setArticle] = useState<ArticlePayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [voted, setVoted] = useState(false);

  useEffect(() => {
    if (!slug || !articleSlug) return;
    void loadArticle({ tenantSlug: slug, articleSlug }).then((row) => {
      if (!row) setError('Article not found');
      else setArticle(row as ArticlePayload);
    });
  }, [slug, articleSlug, loadArticle]);

  if (error) return <div className="p-8"><ErrorState message={error} /></div>;
  if (center === null) return <div className="p-8"><ErrorState message="Help center not found" /></div>;
  if (!center || !article) return <FullPagePublicLoader />;

  const vote = async (helpful: boolean) => {
    await voteMut({ articleId: article.id as Id<'kbArticles'>, helpful });
    setVoted(true);
  };

  return (
    <HelpCenterLayout data={center}>
      <Link to={`/help/${center.tenant.slug}`} className="text-sm text-primary-600 font-medium">← All articles</Link>
      {article.category && <p className="text-xs text-neutral-400 mt-4 mb-1">{article.category.name}</p>}
      <h1 className="text-2xl font-bold text-neutral-900 mb-4">{article.title}</h1>
      <div className="card p-6">
        <p className="text-sm text-neutral-700 leading-relaxed whitespace-pre-wrap">{article.content}</p>
      </div>
      <div className="mt-6 card p-5">
        <p className="text-sm font-medium text-neutral-800 mb-3">Was this article helpful?</p>
        {voted ? (
          <p className="text-sm text-success-700">Thanks for the feedback.</p>
        ) : (
          <div className="flex gap-2">
            <button className="btn-secondary" onClick={() => vote(true)}><ThumbsUp className="w-4 h-4" /> Yes</button>
            <button className="btn-secondary" onClick={() => vote(false)}><ThumbsDown className="w-4 h-4" /> No</button>
          </div>
        )}
      </div>
    </HelpCenterLayout>
  );
}

export function HelpContactPage() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const center = useQuery(api.public.helpCenter, slug ? { slug } : 'skip') as HelpCenterPayload | null | undefined;
  const submitTicket = useMutation(api.public.submitTicket);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({ name: '', email: '', subject: '', body: '' });
  const [submitting, setSubmitting] = useState(false);
  const [ticketId, setTicketId] = useState<string | null>(null);

  if (error) return <div className="p-8"><ErrorState message={error} /></div>;
  if (center === undefined) return <FullPagePublicLoader />;
  if (!center) return <div className="p-8"><ErrorState message="Help center not found" /></div>;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const data = await submitTicket({
        slug: center.tenant.slug,
        name: form.name,
        email: form.email,
        subject: form.subject,
        body: form.body,
        category: 'General',
      });
      setTicketId(data.ticket_id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not submit ticket');
    }
    setSubmitting(false);
  };

  return (
    <HelpCenterLayout data={center}>
      <h1 className="text-2xl font-bold text-neutral-900 mb-1">Contact support</h1>
      <p className="text-sm text-neutral-500 mb-6">We typically reply by email. Check the knowledge base first for faster answers.</p>
      {ticketId ? (
        <div className="card p-6">
          <p className="text-sm font-medium text-neutral-800">Ticket submitted</p>
          <p className="text-sm text-neutral-500 mt-1">Reference {ticketId}. We will follow up at {form.email}.</p>
          <button className="btn-primary mt-4" onClick={() => navigate(`/help/${center.tenant.slug}`)}>Back to help center</button>
        </div>
      ) : (
        <form onSubmit={submit} className="card p-6 space-y-4 max-w-xl">
          {error && <div className="px-4 py-3 rounded-lg bg-danger-50 text-danger-700 text-sm">{error}</div>}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-neutral-700 mb-1.5 block">Name</label>
              <input className="input" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div>
              <label className="text-sm font-medium text-neutral-700 mb-1.5 block">Email</label>
              <input type="email" className="input" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </div>
          </div>
          <div>
            <label className="text-sm font-medium text-neutral-700 mb-1.5 block">Subject</label>
            <input className="input" required value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} />
          </div>
          <div>
            <label className="text-sm font-medium text-neutral-700 mb-1.5 block">How can we help?</label>
            <textarea className="input resize-none" rows={5} required value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} />
          </div>
          <button type="submit" disabled={submitting} className="btn-primary">
            {submitting ? <LoadingSpinner size={16} /> : 'Submit ticket'}
          </button>
        </form>
      )}
    </HelpCenterLayout>
  );
}

function FullPagePublicLoader() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <LoadingSpinner size={32} />
    </div>
  );
}
