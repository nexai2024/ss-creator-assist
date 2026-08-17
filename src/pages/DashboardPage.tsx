import { useMemo, useState } from 'react';
import {
  Ticket as TicketIcon, MessageSquare, BookOpen, ShieldCheck,
  TrendingUp, TrendingDown, Clock, CheckCircle2, Users, Activity, Zap, X,
  Heart, AlarmClock, DollarSign, Sparkles, Gauge,
} from 'lucide-react';
import type { Ticket, ChatConversation, KbArticle, GdprRequest, AuditLogEntry, Tenant } from '@/types';
import { LoadingSpinner, ErrorState } from '@/components/States';
import { PriorityBadge, StatusBadge, PlanBadge } from '@/components/Badges';
import { useFollowUps, useTimeEntries, useBusinessHours } from '@/hooks/useSolopreneur';
import { useQuery } from 'convex/react';
import { api } from '../../convex/_generated/api';
import type { Id } from '../../convex/_generated/dataModel';

type Stats = {
  tickets: Ticket[];
  chatConversations: ChatConversation[];
  kbArticles: KbArticle[];
  gdprRequests: GdprRequest[];
  auditLog: AuditLogEntry[];
};

type DrillDownType =
  | { kind: 'open-tickets' }
  | { kind: 'active-chats' }
  | { kind: 'deflection' }
  | { kind: 'gdpr' }
  | { kind: 'csat' }
  | { kind: 'kb-views' }
  | { kind: 'priority'; priority: Ticket['priority'] }
  | { kind: 'status'; status: Ticket['status'] }
  | { kind: 'published-articles' }
  | null;

