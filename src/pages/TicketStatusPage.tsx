import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { LifeBuoy, Send } from 'lucide-react';
import { useMutation } from 'convex/react';
import { LoadingSpinner, ErrorState } from '@/components/States';
import { StatusBadge } from '@/components/Badges';
import { api } from '../../convex/_generated/api';

type PublicTicket = {
  ticket_id: string;
  subject: string;
  status: 'open' | 'pending' | 'resolved' | 'closed';
  category: string;
  created_at: string;
  tenant_name: string;
  tenant_slug: string;
  branding_color: string;
  can_reply: boolean;
  messages: Array<{
    id: string;
    sender_type: 'end_user' | 'agent' | 'system';
    sender_name: string;
    content: string;
    created_at: string;
  }>;
};

export function TicketStatusPage() {
  const { ticketId: ticketIdParam } = useParams();
  const [searchParams] = useSearchParams();
  const lookup = useMutation(api.public.lookupTicket);
  const replyMut = useMutation(api.public.replyToTicket);
  const [ticketId, setTicketId] = useState(ticketIdParam ?? '');
  const [email, setEmail] = useState(searchParams.get('email') ?? '');
  const [ticket, setTicket] = useState<PublicTicket | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [reply, setReply] = useState('');
  const [sending, setSending] = useState(false);
  const autoTried = useRef(false);

  const runLookup = async (id: string, address: string) => {
    setLoading(true);
    setError(null);
    try {
      const row = await lookup({ ticketId: id.trim(), email: address.trim() });
      if (!row) {
        setTicket(null);
        setError('No ticket matched that ID and email.');
      } else {
        setTicket(row);
      }
    } catch (err) {
      setTicket(null);
      setError(err instanceof Error ? err.message : 'Could not look up that ticket.');
    }
    setLoading(false);
  };

  useEffect(() => {
    if (autoTried.current) return;
    const id = ticketIdParam ?? '';
    const address = searchParams.get('email') ?? '';
    if (!id || !address) return;
    autoTried.current = true;
    void runLookup(id, address);
    // Initial unlock from the shared link only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ticketIdParam, searchParams]);

  const onUnlock = async (e: FormEvent) => {
    e.preventDefault();
    if (!ticketId.trim() || !email.trim()) return;
    await runLookup(ticketId, email);
  };

  const onReply = async (e: FormEvent) => {
    e.preventDefault();
    if (!ticket || !reply.trim()) return;
    setSending(true);
    setError(null);
    try {
      const row = await replyMut({
        ticketId: ticket.ticket_id,
        email: email.trim(),
        content: reply.trim(),
      });
      setTicket(row);
      setReply('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not send that reply.');
    }
    setSending(false);
  };

  const color = ticket?.branding_color || '#3b82f6';

  return (
    <div className="min-h-screen bg-neutral-50">
      <header className="border-b border-neutral-200 bg-white">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-lg flex items-center justify-center text-white text-sm font-bold" style={{ background: color }}>
              {(ticket?.tenant_name ?? 'S').charAt(0)}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-neutral-900 truncate">{ticket?.tenant_name ?? 'Support'}</p>
              <p className="text-xs text-neutral-400">Ticket status</p>
            </div>
          </div>
          {ticket?.tenant_slug ? (
            <Link to={`/help/${ticket.tenant_slug}`} className="btn-secondary text-sm">
              <LifeBuoy className="w-4 h-4" />
              Help center
            </Link>
          ) : null}
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-8 space-y-5">
        {!ticket && (
          <div className="card p-6">
            <h1 className="text-xl font-bold text-neutral-900 mb-1">Check your ticket</h1>
            <p className="text-sm text-neutral-500 mb-5">Enter the ticket ID from your chat or confirmation email, plus the email you used when you contacted us.</p>
            <form onSubmit={(e) => void onUnlock(e)} className="space-y-4">
              {error && <div className="px-4 py-3 rounded-lg bg-danger-50 text-danger-700 text-sm">{error}</div>}
              <div>
                <label className="text-sm font-medium text-neutral-700 mb-1.5 block">Ticket ID</label>
                <input
                  className="input font-mono text-sm"
                  required
                  value={ticketId}
                  onChange={(e) => setTicketId(e.target.value)}
                  placeholder="Paste the full ticket ID"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-neutral-700 mb-1.5 block">Email</label>
                <input
                  type="email"
                  className="input"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@company.com"
                />
              </div>
              <button type="submit" disabled={loading} className="btn-primary">
                {loading ? <LoadingSpinner size={16} /> : 'View ticket'}
              </button>
            </form>
          </div>
        )}

        {loading && ticket && (
          <div className="flex justify-center py-12"><LoadingSpinner size={28} /></div>
        )}

        {ticket && (
          <>
            <div className="card p-6">
              <div className="flex items-start justify-between gap-3 mb-3">
                <div className="min-w-0">
                  <p className="text-xs text-neutral-400 font-mono mb-1">{ticket.ticket_id.slice(-8).toUpperCase()}</p>
                  <h1 className="text-xl font-bold text-neutral-900">{ticket.subject}</h1>
                </div>
                <StatusBadge status={ticket.status} />
              </div>
              <p className="text-sm text-neutral-500">
                {ticket.category} · Opened {new Date(ticket.created_at).toLocaleString()}
              </p>
              <button type="button" className="text-xs text-primary-600 mt-3" onClick={() => { setTicket(null); setError(null); }}>
                Check a different ticket
              </button>
            </div>

            <div className="card p-5 space-y-3">
              {ticket.messages.length === 0 ? (
                <ErrorState message="No messages on this ticket yet." />
              ) : (
                ticket.messages.map((m) => (
                  <div key={m.id} className={`flex ${m.sender_type === 'end_user' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[85%] rounded-2xl px-3 py-2 ${
                      m.sender_type === 'end_user'
                        ? 'text-white rounded-br-md'
                        : m.sender_type === 'system'
                          ? 'bg-neutral-100 text-neutral-600 rounded-bl-md'
                          : 'bg-white border border-neutral-200 text-neutral-800 rounded-bl-md'
                    }`} style={m.sender_type === 'end_user' ? { background: color } : undefined}>
                      <p className={`text-xs mb-1 ${m.sender_type === 'end_user' ? 'text-white/80' : 'text-neutral-400'}`}>{m.sender_name}</p>
                      <p className="text-sm whitespace-pre-wrap">{m.content}</p>
                    </div>
                  </div>
                ))
              )}
            </div>

            {ticket.can_reply ? (
              <form onSubmit={(e) => void onReply(e)} className="card p-4 space-y-3">
                {error && <div className="px-4 py-3 rounded-lg bg-danger-50 text-danger-700 text-sm">{error}</div>}
                <textarea
                  className="input resize-none"
                  rows={3}
                  value={reply}
                  onChange={(e) => setReply(e.target.value)}
                  placeholder="Add an update…"
                  required
                />
                <button type="submit" disabled={sending || !reply.trim()} className="btn-primary">
                  {sending ? <LoadingSpinner size={16} /> : <Send className="w-4 h-4" />}
                  Send reply
                </button>
              </form>
            ) : (
              <p className="text-sm text-neutral-400 text-center">This ticket is closed. Contact support if you need more help.</p>
            )}
          </>
        )}
      </main>
    </div>
  );
}
