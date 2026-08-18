import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { BookOpen, ExternalLink, Ticket } from 'lucide-react';
import { useMutation } from 'convex/react';
import { Modal } from '@/components/Modal';
import {
  articleHelpPath,
  parseChatShare,
  ticketConsolePath,
  ticketPublicPath,
  type ArticleShare,
  type TicketShare,
} from '../../convex/lib/chatContent';
import { api } from '../../convex/_generated/api';

export function ChatShareBody({
  content,
  inverted = false,
  variant = 'console',
  visitorEmail,
}: {
  content: string;
  inverted?: boolean;
  variant?: 'console' | 'widget';
  visitorEmail?: string;
}) {
  const { text, share } = parseChatShare(content);
  const [article, setArticle] = useState<ArticleShare | null>(null);

  return (
    <>
      {text ? <p className="text-sm leading-relaxed whitespace-pre-wrap">{text}</p> : null}
      {share?.kind === 'article' && (
        <ArticleCard
          share={share}
          inverted={inverted}
          onOpen={() => setArticle(share)}
        />
      )}
      {share?.kind === 'ticket' && (
        <TicketCard share={share} inverted={inverted} variant={variant} visitorEmail={visitorEmail} />
      )}
      {!text && !share ? <p className="text-sm leading-relaxed whitespace-pre-wrap">{content}</p> : null}
      <ArticlePopup article={article} onClose={() => setArticle(null)} />
    </>
  );
}

function ArticleCard({
  share,
  inverted,
  onOpen,
}: {
  share: ArticleShare;
  inverted: boolean;
  onOpen: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className={`mt-2 w-full text-left rounded-xl border p-3 transition-colors ${
        inverted
          ? 'bg-white/15 border-white/25 hover:bg-white/25'
          : 'bg-white border-neutral-200 hover:border-primary-300 hover:bg-primary-50/40'
      }`}
    >
      <div className="flex items-start gap-2">
        <BookOpen className={`w-4 h-4 flex-shrink-0 mt-0.5 ${inverted ? 'text-white' : 'text-primary-500'}`} />
        <div className="min-w-0">
          <p className={`text-sm font-semibold ${inverted ? 'text-white' : 'text-neutral-900'}`}>{share.title}</p>
          {share.excerpt ? (
            <p className={`text-xs mt-1 line-clamp-2 ${inverted ? 'text-white/80' : 'text-neutral-500'}`}>{share.excerpt}</p>
          ) : null}
          <p className={`text-xs mt-2 font-medium ${inverted ? 'text-white' : 'text-primary-600'}`}>Read article</p>
        </div>
      </div>
    </button>
  );
}

function TicketCard({
  share,
  inverted,
  variant,
  visitorEmail,
}: {
  share: TicketShare;
  inverted: boolean;
  variant: 'console' | 'widget';
  visitorEmail?: string;
}) {
  const path = variant === 'console' ? ticketConsolePath(share.id) : ticketPublicPath(share.id, visitorEmail);
  const className = `mt-2 block rounded-xl border p-3 transition-colors ${
    inverted
      ? 'bg-white/15 border-white/25 hover:bg-white/25'
      : 'bg-white border-neutral-200 hover:border-primary-300 hover:bg-primary-50/40'
  }`;
  const inner = (
    <div className="flex items-start gap-2">
      <Ticket className={`w-4 h-4 flex-shrink-0 mt-0.5 ${inverted ? 'text-white' : 'text-primary-500'}`} />
      <div className="min-w-0">
        <p className={`text-xs uppercase tracking-wider ${inverted ? 'text-white/70' : 'text-neutral-400'}`}>Support ticket</p>
        <p className={`text-sm font-semibold mt-0.5 ${inverted ? 'text-white' : 'text-neutral-900'}`}>{share.subject}</p>
        <p className={`text-xs mt-2 font-medium ${inverted ? 'text-white' : 'text-primary-600'}`}>
          {variant === 'console' ? 'Open ticket' : 'View ticket status'}
        </p>
      </div>
    </div>
  );

  if (variant === 'widget') {
    return (
      <a href={path} target="_blank" rel="noreferrer" className={className}>
        {inner}
      </a>
    );
  }
  return <Link to={path} className={className}>{inner}</Link>;
}

function ArticlePopup({ article, onClose }: { article: ArticleShare | null; onClose: () => void }) {
  const loadArticle = useMutation(api.public.article);
  const [body, setBody] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!article) {
      setBody(null);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    void loadArticle({ tenantSlug: article.tenantSlug, articleSlug: article.slug })
      .then((row) => {
        if (!cancelled) setBody(row?.content ?? article.excerpt);
      })
      .catch(() => {
        if (!cancelled) setBody(article.excerpt);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [article, loadArticle]);

  const helpPath = article ? articleHelpPath(article.tenantSlug, article.slug) : '';

  return (
    <Modal open={Boolean(article)} onClose={onClose} title={article?.title ?? 'Article'} size="lg">
      {loading && !body ? <p className="text-sm text-neutral-400">Loading article…</p> : null}
      {body ? <p className="text-sm text-neutral-700 leading-relaxed whitespace-pre-wrap">{body}</p> : null}
      {article?.tenantSlug && article.slug ? (
        <a
          href={helpPath}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1.5 mt-5 text-sm font-medium text-primary-600 hover:text-primary-700"
        >
          <ExternalLink className="w-4 h-4" /> Open in help center
        </a>
      ) : null}
    </Modal>
  );
}