export function DashboardPage({ tenant, tenants }: { tenant: Tenant | null; tenants: Tenant[] }) {
  const snapshot = useQuery(
    api.dashboard.snapshot,
    tenant ? { tenantId: tenant.id as Id<'tenants'> } : 'skip',
  );
  const [drillDown, setDrillDown] = useState<DrillDownType>(null);
  const { followUps, overdue } = useFollowUps(tenant?.id ?? null);
  const { totalMinutes } = useTimeEntries(tenant?.id ?? null);
  const { isCurrentlyOpen } = useBusinessHours(tenant?.id ?? null);

  const stats: Stats | null = snapshot
    ? {
        tickets: snapshot.tickets as Ticket[],
        chatConversations: snapshot.chatConversations as ChatConversation[],
        kbArticles: snapshot.kbArticles as KbArticle[],
        gdprRequests: snapshot.gdprRequests as GdprRequest[],
        auditLog: snapshot.auditLog as AuditLogEntry[],
      }
    : tenant
      ? null
      : { tickets: [], chatConversations: [], kbArticles: [], gdprRequests: [], auditLog: [] };
  const loading = tenant ? snapshot === undefined : false;
  const error = null;

  const metrics = useMemo(() => {
    if (!stats) return null;
    const openTickets = stats.tickets.filter((t) => t.status === 'open' || t.status === 'pending');
    const resolvedTickets = stats.tickets.filter((t) => t.status === 'resolved');
    const activeChats = stats.chatConversations.filter((c) => c.status === 'active' || c.status === 'waiting');
    const waitingChats = stats.chatConversations.filter((c) => c.status === 'waiting');
    const publishedArticles = stats.kbArticles.filter((a) => a.status === 'published');
    const totalViews = stats.kbArticles.reduce((sum, a) => sum + a.views, 0);
    const processingGdpr = stats.gdprRequests.filter((g) => g.status === 'processing');
    const completedGdpr = stats.gdprRequests.filter((g) => g.status === 'completed');
    const csatScores = stats.tickets.filter((t) => t.csat_score !== null).map((t) => t.csat_score!);
    const avgCsat = csatScores.length > 0 ? (csatScores.reduce((a, b) => a + b, 0) / csatScores.length) : 0;
    const deflectionRate = stats.tickets.length > 0 ? (stats.tickets.filter((t) => t.deflection_suggested).length / stats.tickets.length) * 100 : 0;
    return {
      openTickets: openTickets.length, resolvedTickets: resolvedTickets.length, totalTickets: stats.tickets.length,
      activeChats: activeChats.length, waitingChats: waitingChats.length,
      publishedArticles: publishedArticles.length, totalViews,
      processingGdpr: processingGdpr.length, completedGdpr: completedGdpr.length,
      avgCsat, deflectionRate,
    };
  }, [stats]);

  if (loading) return <div className="flex items-center justify-center py-24"><LoadingSpinner size={32} /></div>;
  if (error) return <ErrorState message={error} />;
  if (!metrics || !stats) return null;

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-neutral-900">Dashboard Overview</h1>
        <p className="text-sm text-neutral-500 mt-1">{tenant ? `Performance metrics for ${tenant.name}` : 'Aggregated metrics across all tenants'}</p>
      </div>

      {/* Stat cards — clickable */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={TicketIcon} label="Open Tickets" value={metrics.openTickets} sublabel={`${metrics.resolvedTickets} resolved`}
          trend={metrics.openTickets > 5 ? 'up' : 'down'} trendLabel="needs attention" color="primary"
          onClick={() => setDrillDown({ kind: 'open-tickets' })} />
        <StatCard icon={MessageSquare} label="Active Chats" value={metrics.activeChats} sublabel={`${metrics.waitingChats} waiting for agent`}
          trend={metrics.waitingChats > 0 ? 'up' : 'down'} trendLabel={metrics.waitingChats > 0 ? 'queue building' : 'all handled'} color="accent"
          onClick={() => setDrillDown({ kind: 'active-chats' })} />
        <StatCard icon={Zap} label="AI Deflection Rate" value={`${metrics.deflectionRate.toFixed(0)}%`} sublabel="Target: 35%"
          trend={metrics.deflectionRate >= 35 ? 'down' : 'up'} trendLabel={metrics.deflectionRate >= 35 ? 'on target' : 'below target'} color="success"
          onClick={() => setDrillDown({ kind: 'deflection' })} />
        <StatCard icon={ShieldCheck} label="GDPR Processing" value={metrics.processingGdpr} sublabel={`${metrics.completedGdpr} completed`}
          trend={metrics.processingGdpr > 0 ? 'up' : 'down'} trendLabel={metrics.processingGdpr > 0 ? 'in progress' : 'all clear'} color="warning"
          onClick={() => setDrillDown({ kind: 'gdpr' })} />
      </div>

      {/* Mini stats — clickable */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MiniStat icon={CheckCircle2} label="Avg CSAT Score" value={`${metrics.avgCsat.toFixed(1)}/5`} color="success"
          onClick={() => setDrillDown({ kind: 'csat' })} />
        <MiniStat icon={BookOpen} label="Published Articles" value={metrics.publishedArticles} color="primary"
          onClick={() => setDrillDown({ kind: 'published-articles' })} />
        <MiniStat icon={Activity} label="Total KB Views" value={metrics.totalViews.toLocaleString()} color="accent"
          onClick={() => setDrillDown({ kind: 'kb-views' })} />
        <MiniStat icon={Users} label="Active Tenants" value={tenants.filter((t) => t.status === 'active').length} color="warning" />
      </div>

      {/* Solopreneur widgets: workload health, follow-ups, AI savings */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Workload health gauge */}
        <div className="card p-5">
          <div className="flex items-center gap-2 mb-4">
            <Gauge className="w-4 h-4 text-primary-500" />
            <h3 className="text-sm font-semibold text-neutral-800">Workload Health</h3>
          </div>
          <WorkloadGauge openCount={metrics.openTickets + metrics.activeChats} overdueCount={overdue.length} isAvailable={isCurrentlyOpen()} />
        </div>

        {/* Follow-up reminders */}
        <div className="card p-5">
          <div className="flex items-center gap-2 mb-4">
            <AlarmClock className="w-4 h-4 text-warning-500" />
            <h3 className="text-sm font-semibold text-neutral-800">Follow-up Reminders</h3>
            {overdue.length > 0 && <span className="ml-auto px-2 py-0.5 rounded-full text-xs font-medium bg-danger-50 text-danger-600">{overdue.length} overdue</span>}
          </div>
          <div className="space-y-2 max-h-48 overflow-y-auto scrollbar-thin">
            {followUps.filter((f) => !f.completed).length === 0 ? (
              <div className="text-center py-6">
                <CheckCircle2 className="w-6 h-6 text-success-300 mx-auto mb-1" />
                <p className="text-sm text-neutral-400">No pending follow-ups</p>
              </div>
            ) : (
              followUps.filter((f) => !f.completed).slice(0, 5).map((f) => {
                const isOverdue = new Date(f.reminder_at) < new Date();
                return (
                  <div key={f.id} className={`flex items-center gap-2 p-2.5 rounded-lg ${isOverdue ? 'bg-danger-50' : 'bg-neutral-50'}`}>
                    <Clock className={`w-3.5 h-3.5 flex-shrink-0 ${isOverdue ? 'text-danger-500' : 'text-neutral-400'}`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-neutral-700 truncate">{f.customer_name ?? f.customer_email}</p>
                      <p className="text-xs text-neutral-400 truncate">{f.note ?? 'No note'}</p>
                    </div>
                    <span className={`text-xs flex-shrink-0 ${isOverdue ? 'text-danger-500 font-medium' : 'text-neutral-400'}`}>
                      {new Date(f.reminder_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </span>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* AI savings + time tracking */}
        <div className="card p-5">
          <div className="flex items-center gap-2 mb-4">
            <Sparkles className="w-4 h-4 text-violet-500" />
            <h3 className="text-sm font-semibold text-neutral-800">AI & Time Savings</h3>
          </div>
          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 rounded-lg bg-violet-50/30">
              <div className="flex items-center gap-2">
                <Zap className="w-4 h-4 text-violet-400" />
                <span className="text-sm text-neutral-600">AI Deflections</span>
              </div>
              <span className="text-sm font-bold text-violet-600">{stats.tickets.filter((t) => t.deflection_suggested).length} tickets</span>
            </div>
            <div className="flex items-center justify-between p-3 rounded-lg bg-success-50/30">
              <div className="flex items-center gap-2">
                <DollarSign className="w-4 h-4 text-success-400" />
                <span className="text-sm text-neutral-600">Est. Time Saved</span>
              </div>
              <span className="text-sm font-bold text-success-600">{Math.round(stats.tickets.filter((t) => t.deflection_suggested).length * 0.25 * 60)} min</span>
            </div>
            <div className="flex items-center justify-between p-3 rounded-lg bg-primary-50/30">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-primary-400" />
                <span className="text-sm text-neutral-600">Time Tracked</span>
              </div>
              <span className="text-sm font-bold text-primary-600">{Math.floor(totalMinutes / 60)}h {totalMinutes % 60}m</span>
            </div>
            <div className="flex items-center justify-between p-3 rounded-lg bg-neutral-50">
              <div className="flex items-center gap-2">
                <Heart className="w-4 h-4 text-rose-400" />
                <span className="text-sm text-neutral-600">CSAT Score</span>
              </div>
              <span className="text-sm font-bold text-rose-500">{metrics.avgCsat.toFixed(1)}/5</span>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Priority distribution — clickable bars */}
        <div className="card p-5 lg:col-span-2">
          <div className="flex items-center justify-between mb-5">
            <h3 className="text-sm font-semibold text-neutral-800">Ticket Priority Distribution</h3>
            <span className="text-xs text-neutral-400">{metrics.totalTickets} total tickets</span>
          </div>
          <PriorityChart tickets={stats.tickets} onBarClick={(p) => setDrillDown({ kind: 'priority', priority: p })} />
        </div>

        {/* Status breakdown — clickable */}
        <div className="card p-5">
          <h3 className="text-sm font-semibold text-neutral-800 mb-4">Ticket Status Breakdown</h3>
          <div className="space-y-2.5">
            {(['open', 'pending', 'resolved', 'closed'] as const).map((s) => {
              const count = stats.tickets.filter((t) => t.status === s).length;
              const pct = stats.tickets.length > 0 ? (count / stats.tickets.length) * 100 : 0;
              return (
                <button key={s} onClick={() => setDrillDown({ kind: 'status', status: s })}
                  className="w-full text-left p-3 rounded-lg bg-neutral-50 hover:bg-neutral-100 transition-colors group">
                  <div className="flex items-center justify-between mb-1.5">
                    <StatusBadge status={s} />
                    <span className="text-sm font-semibold text-neutral-700 group-hover:text-primary-600">{count}</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-neutral-200 overflow-hidden">
                    <div className="h-full rounded-full bg-primary-400 transition-all duration-500" style={{ width: `${pct}%` }} />
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Tenant info or plans */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {tenant ? (
          <div className="card p-5 lg:col-span-1">
            <h3 className="text-sm font-semibold text-neutral-800 mb-4">Tenant Info</h3>
            <div className="space-y-3">
              <InfoRow label="Plan" value={<PlanBadge plan={tenant.plan_tier} />} />
              <InfoRow label="Status" value={<StatusBadge status={tenant.status} />} />
              <InfoRow label="Monthly Active Users" value={`${tenant.monthly_active_users.toLocaleString()}`} />
              <InfoRow label="Included MAUs" value={`${tenant.included_maus.toLocaleString()}`} />
              <InfoRow label="Overage Rate" value={`$${tenant.overage_rate}/MAU`} />
              <InfoRow label="SLA Uptime" value={tenant.sla_uptime} />
            </div>
            <div className="mt-5 pt-4 border-t border-neutral-100">
              <div className="flex items-center justify-between text-xs mb-2">
                <span className="text-neutral-500">MAU Usage</span>
                <span className="font-semibold text-neutral-700">{((tenant.monthly_active_users / tenant.included_maus) * 100).toFixed(0)}%</span>
              </div>
              <div className="h-2 rounded-full bg-neutral-100 overflow-hidden">
                <div className={`h-full rounded-full transition-all duration-500 ${tenant.monthly_active_users / tenant.included_maus > 0.9 ? 'bg-danger-500' : tenant.monthly_active_users / tenant.included_maus > 0.7 ? 'bg-warning-500' : 'bg-success-500'}`}
                  style={{ width: `${Math.min(100, (tenant.monthly_active_users / tenant.included_maus) * 100)}%` }} />
              </div>
            </div>
          </div>
        ) : (
          <div className="card p-5 lg:col-span-1">
            <h3 className="text-sm font-semibold text-neutral-800 mb-4">Tenant Plans</h3>
            <div className="space-y-3">
              {['enterprise', 'growth', 'starter'].map((plan) => {
                const count = tenants.filter((t) => t.plan_tier === plan).length;
                const totalMaus = tenants.filter((t) => t.plan_tier === plan).reduce((sum, t) => sum + t.monthly_active_users, 0);
                return (
                  <div key={plan} className="flex items-center justify-between p-3 rounded-lg bg-neutral-50">
                    <div className="flex items-center gap-3">
                      <PlanBadge plan={plan} />
                      <span className="text-sm text-neutral-600">{count} {count === 1 ? 'tenant' : 'tenants'}</span>
                    </div>
                    <span className="text-sm font-semibold text-neutral-700">{totalMaus.toLocaleString()} MAUs</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Recent activity */}
        <div className="card p-5 lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-neutral-800">Recent Activity</h3>
            <Activity className="w-4 h-4 text-neutral-400" />
          </div>
          <div className="space-y-1 max-h-80 overflow-y-auto scrollbar-thin">
            {stats.auditLog.length === 0 ? (
              <p className="text-sm text-neutral-400 text-center py-6">No recent activity</p>
            ) : (
              stats.auditLog.map((entry) => {
                const tenantInfo = tenants.find((t) => t.id === entry.tenant_id);
                return (
                  <div key={entry.id} className="flex items-start gap-3 py-2.5 px-2 rounded-lg hover:bg-neutral-50 transition-colors">
                    <div className="w-8 h-8 rounded-lg bg-neutral-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <ActivityIcon action={entry.action} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-neutral-700">
                        <span className="font-medium">{formatAction(entry.action)}</span>
                        {tenantInfo && <span className="text-neutral-400"> · {tenantInfo.name}</span>}
                      </p>
                      {entry.details && <p className="text-xs text-neutral-400 mt-0.5">{entry.details}</p>}
                    </div>
                    <span className="text-xs text-neutral-400 flex-shrink-0 mt-1">{formatTime(entry.created_at)}</span>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* Drill-down modal */}
      {drillDown && stats && (
        <DrillDownModal drillDown={drillDown} stats={stats} tenants={tenants} onClose={() => setDrillDown(null)} />
      )}
    </div>
  );
}

function StatCard({ icon: Icon, label, value, sublabel, trend, trendLabel, color, onClick }: {
  icon: typeof TicketIcon; label: string; value: string | number; sublabel: string;
  trend: 'up' | 'down'; trendLabel: string; color: 'primary' | 'accent' | 'success' | 'warning'; onClick?: () => void;
}) {
  const colorClasses = { primary: 'bg-primary-50 text-primary-600', accent: 'bg-accent-50 text-accent-600', success: 'bg-success-50 text-success-600', warning: 'bg-warning-50 text-warning-600' };
  return (
    <button onClick={onClick} className="stat-card card-hover text-left w-full cursor-pointer transition-transform hover:scale-[1.02]">
      <div className="flex items-start justify-between mb-3">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${colorClasses[color]}`}><Icon className="w-5 h-5" /></div>
        <div className={`flex items-center gap-1 text-xs font-medium ${trend === 'up' ? 'text-danger-500' : 'text-success-500'}`}>
          {trend === 'up' ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}{trendLabel}
        </div>
      </div>
      <p className="text-2xl font-bold text-neutral-900">{value}</p>
      <p className="text-sm font-medium text-neutral-600 mt-1">{label}</p>
      <p className="text-xs text-neutral-400 mt-0.5">{sublabel}</p>
    </button>
  );
}

function MiniStat({ icon: Icon, label, value, color, onClick }: {
  icon: typeof TicketIcon; label: string; value: string | number; color: 'primary' | 'accent' | 'success' | 'warning'; onClick?: () => void;
}) {
  const colorClasses = { primary: 'text-primary-500', accent: 'text-accent-500', success: 'text-success-500', warning: 'text-warning-500' };
  return (
    <button onClick={onClick} disabled={!onClick} className={`card p-4 flex items-center gap-3 w-full text-left ${onClick ? 'card-hover cursor-pointer' : 'cursor-default'}`}>
      <Icon className={`w-5 h-5 ${colorClasses[color]}`} />
      <div>
        <p className="text-lg font-bold text-neutral-900 leading-tight">{value}</p>
        <p className="text-xs text-neutral-400">{label}</p>
      </div>
    </button>
  );
}

function PriorityChart({ tickets, onBarClick }: { tickets: Ticket[]; onBarClick: (p: Ticket['priority']) => void }) {
  const priorities = ['urgent', 'high', 'medium', 'low'] as const;
  const colors = ['bg-danger-500', 'bg-warning-500', 'bg-primary-500', 'bg-neutral-300'];
  const counts = priorities.map((p) => tickets.filter((t) => t.priority === p).length);
  const max = Math.max(...counts, 1);
  return (
    <div className="space-y-4">
      {priorities.map((p, i) => (
        <div key={p}>
          <button onClick={() => onBarClick(p)} className="w-full text-left group">
            <div className="flex items-center justify-between text-sm mb-1.5">
              <PriorityBadge priority={p} />
              <span className="font-semibold text-neutral-700 group-hover:text-primary-600 transition-colors">{counts[i]}</span>
            </div>
            <div className="h-2.5 rounded-full bg-neutral-100 overflow-hidden cursor-pointer">
              <div className={`h-full rounded-full ${colors[i]} transition-all duration-700 ease-out group-hover:brightness-110`} style={{ width: `${(counts[i] / max) * 100}%` }} />
            </div>
          </button>
        </div>
      ))}
    </div>
  );
}

function DrillDownModal({ drillDown, stats, onClose }: {
  drillDown: NonNullable<DrillDownType>; stats: Stats; tenants: Tenant[]; onClose: () => void;
}) {
  const { kind } = drillDown;
  let title = '';
  let items: { id: string; primary: string; secondary: string; badge?: React.ReactNode; meta?: string }[] = [];

  if (kind === 'open-tickets') {
    title = 'Open & Pending Tickets';
    items = stats.tickets.filter((t) => t.status === 'open' || t.status === 'pending').map((t) => ({
      id: t.id, primary: t.subject, secondary: `${t.customer_name} · ${t.category}`,
      badge: <PriorityBadge priority={t.priority} />, meta: new Date(t.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    }));
  } else if (kind === 'active-chats') {
    title = 'Active & Waiting Chats';
    items = stats.chatConversations.filter((c) => c.status === 'active' || c.status === 'waiting').map((c) => ({
      id: c.id, primary: c.customer_name, secondary: c.customer_email,
      badge: <StatusBadge status={c.status} />, meta: new Date(c.created_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
    }));
  } else if (kind === 'deflection') {
    title = 'AI Deflection Suggested Tickets';
    items = stats.tickets.filter((t) => t.deflection_suggested).map((t) => ({
      id: t.id, primary: t.subject, secondary: `${t.customer_name} · ${t.category}`,
      badge: <StatusBadge status={t.status} />, meta: new Date(t.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    }));
  } else if (kind === 'gdpr') {
    title = 'GDPR Requests in Processing';
    items = stats.gdprRequests.filter((g) => g.status === 'processing').map((g) => ({
      id: g.id, primary: g.user_email, secondary: g.reason || 'No reason provided',
      badge: <StatusBadge status={g.status} />, meta: new Date(g.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    }));
  } else if (kind === 'csat') {
    title = 'Tickets with CSAT Scores';
    items = stats.tickets.filter((t) => t.csat_score !== null).map((t) => ({
      id: t.id, primary: t.subject, secondary: `${t.customer_name} · ${t.category}`,
      badge: <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-amber-50 text-amber-600">{t.csat_score}/5</span>,
      meta: new Date(t.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    }));
  } else if (kind === 'kb-views') {
    title = 'Knowledge Base Articles by Views';
    items = [...stats.kbArticles].sort((a, b) => b.views - a.views).map((a) => ({
      id: a.id, primary: a.title, secondary: a.content.slice(0, 80) + '...',
      badge: <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-primary-50 text-primary-600">{a.views} views</span>,
      meta: a.status === 'published' ? 'Published' : 'Draft',
    }));
  } else if (kind === 'published-articles') {
    title = 'Published Knowledge Base Articles';
    items = stats.kbArticles.filter((a) => a.status === 'published').map((a) => ({
      id: a.id, primary: a.title, secondary: a.content.slice(0, 80) + '...',
      badge: <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-success-50 text-success-600">{a.helpful_votes} helpful</span>,
      meta: `${a.views} views`,
    }));
  } else if (kind === 'priority') {
    title = `${drillDown.priority.charAt(0).toUpperCase() + drillDown.priority.slice(1)} Priority Tickets`;
    items = stats.tickets.filter((t) => t.priority === drillDown.priority).map((t) => ({
      id: t.id, primary: t.subject, secondary: `${t.customer_name} · ${t.category}`,
      badge: <StatusBadge status={t.status} />, meta: new Date(t.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    }));
  } else if (kind === 'status') {
    title = `${drillDown.status.charAt(0).toUpperCase() + drillDown.status.slice(1)} Tickets`;
    items = stats.tickets.filter((t) => t.status === drillDown.status).map((t) => ({
      id: t.id, primary: t.subject, secondary: `${t.customer_name} · ${t.category}`,
      badge: <PriorityBadge priority={t.priority} />, meta: new Date(t.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    }));
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fade-in">
      <div className="absolute inset-0 bg-neutral-900/40 backdrop-blur-sm" onClick={onClose} />
      <div role="dialog" aria-modal="true" className="relative max-w-2xl w-full bg-white rounded-2xl shadow-2xl border border-neutral-200 max-h-[85vh] flex flex-col animate-slide-up">
        <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-100">
          <h2 className="text-lg font-semibold text-neutral-900">{title}</h2>
          <div className="flex items-center gap-2">
            <span className="text-sm text-neutral-400">{items.length} {items.length === 1 ? 'item' : 'items'}</span>
            <button onClick={onClose} aria-label="Close" className="p-1.5 rounded-lg text-neutral-400 hover:bg-neutral-100"><X className="w-5 h-5" /></button>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto scrollbar-thin px-6 py-4">
          {items.length === 0 ? (
            <div className="text-center py-12">
              <CheckCircle2 className="w-8 h-8 text-neutral-300 mx-auto mb-2" />
              <p className="text-sm text-neutral-400">No items to show</p>
            </div>
          ) : (
            <div className="space-y-1">
              {items.map((item) => (
                <div key={item.id} className="flex items-center gap-3 py-3 px-3 rounded-lg hover:bg-neutral-50 transition-colors">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-neutral-800 truncate">{item.primary}</p>
                    <p className="text-xs text-neutral-400 truncate">{item.secondary}</p>
                  </div>
                  {item.badge && <div className="flex-shrink-0">{item.badge}</div>}
                  {item.meta && <span className="text-xs text-neutral-400 flex-shrink-0">{item.meta}</span>}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm text-neutral-500">{label}</span>
      <span className="text-sm font-medium text-neutral-800">{value}</span>
    </div>
  );
}

function WorkloadGauge({ openCount, overdueCount, isAvailable }: { openCount: number; overdueCount: number; isAvailable: boolean }) {
  const maxLoad = 15;
  const loadPct = Math.min(100, (openCount / maxLoad) * 100);
  const status = !isAvailable ? 'away' : overdueCount > 0 ? 'overloaded' : openCount > 10 ? 'busy' : openCount > 5 ? 'moderate' : 'clear';
  const statusConfig = {
    away: { color: 'text-neutral-500', bg: 'bg-neutral-400', label: 'Away', desc: 'Outside business hours' },
    overloaded: { color: 'text-danger-600', bg: 'bg-danger-500', label: 'Overloaded', desc: `${overdueCount} overdue follow-ups` },
    busy: { color: 'text-warning-600', bg: 'bg-warning-500', label: 'Busy', desc: `${openCount} open items` },
    moderate: { color: 'text-primary-600', bg: 'bg-primary-500', label: 'Moderate', desc: `${openCount} open items` },
    clear: { color: 'text-success-600', bg: 'bg-success-500', label: 'All Clear', desc: 'Light workload' },
  };
  const cfg = statusConfig[status as keyof typeof statusConfig];
  return (
    <div className="flex flex-col items-center">
      <div className="relative w-32 h-32 mb-3">
        <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
          <circle cx="50" cy="50" r="42" fill="none" stroke="#f1f5f9" strokeWidth="8" />
          <circle cx="50" cy="50" r="42" fill="none" strokeWidth="8" strokeLinecap="round"
            className={cfg.bg} strokeDasharray={`${loadPct * 2.64} 264`} style={{ transition: 'stroke-dasharray 0.7s ease-out' }} />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <p className="text-2xl font-bold text-neutral-800">{openCount}</p>
          <p className="text-xs text-neutral-400">open items</p>
        </div>
      </div>
      <div className="text-center">
        <p className={`text-sm font-semibold ${cfg.color}`}>{cfg.label}</p>
        <p className="text-xs text-neutral-400 mt-0.5">{cfg.desc}</p>
      </div>
    </div>
  );
}

function ActivityIcon({ action }: { action: string }) {
  if (action.includes('ticket')) return <TicketIcon className="w-4 h-4 text-primary-500" />;
  if (action.includes('chat')) return <MessageSquare className="w-4 h-4 text-accent-500" />;
  if (action.includes('gdpr')) return <ShieldCheck className="w-4 h-4 text-warning-500" />;
  if (action.includes('kb')) return <BookOpen className="w-4 h-4 text-success-500" />;
  if (action.includes('deflection')) return <Zap className="w-4 h-4 text-violet-500" />;
  return <Activity className="w-4 h-4 text-neutral-400" />;
}

function formatAction(action: string): string {
  return action.split('_').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

function formatTime(iso: string): string {
  const date = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return 'just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}
