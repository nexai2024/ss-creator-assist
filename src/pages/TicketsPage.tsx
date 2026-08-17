import { useEffect, useState, useMemo, type ComponentType } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  Plus,
  Search,
  Ticket as TicketIcon,
  Clock,
  ChevronRight,
  Send,
  ArrowLeft,
  Mail,
  User,
  Trash2,
} from 'lucide-react';
import type { Ticket, TicketMessage, Tenant } from '@/types';
import { useAgents } from '@/hooks/useAgents';
import { useSavedReplies, useCustomerProfile, useTimeEntries, useFollowUps } from '@/hooks/useSolopreneur';
import { useAuth } from '@/hooks/useAuth';
import { hasPermission } from '@/lib/permissions';
import { PriorityBadge, StatusBadge } from '@/components/Badges';
import { Modal } from '@/components/Modal';
import { Customer360Modal } from '@/components/Customer360Modal';
import { LoadingSpinner, EmptyState, ErrorState, TableSkeleton } from '@/components/States';
import { useToast } from '@/components/Toast';
import { Star, Zap, CheckCircle2 } from 'lucide-react';
import { useMutation, usePaginatedQuery, useQuery } from 'convex/react';
import { api } from '../../convex/_generated/api';
import type { Id } from '../../convex/_generated/dataModel';

