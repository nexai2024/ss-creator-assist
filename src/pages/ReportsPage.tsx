import { useMemo, useState } from 'react';
import { BarChart3, Download } from 'lucide-react';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import type { Tenant } from '@/types';
import { EmptyState } from '@/components/States';
import { useQuery } from 'convex/react';
import { api } from '../../convex/_generated/api';
import type { Id } from '../../convex/_generated/dataModel';

function csvEscape(value: string): string {
  if (/[",\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

export function ReportsPage({ tenant }: { tenant: Tenant | null }) {
  const [days, setDays] = useState(30);
  const now = Date.now();
  const rangeStart = now - days * 24 * 60 * 60_000;
  const report = useQuery(
    api.reports.summary,
    tenant ? { tenantId: tenant.id as Id<'tenants'>, now, rangeStart, rangeEnd: now } : 'skip',
  );

  const avgFirst = useMemo(() => {
    if (!report?.first_response_avg_ms) return '—';
    const hours = report.first_response_avg_ms / 3600000;
    return `${hours.toFixed(1)}h`;
  }, [report]);

  const volumeChartData = useMemo(() => {
    if (!report) return [];
    const map: Record<string, number> = {};
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(now - i * 24 * 3600_000);
      map[d.toISOString().split('T')[0]] = 0;
    }
    for (const row of report.rows) {
      const d = new Date(row.created_at).toISOString().split('T')[0];
      if (map[d] !== undefined) map[d]++;
    }
    return Object.entries(map).map(([date, count]) => ({ date, count }));
  }, [report, days, now]);

  const sourceChartData = useMemo(() => {
    if (!report) return [];
    return Object.entries(report.volume_by_source || {}).map(([name, value]) => ({ name, value }));
  }, [report]);

  if (!tenant) {
    return (
      <div className="animate-fade-in">
        <h1 className="text-2xl font-bold text-neutral-900 mb-2">Reports</h1>
        <div className="card">
          <EmptyState icon={<BarChart3 className="w-7 h-7" />} title="Select a workspace" description="Choose a workspace to export CSAT, first response, and volume." />
        </div>
      </div>
    );
  }

  const download = () => {
    if (!report) return;
    const header = ['id', 'subject', 'source', 'status', 'csat', 'first_response_ms', 'sla_breached', 'created_at'];
    const lines = [
      header.join(','),
      ...report.rows.map((row) => [
        row.id,
        csvEscape(row.subject),
        row.source,
        row.status,
        row.csat ?? '',
        row.first_response_ms ?? '',
        row.sla_breached ? 'yes' : 'no',
        new Date(row.created_at).toISOString(),
      ].join(',')),
    ];
    const blob = new Blob([lines.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `webwi-report-${days}d.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900">Reports</h1>
          <p className="text-sm text-neutral-500 mt-1">CSAT, first response, SLA breaches, and volume by channel.</p>
        </div>
        <div className="flex gap-2">
          <select className="input w-32" value={days} onChange={(e) => setDays(Number(e.target.value))}>
            <option value={7}>7 days</option>
            <option value={30}>30 days</option>
            <option value={90}>90 days</option>
          </select>
          <button className="btn-primary" onClick={download} disabled={!report}>
            <Download className="w-4 h-4" /> CSV
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Metric label="Volume" value={String(report?.volume ?? '—')} />
        <Metric label="CSAT" value={report?.csat_average ? report.csat_average.toFixed(2) : '—'} hint={`${report?.csat_count ?? 0} ratings`} />
        <Metric label="First response" value={avgFirst} />
        <Metric label="SLA breaches" value={String(report?.sla_breaches ?? '—')} hint={`${report?.open_sla_breaches ?? 0} still open`} />
      </div>

      <div className="card p-5">
        <h2 className="text-sm font-semibold text-neutral-800 mb-4">Volume Over Time</h2>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={volumeChartData}>
              <XAxis dataKey="date" fontSize={12} tickFormatter={(str) => str.slice(5)} />
              <YAxis fontSize={12} allowDecimals={false} />
              <Tooltip labelStyle={{color: '#333'}} />
              <Line type="monotone" dataKey="count" stroke="#3b82f6" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="card p-5">
        <h2 className="text-sm font-semibold text-neutral-800 mb-4">Volume by Source</h2>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={sourceChartData} layout="vertical" margin={{ left: 20 }}>
              <XAxis type="number" fontSize={12} allowDecimals={false} />
              <YAxis dataKey="name" type="category" fontSize={12} />
              <Tooltip />
              <Bar dataKey="value" fill="#8b5cf6" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}

function Metric({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="card p-4">
      <p className="text-xs text-neutral-400">{label}</p>
      <p className="text-2xl font-semibold text-neutral-900 mt-1">{value}</p>
      {hint ? <p className="text-xs text-neutral-400 mt-1">{hint}</p> : null}
    </div>
  );
}
