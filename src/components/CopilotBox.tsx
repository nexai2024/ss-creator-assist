import { useState } from 'react';
import { Sparkles } from 'lucide-react';
import { useAction } from 'convex/react';
import { api } from '../../convex/_generated/api';
import type { Id } from '../../convex/_generated/dataModel';
import { LoadingSpinner } from '@/components/States';

export function CopilotBox({
  tenantId,
  ticketId,
  conversationId,
  onInsert,
}: {
  tenantId: string;
  ticketId?: string;
  conversationId?: string;
  onInsert: (text: string) => void;
}) {
  const copilot = useAction(api.ai.copilot);
  const [text, setText] = useState('');
  const [similar, setSimilar] = useState<Array<{ id: string; subject: string; status: string }>>([]);
  const [loading, setLoading] = useState<string | null>(null);

  const run = async (mode: 'draft' | 'summarize' | 'similar') => {
    setLoading(mode);
    try {
      const result = await copilot({
        tenantId: tenantId as Id<'tenants'>,
        mode,
        ticketId: ticketId ? ticketId as Id<'tickets'> : undefined,
        conversationId: conversationId ? conversationId as Id<'chatConversations'> : undefined,
      });
      setText(result.text);
      setSimilar(result.similar);
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="card p-4 space-y-2">
      <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wider flex items-center gap-1.5">
        <Sparkles className="w-3.5 h-3.5 text-violet-500" /> Copilot
      </p>
      <div className="flex flex-wrap gap-1.5">
        <button type="button" className="btn-secondary text-xs" disabled={Boolean(loading)} onClick={() => void run('draft')}>
          {loading === 'draft' ? <LoadingSpinner size={12} /> : 'Draft reply'}
        </button>
        <button type="button" className="btn-secondary text-xs" disabled={Boolean(loading)} onClick={() => void run('summarize')}>
          {loading === 'summarize' ? <LoadingSpinner size={12} /> : 'Summarize'}
        </button>
        <button type="button" className="btn-secondary text-xs" disabled={Boolean(loading)} onClick={() => void run('similar')}>
          {loading === 'similar' ? <LoadingSpinner size={12} /> : 'Similar tickets'}
        </button>
      </div>
      {text && (
        <div className="text-sm text-neutral-700 whitespace-pre-wrap bg-neutral-50 rounded-lg p-3">
          {text}
          <button type="button" className="block mt-2 text-xs font-medium text-primary-600" onClick={() => onInsert(text)}>
            Insert into reply
          </button>
        </div>
      )}
      {similar.length > 0 && (
        <ul className="text-xs text-neutral-600 space-y-1">
          {similar.map((row) => (
            <li key={row.id}>
              <a className="text-primary-600 hover:underline" href={`/tickets/${row.id}`}>{row.subject}</a>
              <span className="text-neutral-400"> · {row.status}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
