import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useParams } from 'react-router-dom';
import { Send } from 'lucide-react';
import { LoadingSpinner } from '@/components/States';
import { useMutation, useQuery } from 'convex/react';
import { api } from '../../convex/_generated/api';
import type { Id } from '../../convex/_generated/dataModel';

type WidgetConfig = {
  integration_id: string;
  tenant_id: string;
  tenant_slug: string;
  tenant_name: string;
  position: string;
  color: string;
  greeting: string | null;
  is_open: boolean;
  auto_responder_enabled: boolean;
  auto_responder_message: string;
};

type ChatMsg = {
  id: string;
  sender_type: string;
  sender_name: string;
  content: string;
  created_at: string;
};

const SESSION_KEY = (id: string) => `mse_widget_${id}`;

export function WidgetPage() {
  const { integrationId } = useParams();
  const config = useQuery(
    api.public.widgetConfig,
    integrationId ? { integrationId: integrationId as Id<'integrationSettings'> } : 'skip',
  ) as WidgetConfig | null | undefined;
  const startMut = useMutation(api.public.startChat);
  const sendMut = useMutation(api.public.sendChatMessage);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [draft, setDraft] = useState('');
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [visitorToken, setVisitorToken] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  const messages = useQuery(
    api.public.chatMessages,
    conversationId && visitorToken
      ? { conversationId: conversationId as Id<'chatConversations'>, visitorToken }
      : 'skip',
  ) as ChatMsg[] | undefined;

  useEffect(() => {
    if (!integrationId) return;
    const saved = sessionStorage.getItem(SESSION_KEY(integrationId));
    if (saved) {
      const parsed = JSON.parse(saved) as { conversation_id: string; visitor_token: string };
      setConversationId(parsed.conversation_id);
      setVisitorToken(parsed.visitor_token);
    }
  }, [integrationId]);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  if (error || config === null) {
    return <div className="h-screen flex items-center justify-center p-4 text-sm text-neutral-500">{error ?? 'This chat widget is offline.'}</div>;
  }
  if (!config) {
    return <div className="h-screen flex items-center justify-center"><LoadingSpinner size={28} /></div>;
  }

  const color = config.color || '#3b82f6';

  const startChat = async (e: FormEvent) => {
    e.preventDefault();
    if (!integrationId) return;
    setSending(true);
    try {
      const started = await startMut({
        integrationId: integrationId as Id<'integrationSettings'>,
        name,
        email,
        message: draft,
      });
      setConversationId(started.conversation_id);
      setVisitorToken(started.visitor_token);
      sessionStorage.setItem(SESSION_KEY(integrationId), JSON.stringify(started));
      setDraft('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not start chat');
    }
    setSending(false);
  };

  const send = async () => {
    if (!conversationId || !visitorToken || !draft.trim()) return;
    setSending(true);
    await sendMut({
      conversationId: conversationId as Id<'chatConversations'>,
      visitorToken,
      content: draft.trim(),
    });
    setDraft('');
    setSending(false);
  };

  return (
    <div className="h-screen flex flex-col bg-white">
      <div className="px-4 py-3 text-white" style={{ background: color }}>
        <p className="text-sm font-semibold">{config.tenant_name}</p>
        <p className="text-xs opacity-80">{config.is_open ? 'We typically reply in a few minutes' : 'Currently away'}</p>
      </div>
      {!conversationId ? (
        <form onSubmit={startChat} className="flex-1 p-4 space-y-3 overflow-y-auto">
          <p className="text-sm text-neutral-600">{config.greeting ?? 'Hi! How can we help you today?'}</p>
          <input className="input" placeholder="Your name" required value={name} onChange={(e) => setName(e.target.value)} />
          <input className="input" type="email" placeholder="Email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          <textarea className="input resize-none" rows={4} placeholder="How can we help?" required value={draft} onChange={(e) => setDraft(e.target.value)} />
          <button className="btn-primary w-full" disabled={sending} style={{ background: color }}>{sending ? 'Starting…' : 'Start chat'}</button>
        </form>
      ) : (
        <>
          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {(messages ?? []).map((m) => (
              <div key={m.id} className={`flex ${m.sender_type === 'end_user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm ${m.sender_type === 'end_user' ? 'text-white rounded-br-md' : 'bg-neutral-100 text-neutral-800 rounded-bl-md'}`} style={m.sender_type === 'end_user' ? { background: color } : undefined}>
                  {m.content}
                </div>
              </div>
            ))}
            <div ref={endRef} />
          </div>
          <div className="p-3 border-t border-neutral-100 flex gap-2">
            <input className="input flex-1" value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') send(); }} placeholder="Type a message..." />
            <button className="btn-primary" onClick={send} disabled={sending} style={{ background: color }}><Send className="w-4 h-4" /></button>
          </div>
        </>
      )}
    </div>
  );
}
