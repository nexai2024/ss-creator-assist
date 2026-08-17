import { useMemo, useState } from 'react';
import { Inbox, Ticket as TicketIcon, MessageSquare, Search, AlertCircle } from 'lucide-react';
import type { Tenant, Ticket } from '@/types';
import { LoadingSpinner, EmptyState, ErrorState } from '@/components/States';
import { PriorityBadge, StatusBadge } from '@/components/Badges';
import { useFollowUps } from '@/hooks/useSolopreneur';
import { useNavigate } from 'react-router-dom';
import { usePaginatedQuery, useQuery } from 'convex/react';
import { api } from '../../convex/_generated/api';
import type { Id } from '../../convex/_generated/dataModel';

type InboxItem = {
  id: string;
  type: 'ticket' | 'chat';
  subject: string;
  customer_name: string;
  customer_email: string;
  priority: Ticket['priority'] | null;
  status: string;
  created_at: string;
  tenant_id: string;
};

export function InboxPage({ tenant }: { tenant: Tenant | null; tenants: Tenant[] }) {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'open' | 'urgent' | 'overdue'>('all');
  const { followUps, overdue } = useFollowUps(tenant?.id ?? null);
  const paginatedTickets = usePaginatedQuery(
    api.tickets.list,
    tenant ? { tenantId: tenant.id as Id<'tenants'> } : 'skip',
    { initialNumItems: 20 },
  );
  const chats = useQuery(
    api.chat.list,
    tenant ? { tenantId: tenant.id as Id<'tenants'> } : 'skip',
  );

  const items: InboxItem[] = useMemo(() => {
    const ticketItems: InboxItem[] = (paginatedTickets.results ?? []).map((t) => ({
      id: t.id, type: 'ticket' as const, subject: t.subject,
      customer_name: t.customer_name, customer_email: t.customer_email,
      priority: t.priority as Ticket['priority'], status: t.status,
      created_at: t.created_at, tenant_id: t.tenant_id,
    }));
    const chatItems: InboxItem[] = (chats ?? []).map((c) => ({
      id: c.id, type: 'chat' as const, subject: `Chat with ${c.customer_name}`,
      customer_name: c.customer_name, customer_email: c.customer_email,
      priority: null, status: c.status, created_at: c.created_at, tenant_id: c.tenant_id,
    }));
    return [...ticketItems, ...chatItems].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }, [paginatedTickets.results, chats]);

  const loading = Boolean(tenant) && (paginatedTickets.status === 'LoadingFirstPage' || chats === undefined);
  const error = null;

  const filteredItems = useMemo(() => {
    let result = items;
    if (search) {
      const s = search.toLowerCase();
      result = result.filter((i) => i.subject.toLowerCase().includes(s) || i.customer_name.toLowerCase().includes(s) || i.customer_email.toLowerCase().includes(s));
    }
    if (filter === 'open') result = result.filter((i) => i.status === 'open' || i.status === 'pending' || i.status === 'active' || i.status === 'waiting');
    if (filter === 'urgent') result = result.filter((i) => i.priority === 'urgent' || i.priority === 'high');
    if (filter === 'overdue') {
      const overdueIds = new Set(overdue.map((f) => f.entity_id));
      result = result.filter((i) => overdueIds.has(i.id));
    }
    return result;
  }, [items, search, filter, overdue]);

  const openCount = items.filter((i) => i.status === 'open' || i.status === 'pending' || i.status === 'active' || i.status === 'waiting').length;
  const urgentCount = items.filter((i) => i.priority === 'urgent' || i.priority === 'high').length;

  if (loading) return <div className="flex items-center justify-center py-24"><LoadingSpinner size={32} /></div>;
  if (error) return <ErrorState message={error} />;

  return (
    <div className="space-y-5 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-neutral-900">Unified Inbox</h1>
        <p className="text-sm text-neutral-500 mt-1">
          {openCount} open · {urgentCount} urgent · {followUps.filter((f) => !f.completed).length} follow-ups · {tenant?.name ?? 'All tenants'}
        </p>
      </div>

      {overdue.length > 0 && (
        <div className="flex items-center gap-3 p-4 rounded-xl bg-warning-50 border border-warning-200">
          <AlertCircle className="w-5 h-5 text-warning-600 flex-shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-medium text-warning-800">{overdue.length} follow-up{overdue.length > 1 ? 's' : ''} overdue</p>
            <p className="text-xs text-warning-600 mt-0.5">
              {overdue.slice(0, 2).map((f) => f.customer_name ?? f.customer_email).join(', ')}{overdue.length > 2 ? ` and ${overdue.length - 2} more` : ''}
            </p>
          </div>
        </div>
      )}

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
          <input type="text" placeholder="Search inbox..." value={search} onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2.5 text-sm rounded-lg border border-neutral-200 bg-neutral-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-400 transition-all" />
        </div>
        <div className="flex gap-2">
          {(['all', 'open', 'urgent', 'overdue'] as const).map((f) => (
            <button key={f} onClick={() => setFilter(f)}
              className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors capitalize ${
                filter === f ? 'bg-primary-500 text-white' : 'bg-white border border-neutral-200 text-neutral-600 hover:bg-neutral-50'
              }`}>{f}</button>
          ))}
        </div>
      </div>

      {filteredItems.length === 0 ? (
        <div className="card">
          <EmptyState icon={<Inbox className="w-7 h-7" />} title="Inbox zero!" description="No items match your filter. You're all caught up." />
        </div>
      ) : (
        <div className="space-y-2">
          {filteredItems.map((item) => {
            const Icon = item.type === 'ticket' ? TicketIcon : MessageSquare;
            const isOpen = item.status === 'open' || item.status === 'pending' || item.status === 'active' || item.status === 'waiting';
            const timeAgo = getTimeAgo(item.created_at);
            return (
              <div key={`${item.type}-${item.id}`} role="button" tabIndex={0} onClick={() => navigate(item.type === 'ticket' ? `/tickets/${item.id}` : `/chat/${item.id}`)} className={`card p-4 card-hover cursor-pointer ${!isOpen ? 'opacity-60' : ''}`}>
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${
                    item.type === 'ticket' ? 'bg-primary-50 text-primary-600' : 'bg-accent-50 text-accent-600'
                  }`}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <p className="text-sm font-semibold text-neutral-800 truncate">{item.subject}</p>
                      {item.priority && <PriorityBadge priority={item.priority} />}
                    </div>
                    <p className="text-xs text-neutral-400 truncate">
                      {item.customer_name} · {item.customer_email} · {timeAgo}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <StatusBadge status={item.status} />
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${item.type === 'ticket' ? 'bg-primary-50 text-primary-600' : 'bg-accent-50 text-accent-600'}`}>
                      {item.type}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
          {paginatedTickets.status === 'CanLoadMore' && (
            <button className="btn-secondary w-full" onClick={() => paginatedTickets.loadMore(20)}>Load more tickets</button>
          )}
        </div>
      )}
    </div>
  );
}

function getTimeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  return `${Math.floor(hr / 24)}d ago`;
}
