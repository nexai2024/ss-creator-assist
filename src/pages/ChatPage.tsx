import { useEffect, useState, useRef } from 'react';
import {
  Send, MessageSquare, Search, Clock, Bot, ArrowUpRight, UserPlus,
  FileText, StickyNote, Zap, X, Check, AlertCircle, Phone, Mail,
  BookOpen, ChevronRight, CircleDot,
} from 'lucide-react';
import type { ChatConversation, ChatMessage, Tenant, Ticket, KbArticle } from '@/types';
import { useAuth } from '@/hooks/useAuth';
import { StatusBadge, PriorityBadge } from '@/components/Badges';
import { LoadingSpinner, EmptyState, ErrorState } from '@/components/States';
import { useToast } from '@/components/Toast';
import { useAgents } from '@/hooks/useAgents';
import { useSavedReplies, useBusinessHours } from '@/hooks/useSolopreneur';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { useMutation, useQuery } from 'convex/react';
import { api } from '../../convex/_generated/api';
import type { Id } from '../../convex/_generated/dataModel';
import { ChatShareBody } from '@/components/ChatShareBody';
import { Modal } from '@/components/Modal';
import { encodeChatShare, excerptFrom, type ArticleShare } from '../../convex/lib/chatContent';

type QuickReply = { label: string; text: string };

const QUICK_REPLIES: QuickReply[] = [
  { label: 'Greeting', text: 'Hi there! Thanks for reaching out. How can I help you today?' },
  { label: 'Apology', text: "I'm sorry for the inconvenience. Let me look into this right away." },
  { label: 'Hold', text: 'Could you please hold for a moment while I check this for you?' },
  { label: 'Resolved', text: 'Glad we could resolve this for you! Is there anything else I can help with?' },
  { label: 'Escalate', text: 'I need to escalate this to our specialist team. They will reach out to you shortly.' },
  { label: 'Follow-up', text: 'Just following up on your issue. Were you able to try the solution I suggested?' },
];