export function TicketsPage({ tenant, tenants }: { tenant: Tenant | null; tenants: Tenant[] }) {
  const navigate = useNavigate();
  const { ticketId } = useParams();
  const [searchParams] = useSearchParams();
  const paginated = usePaginatedQuery(
    api.tickets.list,
    tenant ? { tenantId: tenant.id as Id<'tenants'> } : 'skip',
    { initialNumItems: 20 },
  );
  const tickets = (paginated.results ?? []) as Ticket[];
  const deepTicket = useQuery(
    api.tickets.get,
    tenant && ticketId
      ? { tenantId: tenant.id as Id<'tenants'>, ticketId: ticketId as Id<'tickets'> }
      : 'skip',
  ) as Ticket | null | undefined;
  const [search, setSearch] = useState(searchParams.get('q') ?? '');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');
  const [showCreate, setShowCreate] = useState(false);
  const loading = Boolean(tenant) && paginated.status === 'LoadingFirstPage';
  const error = null;

  const selectedTicket = (tickets.find((t) => t.id === ticketId) ?? deepTicket ?? null) as Ticket | null;

  const filtered = useMemo(() => {
    return tickets.filter((t) => {
      if (statusFilter !== 'all' && t.status !== statusFilter) return false;
      if (priorityFilter !== 'all' && t.priority !== priorityFilter) return false;
      if (search) {
        const s = search.toLowerCase();
        return t.subject.toLowerCase().includes(s) || t.customer_name.toLowerCase().includes(s) || t.customer_email.toLowerCase().includes(s);
      }
      return true;
    });
  }, [tickets, search, statusFilter, priorityFilter]);

  if (loading) return <TableSkeleton />;
  if (ticketId && selectedTicket === null && deepTicket === undefined) return <TableSkeleton />;
  if (error) return <ErrorState message={error} />;

  if (selectedTicket) {
    return (
      <TicketDetail
        ticket={selectedTicket}
        onBack={() => navigate('/tickets')}
        onUpdate={() => {}}
        tenants={tenants}
      />
    );
  }

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900">Tickets</h1>
          <p className="text-sm text-neutral-500 mt-1">{filtered.length} tickets · {tenant ? tenant.name : 'All tenants'}</p>
        </div>
        <button onClick={() => setShowCreate(true)} className="btn-primary">
          <Plus className="w-4 h-4" />
          New Ticket
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
          <input
            type="text"
            placeholder="Search by subject, customer name, or email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input pl-10"
          />
        </div>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="input sm:w-40">
          <option value="all">All Status</option>
          <option value="open">Open</option>
          <option value="pending">Pending</option>
          <option value="resolved">Resolved</option>
          <option value="closed">Closed</option>
        </select>
        <select value={priorityFilter} onChange={(e) => setPriorityFilter(e.target.value)} className="input sm:w-40">
          <option value="all">All Priority</option>
          <option value="urgent">Urgent</option>
          <option value="high">High</option>
          <option value="medium">Medium</option>
          <option value="low">Low</option>
        </select>
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <div className="card">
          <EmptyState icon={<TicketIcon className="w-7 h-7" />} title="No tickets found" description="Try adjusting your filters or create a new ticket." />
        </div>
      ) : (
        <>
          {/* Desktop table */}
          <div className="card overflow-hidden hidden sm:block">
            <div className="overflow-x-auto scrollbar-thin">
              <table className="w-full">
                <thead className="bg-neutral-50/50 border-b border-neutral-100">
                  <tr>
                    <th className="table-header px-5 py-3">Subject</th>
                    <th className="table-header px-4 py-3 hidden md:table-cell">Customer</th>
                    <th className="table-header px-4 py-3">Priority</th>
                    <th className="table-header px-4 py-3">Status</th>
                    <th className="table-header px-4 py-3 hidden lg:table-cell">SLA Deadline</th>
                    <th className="table-header px-4 py-3 hidden sm:table-cell">Tenant</th>
                    <th className="px-4 py-3"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-50">
                  {filtered.map((ticket) => {
                    const tenantInfo = tenants.find((t) => t.id === ticket.tenant_id);
                    const slaOverdue = ticket.sla_deadline && new Date(ticket.sla_deadline) < new Date() && ticket.status !== 'resolved';
                    return (
                      <tr
                        key={ticket.id}
                        onClick={() => navigate(`/tickets/${ticket.id}`)}
                        className="hover:bg-neutral-50/50 cursor-pointer transition-colors"
                      >
                        <td className="px-5 py-3.5">
                          <div className="flex items-center gap-2">
                            {ticket.deflection_suggested && (
                              <span className="w-1.5 h-1.5 rounded-full bg-violet-400 flex-shrink-0" title="AI deflection suggested" />
                            )}
                            <div className="min-w-0">
                              <p className="text-sm font-medium text-neutral-800 truncate">{ticket.subject}</p>
                              <p className="text-xs text-neutral-400 mt-0.5">{ticket.category}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3.5 hidden md:table-cell">
                          <p className="text-sm text-neutral-700">{ticket.customer_name}</p>
                          <p className="text-xs text-neutral-400">{ticket.customer_email}</p>
                        </td>
                        <td className="px-4 py-3.5"><PriorityBadge priority={ticket.priority} /></td>
                        <td className="px-4 py-3.5"><StatusBadge status={ticket.status} /></td>
                        <td className="px-4 py-3.5 hidden lg:table-cell">
                          {ticket.sla_deadline ? (
                            <span className={`text-sm flex items-center gap-1.5 ${slaOverdue ? 'text-danger-600 font-medium' : 'text-neutral-500'}`}>
                              <Clock className="w-3.5 h-3.5" />
                              {new Date(ticket.sla_deadline).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                            </span>
                          ) : (
                            <span className="text-xs text-neutral-300">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3.5 hidden sm:table-cell">
                          <span className="text-sm text-neutral-500">{tenantInfo?.name ?? '—'}</span>
                        </td>
                        <td className="px-4 py-3.5">
                          <ChevronRight className="w-4 h-4 text-neutral-300" />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Mobile cards */}
          <div className="sm:hidden space-y-3">
            {filtered.map((ticket) => {
              const slaOverdue = ticket.sla_deadline && new Date(ticket.sla_deadline) < new Date() && ticket.status !== 'resolved';
              return (
                <button
                  key={ticket.id}
                  onClick={() => navigate(`/tickets/${ticket.id}`)}
                  className="card card-hover p-4 text-left w-full"
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-neutral-800 truncate">{ticket.subject}</p>
                      <p className="text-xs text-neutral-400 mt-0.5">{ticket.customer_name} · {ticket.category}</p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-neutral-300 flex-shrink-0 mt-1" />
                  </div>
                  <div className="flex items-center gap-2 mt-2">
                    <PriorityBadge priority={ticket.priority} />
                    <StatusBadge status={ticket.status} />
                    {ticket.sla_deadline && (
                      <span className={`text-xs flex items-center gap-1 ${slaOverdue ? 'text-danger-600 font-medium' : 'text-neutral-400'}`}>
                        <Clock className="w-3 h-3" />
                        {new Date(ticket.sla_deadline).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
          {paginated.status === 'CanLoadMore' && (
            <div className="flex justify-center">
              <button className="btn-secondary" onClick={() => paginated.loadMore(20)}>Load more tickets</button>
            </div>
          )}
        </>
      )}

      <CreateTicketModal
        open={showCreate}
        onClose={() => setShowCreate(false)}
        tenants={tenants}
        lockedTenantId={tenant?.id ?? null}
        onCreated={() => { setShowCreate(false); }}
      />
    </div>
  );
}

function TicketDetail({
  ticket,
  onBack,
  onUpdate,
  tenants,
}: {
  ticket: Ticket;
  onBack: () => void;
  onUpdate: (t: Ticket) => void;
  tenants: Tenant[];
}) {
  const { agents, loading: agentsLoading } = useAgents(ticket.tenant_id);
  const { replies, incrementUsage } = useSavedReplies(ticket.tenant_id);
  const { profile } = useCustomerProfile(ticket.tenant_id, ticket.customer_email);
  const { add: addTime, totalMinutes } = useTimeEntries(ticket.tenant_id);
  const { create: createFollowUp } = useFollowUps(ticket.tenant_id);
  const { currentRole, user } = useAuth();
  const messageRows = useQuery(api.tickets.messages, {
    tenantId: ticket.tenant_id as Id<'tenants'>,
    ticketId: ticket.id as Id<'tickets'>,
  });
  const messages = (messageRows ?? []) as TicketMessage[];
  const addMessage = useMutation(api.tickets.addMessage);
  const updateStatus = useMutation(api.tickets.updateStatus);
  const assignMut = useMutation(api.tickets.assign);
  const recordFinance = useMutation(api.tickets.recordFinance);
  const removeTicket = useMutation(api.tickets.remove);
  const [reply, setReply] = useState('');
  const [sending, setSending] = useState(false);
  const [showSavedReplies, setShowSavedReplies] = useState(false);
  const [showCustomer360, setShowCustomer360] = useState(false);
  const [minutes, setMinutes] = useState('15');
  const [followAt, setFollowAt] = useState('');
  const { toast } = useToast();
  const tenantInfo = tenants.find((t) => t.id === ticket.tenant_id);
  const isVip = profile?.is_vip ?? false;
  const msgLoading = messageRows === undefined;

  const handleSendReply = async () => {
    if (!reply.trim()) return;
    setSending(true);
    try {
      await addMessage({
        tenantId: ticket.tenant_id as Id<'tenants'>,
        ticketId: ticket.id as Id<'tickets'>,
        content: reply.trim(),
        senderName: user?.email ?? 'Agent',
      });
      setReply('');
    } catch {
      toast('Failed to send reply', 'error');
    }
    setSending(false);
  };

  const handleStatusChange = async (status: Ticket['status']) => {
    try {
      const data = await updateStatus({
        tenantId: ticket.tenant_id as Id<'tenants'>,
        ticketId: ticket.id as Id<'tickets'>,
        status,
      });
      onUpdate(data as Ticket);
      toast(`Ticket status changed to ${status}`, 'success');
    } catch {
      toast('Failed to update status', 'error');
    }
  };

  const handleAssign = async (agentId: string | null) => {
    try {
      const data = await assignMut({
        tenantId: ticket.tenant_id as Id<'tenants'>,
        ticketId: ticket.id as Id<'tickets'>,
        agentId: agentId ? agentId as Id<'agents'> : null,
      });
      onUpdate(data as Ticket);
      toast('Agent assigned', 'success');
    } catch {
      toast('Failed to assign agent', 'error');
    }
  };

  return (
    <div className="space-y-5 animate-fade-in">
      <button onClick={onBack} className="btn-ghost -ml-2">
        <ArrowBackIcon />
        Back to tickets
      </button>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Conversation */}
        <div className="lg:col-span-2 card flex flex-col" style={{ minHeight: '500px' }}>
          <div className="px-5 py-4 border-b border-neutral-100">
            <h2 className="text-lg font-semibold text-neutral-900">{ticket.subject}</h2>
            <div className="flex items-center gap-2 mt-2">
              <PriorityBadge priority={ticket.priority} />
              <StatusBadge status={ticket.status} />
              <span className="text-xs text-neutral-400">· {ticket.category}</span>
              {hasPermission(currentRole, 'tickets:delete') && (
                <button
                  className="ml-auto btn-ghost text-danger-500 hover:bg-danger-50"
                  onClick={async () => {
                    if (!window.confirm('Delete this ticket and its messages?')) return;
                    try {
                      await removeTicket({
                        tenantId: ticket.tenant_id as Id<'tenants'>,
                        ticketId: ticket.id as Id<'tickets'>,
                      });
                      toast('Ticket deleted', 'success');
                      onBack();
                    } catch (err) {
                      toast(err instanceof Error ? err.message : 'Failed to delete ticket', 'error');
                    }
                  }}
                >
                  <Trash2 className="w-4 h-4" />
                  Delete
                </button>
              )}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto scrollbar-thin p-5 space-y-4">
            {msgLoading ? (
              <div className="flex justify-center py-12"><LoadingSpinner /></div>
            ) : messages.length === 0 ? (
              <EmptyState icon={<TicketIcon className="w-7 h-7" />} title="No messages yet" description="Start the conversation by sending a reply." />
            ) : (
              messages.map((msg) => (
                <div key={msg.id} className={`flex ${msg.sender_type === 'agent' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[75%] ${msg.sender_type === 'agent' ? 'order-2' : ''}`}>
                    <div className={`px-4 py-3 rounded-2xl ${
                      msg.sender_type === 'agent'
                        ? 'bg-primary-600 text-white rounded-br-md'
                        : 'bg-neutral-100 text-neutral-800 rounded-bl-md'
                    }`}>
                      <p className="text-sm leading-relaxed">{msg.content}</p>
                    </div>
                    <p className={`text-xs text-neutral-400 mt-1 px-1 ${msg.sender_type === 'agent' ? 'text-right' : ''}`}>
                      {msg.sender_name} · {new Date(msg.created_at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>

          {ticket.status !== 'closed' && (
            <div className="px-5 py-4 border-t border-neutral-100">
              {showSavedReplies && (
                <div className="mb-2 p-3 rounded-lg bg-neutral-50 border border-neutral-100 max-h-40 overflow-y-auto scrollbar-thin">
                  <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-2">Saved Replies</p>
                  <div className="flex flex-wrap gap-1.5">
                    {replies.map((sr) => (
                      <button key={sr.id} onClick={() => { setReply(sr.content); setShowSavedReplies(false); incrementUsage(sr.id); toast('Reply inserted', 'success'); }}
                        className="px-2.5 py-1.5 rounded-lg text-xs font-medium bg-white border border-neutral-200 text-neutral-700 hover:border-primary-300 hover:bg-primary-50/30 transition-all">
                        {sr.shortcut ?? sr.title}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              <div className="flex gap-2">
                <textarea
                  value={reply}
                  onChange={(e) => setReply(e.target.value)}
                  placeholder="Type your reply..."
                  rows={2}
                  className="input flex-1 resize-none"
                  onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleSendReply(); }}
                />
                <button onClick={() => setShowSavedReplies(!showSavedReplies)} className="btn-secondary self-end" title="Saved replies">
                  <Zap className="w-4 h-4" />
                </button>
                <button onClick={handleSendReply} disabled={!reply.trim() || sending} className="btn-primary self-end">
                  <Send className="w-4 h-4" />
                </button>
              </div>
              <div className="flex items-center justify-between mt-2">
                <p className="text-xs text-neutral-400">Press Cmd/Ctrl + Enter to send</p>
                <button onClick={() => handleStatusChange('resolved')} className="text-xs text-success-600 hover:text-success-700 font-medium flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" /> One-click Resolve
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Sidebar info */}
        <div className="space-y-5">
          <div className="card p-5">
            <h3 className="text-sm font-semibold text-neutral-800 mb-4">Ticket Details</h3>
            <div className="space-y-3">
              <DetailRow icon={TicketIcon} label="Ticket ID" value={ticket.id} />
              <DetailRow icon={User} label="Customer" value={(
                <button onClick={() => setShowCustomer360(true)} className="flex items-center gap-1.5 text-sm font-medium text-primary-600 hover:text-primary-700">
                  {ticket.customer_name}
                  {isVip && <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />}
                </button>
              )} />
              <DetailRow icon={Mail} label="Email" value={ticket.customer_email} />
              {ticket.customer_external_id && (
                <DetailRow icon={User} label="External ID" value={ticket.customer_external_id} />
              )}
              {ticket.sla_deadline && (
                <DetailRow icon={Clock} label="SLA Deadline" value={new Date(ticket.sla_deadline).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })} />
              )}
              {ticket.csat_score !== null && (
                <DetailRow icon={StarIcon} label="CSAT Score" value={`${ticket.csat_score}/5`} />
              )}
              {tenantInfo && <DetailRow icon={BuildingIcon} label="Tenant" value={tenantInfo.name} />}
            </div>
          </div>

          <div className="card p-5 space-y-3">
            <h3 className="text-sm font-semibold text-neutral-800">Time & follow-up</h3>
            <p className="text-xs text-neutral-400">{totalMinutes} minutes logged on this tenant</p>
            <div className="flex gap-2">
              <input className="input" type="number" min={1} value={minutes} onChange={(e) => setMinutes(e.target.value)} />
              <button className="btn-secondary" onClick={async () => {
                await addTime({ entity_type: 'ticket', entity_id: ticket.id, minutes: Number(minutes) || 0, billable: false });
                toast('Time logged', 'success');
              }}>Log</button>
            </div>
            <input className="input" type="datetime-local" value={followAt} onChange={(e) => setFollowAt(e.target.value)} />
            <button className="btn-secondary w-full" onClick={async () => {
              if (!followAt) return;
              await createFollowUp({
                entity_type: 'ticket',
                entity_id: ticket.id,
                customer_email: ticket.customer_email,
                customer_name: ticket.customer_name,
                reminder_at: new Date(followAt).toISOString(),
                note: 'Follow up on ticket',
              });
              toast('Follow-up scheduled', 'success');
            }}>Schedule follow-up</button>
            {hasPermission(currentRole, 'finance:refund') && (
              <button className="btn-secondary w-full" onClick={async () => {
                try {
                  await recordFinance({
                    tenantId: ticket.tenant_id as Id<'tenants'>,
                    ticketId: ticket.id as Id<'tickets'>,
                    amount: 0,
                    note: 'Refund recorded from ticket',
                  });
                  toast('Refund recorded in the audit log', 'success');
                } catch (err) {
                  toast(err instanceof Error ? err.message : 'Failed to record refund', 'error');
                }
              }}>Record refund</button>
            )}
          </div>

          <div className="card p-5">
            <h3 className="text-sm font-semibold text-neutral-800 mb-3">Assignment</h3>
            {agentsLoading ? (
              <div className="flex justify-center py-4"><LoadingSpinner size={20} /></div>
            ) : (
              <select
                value={ticket.assigned_agent_id ?? ''}
                onChange={(e) => handleAssign(e.target.value || null)}
                className="input"
              >
                <option value="">Unassigned</option>
                {agents.map((a) => (
                  <option key={a.id} value={a.id}>{a.name} ({a.role})</option>
                ))}
              </select>
            )}
          </div>

          <div className="card p-5">
            <h3 className="text-sm font-semibold text-neutral-800 mb-3">Update Status</h3>
            <div className="grid grid-cols-2 gap-2">
              {(['open', 'pending', 'resolved', 'closed'] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => handleStatusChange(s)}
                  className={`px-3 py-2 rounded-lg text-sm font-medium border transition-all ${
                    ticket.status === s
                      ? 'border-primary-400 bg-primary-50 text-primary-700'
                      : 'border-neutral-200 text-neutral-600 hover:bg-neutral-50'
                  }`}
                >
                  {s.charAt(0).toUpperCase() + s.slice(1)}
                </button>
              ))}
            </div>
          </div>

          {(ticket.status === 'resolved' || ticket.status === 'closed') && (
            <CsatWidget tenantId={ticket.tenant_id} ticketId={ticket.id} existingScore={ticket.csat_score} onSubmitted={(score) => {
              onUpdate({ ...ticket, csat_score: score });
            }} />
          )}

          {Object.keys(ticket.custom_fields ?? {}).length > 0 && (
            <div className="card p-5">
              <h3 className="text-sm font-semibold text-neutral-800 mb-3">Custom Fields</h3>
              <div className="space-y-2">
                {Object.entries(ticket.custom_fields).map(([key, value]) => (
                  <div key={key} className="flex items-center justify-between text-sm">
                    <span className="text-neutral-500 capitalize">{key.replace(/_/g, ' ')}</span>
                    <span className="font-medium text-neutral-700">{value}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {showCustomer360 && tenantInfo && (
        <Customer360Modal
          tenant={tenantInfo}
          email={ticket.customer_email}
          name={ticket.customer_name}
          onClose={() => setShowCustomer360(false)}
        />
      )}
    </div>
  );
}

function CreateTicketModal({
  open,
  onClose,
  tenants,
  lockedTenantId,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  tenants: Tenant[];
  lockedTenantId: string | null;
  onCreated: () => void;
}) {
  const [form, setForm] = useState({
    tenant_id: lockedTenantId ?? tenants[0]?.id ?? '',
    subject: '',
    category: 'General',
    priority: 'medium' as Ticket['priority'],
    customer_name: '',
    customer_email: '',
    body: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();
  const createMut = useMutation(api.tickets.create);

  useEffect(() => {
    if (lockedTenantId) setForm((f) => ({ ...f, tenant_id: lockedTenantId }));
  }, [lockedTenantId]);

  const handleSubmit = async () => {
    if (!form.subject || !form.customer_name || !form.customer_email || !form.tenant_id) {
      setError('Please fill in all required fields');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await createMut({
        tenantId: form.tenant_id as Id<'tenants'>,
        subject: form.subject,
        category: form.category,
        priority: form.priority,
        customerName: form.customer_name,
        customerEmail: form.customer_email,
        body: form.body || undefined,
      });
      setForm({ tenant_id: lockedTenantId ?? tenants[0]?.id ?? '', subject: '', category: 'General', priority: 'medium', customer_name: '', customer_email: '', body: '' });
      toast('Ticket created successfully', 'success');
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create ticket');
    }
    setSubmitting(false);
  };

  return (
    <Modal open={open} onClose={onClose} title="Create New Ticket" size="lg">
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
            <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className="input">
              {['General', 'Billing', 'Technical', 'Account', 'Security', 'Feature Request'].map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
        </div>
        <div>
          <label className="text-sm font-medium text-neutral-700 mb-1.5 block">Subject *</label>
          <input type="text" value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} className="input" placeholder="Brief description of the issue" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="text-sm font-medium text-neutral-700 mb-1.5 block">Priority</label>
            <select value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value as Ticket['priority'] })} className="input">
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="urgent">Urgent</option>
            </select>
          </div>
          <div>
            <label className="text-sm font-medium text-neutral-700 mb-1.5 block">Customer Name *</label>
            <input type="text" value={form.customer_name} onChange={(e) => setForm({ ...form, customer_name: e.target.value })} className="input" placeholder="Jane Doe" />
          </div>
          <div>
            <label className="text-sm font-medium text-neutral-700 mb-1.5 block">Customer Email *</label>
            <input type="email" value={form.customer_email} onChange={(e) => setForm({ ...form, customer_email: e.target.value })} className="input" placeholder="jane@example.com" />
          </div>
        </div>
        <div>
          <label className="text-sm font-medium text-neutral-700 mb-1.5 block">Description</label>
          <textarea value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} rows={4} className="input resize-none" placeholder="Detailed description of the issue..." />
        </div>
        <div className="flex justify-end gap-3 pt-2">
          <button onClick={onClose} className="btn-secondary">Cancel</button>
          <button onClick={handleSubmit} disabled={submitting} className="btn-primary">
            {submitting ? <LoadingSpinner size={16} /> : <Plus className="w-4 h-4" />}
            Create Ticket
          </button>
        </div>
      </div>
    </Modal>
  );
}

function CsatWidget({ tenantId, ticketId, existingScore, onSubmitted }: { tenantId: string; ticketId: string; existingScore: number | null; onSubmitted: (score: number) => void }) {
  const [rating, setRating] = useState<number | null>(existingScore);
  const [hover, setHover] = useState<number | null>(null);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(existingScore !== null);
  const { toast } = useToast();
  const submitCsat = useMutation(api.tickets.submitCsat);

  const handleSubmit = async (value: number) => {
    setRating(value);
    setSubmitting(true);
    try {
      await submitCsat({
        tenantId: tenantId as Id<'tenants'>,
        ticketId: ticketId as Id<'tickets'>,
        rating: value,
      });
      onSubmitted(value);
      setSubmitted(true);
      toast('Thank you for your feedback!', 'success');
    } catch {
      toast('Failed to submit feedback', 'error');
    }
    setSubmitting(false);
  };

  return (
    <div className="card p-5">
      <h3 className="text-sm font-semibold text-neutral-800 mb-1">Customer Satisfaction</h3>
      <p className="text-xs text-neutral-400 mb-3">Rate this ticket resolution (1-5 stars).</p>
      {submitted ? (
        <div className="flex items-center gap-2">
          <div className="flex">
            {[1, 2, 3, 4, 5].map((star) => (
              <StarIcon key={star} className={`w-5 h-5 ${(rating ?? 0) >= star ? 'text-amber-400' : 'text-neutral-200'}`} />
            ))}
          </div>
          <span className="text-sm text-neutral-500">{rating}/5</span>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex gap-1">
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                key={star}
                onClick={() => handleSubmit(star)}
                onMouseEnter={() => setHover(star)}
                onMouseLeave={() => setHover(null)}
                disabled={submitting}
                className="p-1 transition-transform hover:scale-110"
                aria-label={`Rate ${star} stars`}
              >
                <StarIcon className={`w-7 h-7 ${(hover ?? rating ?? 0) >= star ? 'text-amber-400' : 'text-neutral-200'}`} />
              </button>
            ))}
          </div>
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Optional comment..."
            rows={2}
            className="input resize-none text-sm"
          />
        </div>
      )}
    </div>
  );
}

function DetailRow({ icon: Icon, label, value }: { icon: ComponentType<{ className?: string }>; label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3">
      <Icon className="w-4 h-4 text-neutral-400 flex-shrink-0" />
      <div className="min-w-0">
        <p className="text-xs text-neutral-400">{label}</p>
        <p className="text-sm font-medium text-neutral-700 truncate">{value}</p>
      </div>
    </div>
  );
}

function ArrowBackIcon() {
  return <ArrowLeft className="w-4 h-4" />;
}

function StarIcon({ className }: { className?: string }) {
  return <svg className={className} fill="currentColor" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" /></svg>;
}

function BuildingIcon({ className }: { className?: string }) {
  return <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0H5m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>;
}