export function ChatPage({ tenant }: { tenant: Tenant | null; tenants: Tenant[] }) {
  const navigate = useNavigate();
  const { conversationId } = useParams();
  const { user } = useAuth();
  const conversationRows = useQuery(api.chat.list, tenant ? { tenantId: tenant.id as Id<'tenants'> } : 'skip');
  const conversations = (conversationRows ?? []) as ChatConversation[];
  const [selectedId, setSelectedId] = useState<string | null>(conversationId ?? null);
  const [reply, setReply] = useState('');
  const [sending, setSending] = useState(false);
  const [search, setSearch] = useState('');
  const [botLoading, setBotLoading] = useState(false);
  const [showQuickReplies, setShowQuickReplies] = useState(false);
  const [showEscalate, setShowEscalate] = useState(false);
  const [noteInput, setNoteInput] = useState('');
  const [contextTab, setContextTab] = useState<'customer' | 'notes' | 'kb'>('customer');
  const [showSavedReplies, setShowSavedReplies] = useState(false);
  const [previewArticle, setPreviewArticle] = useState<KbArticle | null>(null);
  const [sendingArticle, setSendingArticle] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  const selected = conversations.find((c) => c.id === selectedId) ?? null;
  const { agents } = useAgents(tenant?.id ?? null);
  const { replies: savedReplies, incrementUsage } = useSavedReplies(tenant?.id ?? null);
  const { isCurrentlyOpen } = useBusinessHours(tenant?.id ?? null);
  const businessOpen = isCurrentlyOpen();
  const loading = Boolean(tenant) && conversationRows === undefined;
  const error = null;

  const messageRows = useQuery(
    api.chat.messages,
    tenant && selectedId
      ? { tenantId: tenant.id as Id<'tenants'>, conversationId: selectedId as Id<'chatConversations'> }
      : 'skip',
  );
  const messages = (messageRows ?? []) as ChatMessage[];
  const msgLoading = Boolean(selectedId) && messageRows === undefined;
  const noteRows = useQuery(
    api.chat.notes,
    tenant && selectedId
      ? { tenantId: tenant.id as Id<'tenants'>, conversationId: selectedId as Id<'chatConversations'> }
      : 'skip',
  );
  const notes = noteRows ?? [];
  const lastUser = messages.filter((m) => m.sender_type === 'end_user').slice(-1)[0];
  const kbSuggestions = (useQuery(
    api.knowledge.suggested,
    tenant && lastUser
      ? { tenantId: tenant.id as Id<'tenants'>, needle: lastUser.content }
      : 'skip',
  ) ?? []) as KbArticle[];
  const history = useQuery(
    api.dashboard.customerHistory,
    tenant && selected
      ? { tenantId: tenant.id as Id<'tenants'>, email: selected.customer_email }
      : 'skip',
  );
  const linkedTicket = (history?.tickets[0] as Ticket | undefined) ?? null;

  const sendMut = useMutation(api.chat.send);
  const botMut = useMutation(api.chat.botReply);
  const escalateMut = useMutation(api.chat.escalate);
  const noteMut = useMutation(api.chat.addNote);
  const closeMut = useMutation(api.chat.close);
  const assignMut = useMutation(api.chat.assign);

  useEffect(() => {
    if (conversationRows && conversationRows.length > 0) {
      setSelectedId((prev) => prev ?? conversationId ?? conversationRows[0].id);
    }
  }, [conversationRows, conversationId]);

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  const handleSend = async () => {
    if (!reply.trim() || !selectedId || !tenant) return;
    setSending(true);
    try {
      await sendMut({
        tenantId: tenant.id as Id<'tenants'>,
        conversationId: selectedId as Id<'chatConversations'>,
        content: reply.trim(),
        senderName: user?.email ?? 'Agent',
      });
      setReply('');
    } catch {
      toast('Failed to send message', 'error');
    }
    setSending(false);
  };

  const handleSendArticle = async (article: KbArticle) => {
    if (!selectedId || !tenant) return;
    setSendingArticle(true);
    try {
      await sendMut({
        tenantId: tenant.id as Id<'tenants'>,
        conversationId: selectedId as Id<'chatConversations'>,
        senderName: user?.email ?? 'Agent',
        content: encodeChatShare({
          kind: 'article',
          id: article.id,
          title: article.title,
          slug: article.slug,
          tenantSlug: tenant.slug,
          excerpt: excerptFrom(article.content),
        } satisfies ArticleShare, 'Here is an article that might help:'),
      });
      setPreviewArticle(null);
      toast('Article sent', 'success');
    } catch {
      toast('Failed to send article', 'error');
    }
    setSendingArticle(false);
  };

  const handleQuickReply = (text: string) => { setReply(text); setShowQuickReplies(false); };

  const handleBotReply = async () => {
    if (!selectedId || !tenant) return;
    setBotLoading(true);
    try {
      await botMut({
        tenantId: tenant.id as Id<'tenants'>,
        conversationId: selectedId as Id<'chatConversations'>,
        message: messages.filter((m) => m.sender_type === 'end_user').slice(-1)[0]?.content ?? '',
      });
      toast('AI assistant replied', 'success');
    } catch {
      toast('Failed to get AI reply', 'error');
    }
    setBotLoading(false);
  };

  const handleEscalate = async (priority: Ticket['priority'], reason: string) => {
    if (!selected || !tenant) return;
    try {
      const ticket = await escalateMut({
        tenantId: tenant.id as Id<'tenants'>,
        conversationId: selected.id as Id<'chatConversations'>,
        priority,
        reason,
      });
      toast('Conversation escalated. A ticket link was sent in chat.', 'success');
      setShowEscalate(false);
      void ticket;
    } catch {
      toast('Failed to escalate', 'error');
    }
  };

  const handleAddNote = async () => {
    if (!noteInput.trim() || !selectedId || !tenant) return;
    await noteMut({
      tenantId: tenant.id as Id<'tenants'>,
      conversationId: selectedId as Id<'chatConversations'>,
      note: noteInput.trim(),
    });
    setNoteInput('');
    toast('Internal note added', 'success');
  };

  const handleCloseChat = async () => {
    if (!selectedId || !tenant) return;
    await closeMut({ tenantId: tenant.id as Id<'tenants'>, conversationId: selectedId as Id<'chatConversations'> });
    toast('Conversation closed', 'success');
  };

  const handleAssignAgent = async (agentId: string) => {
    if (!selectedId || !tenant) return;
    await assignMut({
      tenantId: tenant.id as Id<'tenants'>,
      conversationId: selectedId as Id<'chatConversations'>,
      agentId: agentId as Id<'agents'>,
    });
    toast('Agent assigned to conversation', 'success');
  };

  const filteredConversations = conversations.filter((c) => {
    if (!search) return true;
    const s = search.toLowerCase();
    return c.customer_name.toLowerCase().includes(s) || c.customer_email.toLowerCase().includes(s);
  });

  if (loading) return <div className="flex items-center justify-center py-24"><LoadingSpinner size={32} /></div>;
  if (error) return <ErrorState message={error} />;

  return (
    <div className="space-y-4 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-neutral-900">Live Chat</h1>
        <p className="text-sm text-neutral-500 mt-1">
          {conversations.filter((c) => c.status === 'active').length} active · {conversations.filter((c) => c.status === 'waiting').length} waiting · <span className={businessOpen ? 'text-success-600 font-medium' : 'text-warning-600 font-medium'}>{businessOpen ? 'Available' : 'Away'}</span> · {tenant ? tenant.name : 'All tenants'}
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4" style={{ height: 'calc(100vh - 180px)' }}>
        {/* Column 1: Conversation list */}
        <div className="lg:col-span-3 card flex flex-col overflow-hidden">
          <div className="px-4 py-3 border-b border-neutral-100">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
              <input type="text" placeholder="Search..." value={search} onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-neutral-200 bg-neutral-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-400 transition-all" aria-label="Search conversations" />
            </div>
          </div>
          <div className="flex-1 overflow-y-auto scrollbar-thin">
            {filteredConversations.length === 0 ? (
              <EmptyState icon={<MessageSquare className="w-7 h-7" />} title="No conversations" description="Live chat conversations will appear here." />
            ) : (
              filteredConversations.map((conv) => {
                const isSelected = conv.id === selectedId;
                return (
                  <button key={conv.id} onClick={() => { setSelectedId(conv.id); navigate(`/chat/${conv.id}`); }}
                      className={`w-full text-left px-4 py-3 border-b border-neutral-50 transition-colors ${isSelected ? 'bg-primary-50/60 border-l-2 border-l-primary-500' : 'hover:bg-neutral-50'}`}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium text-neutral-800 truncate">{conv.customer_name}</span>
                      <StatusBadge status={conv.status} />
                    </div>
                    <p className="text-xs text-neutral-400 truncate">{conv.customer_email}</p>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Column 2: Chat window */}
        <div className="lg:col-span-6 card flex flex-col overflow-hidden">
          {!selected ? (
            <div className="flex-1 flex items-center justify-center">
              <EmptyState icon={<MessageSquare className="w-7 h-7" />} title="Select a conversation" description="Choose a conversation from the list." />
            </div>
          ) : (
            <>
              {/* Header with quick actions */}
              <div className="px-5 py-3 border-b border-neutral-100 flex items-center justify-between">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary-400 to-accent-400 flex items-center justify-center text-white text-sm font-bold flex-shrink-0">
                    {selected.customer_name.charAt(0)}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-neutral-800 truncate">{selected.customer_name}</p>
                    <p className="text-xs text-neutral-400 truncate">{selected.customer_email}</p>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <StatusBadge status={selected.status} />
                  {selected.status !== 'closed' && (
                    <>
                      <button onClick={() => setShowQuickReplies(!showQuickReplies)} className="quick-action-btn" title="Quick replies">
                        <Zap className="w-4 h-4" />
                      </button>
                      <button onClick={() => setShowEscalate(true)} className="quick-action-btn" title="Escalate to ticket">
                        <ArrowUpRight className="w-4 h-4" />
                      </button>
                      <button onClick={() => setContextTab('notes')} className="quick-action-btn" title="Internal notes">
                        <StickyNote className="w-4 h-4" />
                      </button>
                      <button onClick={handleCloseChat} className="quick-action-btn text-danger-500 hover:bg-danger-50" title="Close conversation">
                        <X className="w-4 h-4" />
                      </button>
                    </>
                  )}
                </div>
              </div>

              {/* Quick replies bar */}
              {showQuickReplies && (
                <div className="px-5 py-2.5 border-b border-neutral-100 bg-neutral-50/50 flex flex-wrap gap-2 animate-slide-up">
                  {QUICK_REPLIES.map((qr) => (
                    <button key={qr.label} onClick={() => handleQuickReply(qr.text)}
                      className="px-3 py-1.5 rounded-lg text-xs font-medium bg-white border border-neutral-200 text-neutral-700 hover:border-primary-300 hover:bg-primary-50/30 transition-all">
                      {qr.label}
                    </button>
                  ))}
                </div>
              )}

              {/* Messages */}
              <div className="flex-1 overflow-y-auto scrollbar-thin p-5 space-y-3 bg-neutral-50/30">
                {msgLoading ? (
                  <div className="flex justify-center py-12"><LoadingSpinner /></div>
                ) : messages.length === 0 ? (
                  <EmptyState icon={<MessageSquare className="w-7 h-7" />} title="No messages" description="Send the first message to start the conversation." />
                ) : (
                  messages.map((msg) => (
                    <div key={msg.id} className={`flex ${msg.sender_type === 'agent' ? 'justify-end' : 'justify-start'}`}>
                      <div className="max-w-[75%]">
                        <div className={`px-4 py-2.5 rounded-2xl ${
                          msg.sender_type === 'agent' ? 'bg-primary-600 text-white rounded-br-md'
                          : msg.sender_type === 'bot' ? 'bg-violet-50 border border-violet-200 text-neutral-800 rounded-bl-md'
                          : 'bg-white border border-neutral-200 text-neutral-800 rounded-bl-md'
                        }`}>
                          {msg.sender_type === 'bot' && (
                            <div className="flex items-center gap-1.5 mb-1">
                              <Bot className="w-3.5 h-3.5 text-violet-500" />
                              <span className="text-xs font-medium text-violet-600">AI Assistant</span>
                            </div>
                          )}
                          <ChatShareBody content={msg.content} inverted={msg.sender_type === 'agent'} variant="console" />
                        </div>
                        <p className={`text-xs text-neutral-400 mt-1 px-1 ${msg.sender_type === 'agent' ? 'text-right' : ''}`}>
                          {new Date(msg.created_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                    </div>
                  ))
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Input */}
              {selected.status !== 'closed' ? (
                <div className="px-5 py-3 border-t border-neutral-100">
                  {showSavedReplies && (
                    <div className="mb-2 p-3 rounded-lg bg-neutral-50 border border-neutral-100 max-h-32 overflow-y-auto scrollbar-thin">
                      <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-2">Saved Replies</p>
                      <div className="flex flex-wrap gap-1.5">
                        {savedReplies.map((sr) => (
                          <button key={sr.id} onClick={() => { setReply(sr.content); setShowSavedReplies(false); incrementUsage(sr.id); toast('Reply inserted', 'success'); }}
                            className="px-2.5 py-1.5 rounded-lg text-xs font-medium bg-white border border-neutral-200 text-neutral-700 hover:border-primary-300 hover:bg-primary-50/30 transition-all">
                            {sr.shortcut ?? sr.title}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                  <div className="flex gap-2">
                    <input type="text" value={reply} onChange={(e) => setReply(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                      placeholder="Type a message..." className="input flex-1" aria-label="Type a message" />
                    <button onClick={() => setShowSavedReplies(!showSavedReplies)} className="btn-secondary" aria-label="Saved replies" title="Saved replies">
                      <Zap className="w-4 h-4" />
                    </button>
                    <button onClick={handleBotReply} disabled={botLoading || !tenant} className="btn-secondary" aria-label="Get AI reply" title="AI assistant reply">
                      {botLoading ? <LoadingSpinner size={16} /> : <Bot className="w-4 h-4" />}
                    </button>
                    <button onClick={handleSend} disabled={!reply.trim() || sending} className="btn-primary" aria-label="Send message">
                      <Send className="w-4 h-4" />
                    </button>
                  </div>
                  {!businessOpen && (
                    <p className="text-xs text-warning-600 mt-2 flex items-center gap-1">
                      <AlertCircle className="w-3 h-3" /> You're outside business hours — auto-responder is active for new chats
                    </p>
                  )}
                </div>
              ) : (
                <div className="px-5 py-4 border-t border-neutral-100 text-center">
                  <p className="text-sm text-neutral-400">This conversation is closed</p>
                </div>
              )}
            </>
          )}
        </div>

        {/* Column 3: Context panel */}
        <div className="lg:col-span-3 card flex flex-col overflow-hidden">
          {!selected ? (
            <div className="flex-1 flex items-center justify-center">
              <EmptyState icon={<UserPlus className="w-7 h-7" />} title="No conversation selected" description="Customer details and quick actions will appear here." />
            </div>
          ) : (
            <>
              {/* Tab bar */}
              <div className="flex border-b border-neutral-100">
                {(['customer', 'notes', 'kb'] as const).map((tab) => (
                  <button key={tab} onClick={() => setContextTab(tab)}
                    className={`flex-1 px-3 py-2.5 text-xs font-medium capitalize transition-colors ${
                      contextTab === tab ? 'text-primary-600 border-b-2 border-primary-500' : 'text-neutral-400 hover:text-neutral-600'
                    }`}>
                    {tab === 'kb' ? 'KB Articles' : tab === 'notes' ? `Notes (${notes.length})` : 'Customer'}
                  </button>
                ))}
              </div>

              <div className="flex-1 overflow-y-auto scrollbar-thin p-4">
                {/* Customer tab */}
                {contextTab === 'customer' && (
                  <div className="space-y-4">
                    <div className="flex items-center gap-3 pb-4 border-b border-neutral-100">
                      <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary-400 to-accent-400 flex items-center justify-center text-white text-lg font-bold">
                        {selected.customer_name.charAt(0)}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-neutral-800 truncate">{selected.customer_name}</p>
                        <p className="text-xs text-neutral-400 truncate">{selected.customer_email}</p>
                      </div>
                    </div>

                    <div className="space-y-2.5">
                      <ContextRow icon={Clock} label="Started" value={new Date(selected.created_at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })} />
                      <ContextRow icon={CircleDot} label="Status" value={<StatusBadge status={selected.status} />} />
                      <ContextRow icon={Mail} label="Email" value={selected.customer_email} />
                      <ContextRow icon={Phone} label="Phone" value="Not provided" />
                    </div>

                    {/* Assign agent */}
                    <div className="pt-3 border-t border-neutral-100">
                      <label className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-2 block">Assigned Agent</label>
                      <select
                        value={selected.assigned_agent_id ?? ''}
                        onChange={(e) => handleAssignAgent(e.target.value)}
                        className="input text-sm"
                      >
                        <option value="">Unassigned</option>
                        {agents.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                      </select>
                    </div>

                    {/* Linked ticket */}
                    {linkedTicket && (
                      <div className="pt-3 border-t border-neutral-100">
                        <label className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-2 block">Linked Ticket</label>
                        <Link to={`/tickets/${linkedTicket.id}`} className="block p-3 rounded-lg bg-neutral-50 border border-neutral-100 hover:border-primary-300 hover:bg-primary-50/30 transition-colors">
                          <div className="flex items-center justify-between mb-1">
                            <p className="text-sm font-medium text-neutral-800 truncate">{linkedTicket.subject}</p>
                          </div>
                          <div className="flex items-center gap-2">
                            <PriorityBadge priority={linkedTicket.priority} />
                            <StatusBadge status={linkedTicket.status} />
                          </div>
                          <p className="text-xs text-primary-600 font-medium mt-1.5">Open ticket</p>
                        </Link>
                      </div>
                    )}

                    {/* Quick actions */}
                    <div className="pt-3 border-t border-neutral-100 space-y-2">
                      <label className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-2 block">Quick Actions</label>
                      <button onClick={() => setShowEscalate(true)} className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-neutral-700 bg-neutral-50 hover:bg-neutral-100 transition-colors">
                        <ArrowUpRight className="w-4 h-4 text-primary-500" /> Escalate to Ticket
                      </button>
                      <button onClick={() => { setContextTab('notes'); }} className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-neutral-700 bg-neutral-50 hover:bg-neutral-100 transition-colors">
                        <StickyNote className="w-4 h-4 text-amber-500" /> Add Internal Note
                      </button>
                      <button onClick={handleBotReply} disabled={botLoading || !tenant} className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-neutral-700 bg-neutral-50 hover:bg-neutral-100 transition-colors disabled:opacity-50">
                        <Bot className="w-4 h-4 text-violet-500" /> AI Suggest Reply
                      </button>
                      <button onClick={() => handleQuickReply("Thank you for your patience! I've noted your concern and will follow up shortly.")} className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-neutral-700 bg-neutral-50 hover:bg-neutral-100 transition-colors">
                        <Check className="w-4 h-4 text-success-500" /> Acknowledge
                      </button>
                    </div>
                  </div>
                )}

                {/* Notes tab */}
                {contextTab === 'notes' && (
                  <div className="space-y-3">
                    <div className="flex gap-2">
                      <input type="text" value={noteInput} onChange={(e) => setNoteInput(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter' && noteInput.trim()) handleAddNote(); }}
                        placeholder="Write an internal note..." className="input flex-1 text-sm" aria-label="Internal note" />
                      <button onClick={handleAddNote} disabled={!noteInput.trim()} className="btn-primary" aria-label="Add note">
                        <StickyNote className="w-4 h-4" />
                      </button>
                    </div>
                    <div className="text-xs text-neutral-400 px-1">Notes are internal — the customer cannot see them.</div>
                    {notes.length === 0 ? (
                      <p className="text-sm text-neutral-400 text-center py-6">No notes yet</p>
                    ) : (
                      <div className="space-y-2">
                        {notes.map((note, i) => (
                          <div key={i} className="p-3 rounded-lg bg-amber-50/50 border border-amber-100">
                            <div className="flex items-start gap-2">
                              <StickyNote className="w-3.5 h-3.5 text-amber-500 flex-shrink-0 mt-0.5" />
                              <p className="text-sm text-neutral-700">{note}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* KB tab */}
                {contextTab === 'kb' && (
                  <div className="space-y-3">
                    <p className="text-xs text-neutral-400">Suggested articles based on the conversation:</p>
                    {kbSuggestions.length === 0 ? (
                      <div className="text-center py-8">
                        <BookOpen className="w-8 h-8 text-neutral-300 mx-auto mb-2" />
                        <p className="text-sm text-neutral-400">No matching articles found</p>
                      </div>
                    ) : (
                      kbSuggestions.map((article) => (
                        <button key={article.id}
                          onClick={() => setPreviewArticle(article)}
                          className="w-full text-left p-3 rounded-lg bg-neutral-50 hover:bg-neutral-100 transition-colors group">
                          <div className="flex items-start gap-2">
                            <FileText className="w-4 h-4 text-primary-500 flex-shrink-0 mt-0.5" />
                            <div className="min-w-0">
                              <p className="text-sm font-medium text-neutral-800 truncate group-hover:text-primary-600">{article.title}</p>
                              <p className="text-xs text-neutral-400 mt-0.5 line-clamp-2">{article.content.slice(0, 100)}...</p>
                              <div className="flex items-center gap-2 mt-1.5">
                                <span className="text-xs text-neutral-400">{article.views} views</span>
                                <span className="text-xs text-success-500">{article.helpful_votes} helpful</span>
                              </div>
                            </div>
                            <ChevronRight className="w-4 h-4 text-neutral-300 group-hover:text-primary-400 flex-shrink-0 mt-1" />
                          </div>
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Escalate modal */}
      {showEscalate && selected && (
        <EscalateModal
          customerName={selected.customer_name}
          onClose={() => setShowEscalate(false)}
          onEscalate={handleEscalate}
        />
      )}

      {previewArticle && (
        <Modal open onClose={() => setPreviewArticle(null)} title={previewArticle.title} size="lg">
          <p className="text-sm text-neutral-700 leading-relaxed whitespace-pre-wrap">{previewArticle.content}</p>
          <div className="flex justify-end gap-2 mt-6">
            <button type="button" onClick={() => setPreviewArticle(null)} className="btn-secondary">Close</button>
            <button
              type="button"
              disabled={sendingArticle || selected?.status === 'closed'}
              onClick={() => void handleSendArticle(previewArticle)}
              className="btn-primary"
            >
              {sendingArticle ? 'Sending…' : 'Send to customer'}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}

function ContextRow({ icon: Icon, label, value }: { icon: typeof Clock; label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2.5">
      <Icon className="w-4 h-4 text-neutral-400 flex-shrink-0" />
      <div className="min-w-0 flex-1">
        <p className="text-xs text-neutral-400">{label}</p>
        <p className="text-sm font-medium text-neutral-700 truncate">{value}</p>
      </div>
    </div>
  );
}

function EscalateModal({ customerName, onClose, onEscalate }: { customerName: string; onClose: () => void; onEscalate: (priority: Ticket['priority'], reason: string) => void }) {
  const [priority, setPriority] = useState<Ticket['priority']>('high');
  const [reason, setReason] = useState('');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fade-in">
      <div className="absolute inset-0 bg-neutral-900/40 backdrop-blur-sm" onClick={onClose} />
      <div role="dialog" aria-modal="true" className="relative max-w-md w-full bg-white rounded-2xl shadow-2xl border border-neutral-200 animate-slide-up overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-100">
          <div className="flex items-center gap-2">
            <ArrowUpRight className="w-5 h-5 text-primary-500" />
            <h2 className="text-lg font-semibold text-neutral-900">Escalate to Ticket</h2>
          </div>
          <button onClick={onClose} aria-label="Close" className="p-1.5 rounded-lg text-neutral-400 hover:bg-neutral-100">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="px-6 py-5 space-y-4">
          <p className="text-sm text-neutral-500">Create a ticket from this chat with {customerName}. The conversation will be linked for reference.</p>
          <div>
            <label className="text-sm font-medium text-neutral-700 mb-1.5 block">Priority</label>
            <div className="grid grid-cols-4 gap-2">
              {(['low', 'medium', 'high', 'urgent'] as const).map((p) => (
                <button key={p} onClick={() => setPriority(p)}
                  className={`px-3 py-2 rounded-lg text-sm font-medium border transition-all ${priority === p ? 'border-primary-400 bg-primary-50 text-primary-700' : 'border-neutral-200 text-neutral-600 hover:bg-neutral-50'}`}>
                  {p.charAt(0).toUpperCase() + p.slice(1)}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-sm font-medium text-neutral-700 mb-1.5 block">Reason</label>
            <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={3}
              className="input resize-none" placeholder="Describe why this conversation needs escalation..." />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button onClick={onClose} className="btn-secondary">Cancel</button>
            <button onClick={() => onEscalate(priority, reason || 'No reason provided')} className="btn-primary">
              <ArrowUpRight className="w-4 h-4" /> Escalate
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
