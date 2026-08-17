import { useEffect, useState } from 'react';
import { ShieldCheck, Plus, Clock, CheckCircle2, AlertCircle, FileText, Lock, Zap } from 'lucide-react';
import type { GdprRequest, Tenant, AuditLogEntry } from '@/types';
import { StatusBadge } from '@/components/Badges';
import { Modal } from '@/components/Modal';
import { LoadingSpinner, EmptyState, ErrorState } from '@/components/States';
import { useToast } from '@/components/Toast';
import { useMutation, useQuery } from 'convex/react';
import { api } from '../../convex/_generated/api';
import type { Id } from '../../convex/_generated/dataModel';

export function GdprPage({ tenant, tenants }: { tenant: Tenant | null; tenants: Tenant[] }) {
  const { toast } = useToast();
  const requestRows = useQuery(
    api.gdpr.list,
    tenant ? { tenantId: tenant.id as Id<'tenants'> } : 'skip',
  );
  const requests = (requestRows ?? []) as GdprRequest[];
  const auditLog = (useQuery(
    api.gdpr.audit,
    tenant ? { tenantId: tenant.id as Id<'tenants'> } : 'skip',
  ) ?? []) as AuditLogEntry[];
  const executeMut = useMutation(api.gdpr.execute);
  const [showCreate, setShowCreate] = useState(false);
  const loading = Boolean(tenant) && requestRows === undefined;
  const error = null;

  if (loading) return <div className="flex items-center justify-center py-24"><LoadingSpinner size={32} /></div>;
  if (error) return <ErrorState message={error} />;

  const processing = requests.filter((r) => r.status === 'processing');
  const completed = requests.filter((r) => r.status === 'completed');
  const avgCompletionTime = completed.length > 0
    ? completed.reduce((sum, r) => {
        if (r.completed_at) return sum + (new Date(r.completed_at).getTime() - new Date(r.created_at).getTime());
        return sum;
      }, 0) / completed.length / 60000
    : 0;

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900">GDPR Compliance</h1>
          <p className="text-sm text-neutral-500 mt-1">Data erasure requests and compliance audit trail · {tenant ? tenant.name : 'All tenants'}</p>
        </div>
        <button onClick={() => setShowCreate(true)} className="btn-primary">
          <Plus className="w-4 h-4" />
          New Erasure Request
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="stat-card">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-warning-50 flex items-center justify-center"><Clock className="w-5 h-5 text-warning-600" /></div>
            <div><p className="text-2xl font-bold text-neutral-900">{processing.length}</p><p className="text-sm text-neutral-500">Processing</p></div>
          </div>
        </div>
        <div className="stat-card">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-success-50 flex items-center justify-center"><CheckCircle2 className="w-5 h-5 text-success-600" /></div>
            <div><p className="text-2xl font-bold text-neutral-900">{completed.length}</p><p className="text-sm text-neutral-500">Completed</p></div>
          </div>
        </div>
        <div className="stat-card">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-accent-50 flex items-center justify-center"><Zap className="w-5 h-5 text-accent-600" /></div>
            <div><p className="text-2xl font-bold text-neutral-900">{avgCompletionTime.toFixed(1)}m</p><p className="text-sm text-neutral-500">Avg Completion Time</p></div>
          </div>
        </div>
      </div>

      {/* Info banner */}
      <div className="card p-5 bg-gradient-to-r from-primary-50/50 to-accent-50/50 border-primary-100">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center flex-shrink-0 shadow-sm">
            <Lock className="w-5 h-5 text-primary-600" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-neutral-800">Customer data erasure</h3>
            <p className="text-sm text-neutral-500 mt-1">
              Submitting a request records the job. Completing it permanently deletes matching tickets, chats, follow-ups, and customer profiles for that email in this tenant. This does not shred backups or encryption keys outside this database.
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Requests table */}
        <div className="lg:col-span-2 card overflow-hidden">
          <div className="px-5 py-4 border-b border-neutral-100">
            <h3 className="text-sm font-semibold text-neutral-800">Erasure Requests</h3>
          </div>
          {requests.length === 0 ? (
            <EmptyState icon={<ShieldCheck className="w-7 h-7" />} title="No erasure requests" description="GDPR erasure requests will appear here when submitted." />
          ) : (
            <div className="overflow-x-auto scrollbar-thin">
              <table className="w-full">
                <thead className="bg-neutral-50/50 border-b border-neutral-100">
                  <tr>
                    <th className="table-header px-5 py-3">User</th>
                    <th className="table-header px-4 py-3">Reason</th>
                    <th className="table-header px-4 py-3">Status</th>
                    <th className="table-header px-4 py-3 hidden sm:table-cell">Created</th>
                    <th className="table-header px-4 py-3 hidden lg:table-cell">Tenant</th>
                    <th className="table-header px-4 py-3">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-50">
                  {requests.map((req) => {
                    const tenantInfo = tenants.find((t) => t.id === req.tenant_id);
                    return (
                      <tr key={req.id} className="hover:bg-neutral-50/50 transition-colors">
                        <td className="px-5 py-3.5">
                          <p className="text-sm font-medium text-neutral-800">{req.user_email}</p>
                          <p className="text-xs text-neutral-400">{req.external_user_id}</p>
                        </td>
                        <td className="px-4 py-3.5 max-w-xs">
                          <p className="text-sm text-neutral-600 truncate">{req.reason}</p>
                        </td>
                        <td className="px-4 py-3.5"><StatusBadge status={req.status} /></td>
                        <td className="px-4 py-3.5 hidden sm:table-cell">
                          <span className="text-sm text-neutral-500">{new Date(req.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                        </td>
                        <td className="px-4 py-3.5 hidden lg:table-cell">
                          <span className="text-sm text-neutral-500">{tenantInfo?.name ?? '—'}</span>
                        </td>
                        <td className="px-4 py-3.5">
                          {req.status === 'processing' && (
                            <button className="btn-danger py-1.5 px-2.5 text-xs" onClick={async () => {
                              if (!tenant) return;
                              try {
                                await executeMut({ tenantId: tenant.id as Id<'tenants'>, requestId: req.id as Id<'gdprRequests'> });
                                toast('Customer data purged', 'success');
                              } catch (err) {
                                toast(err instanceof Error ? err.message : 'Erasure failed', 'error');
                              }
                            }}>Run erasure</button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Audit trail */}
        <div className="card p-5">
          <div className="flex items-center gap-2 mb-4">
            <FileText className="w-4 h-4 text-neutral-400" />
            <h3 className="text-sm font-semibold text-neutral-800">Compliance Audit Trail</h3>
          </div>
          <div className="space-y-1 max-h-96 overflow-y-auto scrollbar-thin">
            {auditLog.length === 0 ? (
              <p className="text-sm text-neutral-400 text-center py-6">No audit entries</p>
            ) : (
              auditLog.map((entry) => {
                const tenantInfo = tenants.find((t) => t.id === entry.tenant_id);
                return (
                  <div key={entry.id} className="flex items-start gap-3 py-2.5 px-2 rounded-lg hover:bg-neutral-50 transition-colors">
                    <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${
                      entry.action.includes('completed') ? 'bg-success-50 text-success-600' :
                      entry.action.includes('request') ? 'bg-warning-50 text-warning-600' :
                      'bg-neutral-100 text-neutral-400'
                    }`}>
                      {entry.action.includes('completed') ? <CheckCircle2 className="w-3.5 h-3.5" /> :
                       entry.action.includes('request') ? <AlertCircle className="w-3.5 h-3.5" /> :
                       <FileText className="w-3.5 h-3.5" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-neutral-700">{entry.details}</p>
                      <p className="text-xs text-neutral-400 mt-0.5">
                        {new Date(entry.created_at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        {tenantInfo && !tenant && <span> · {tenantInfo.name}</span>}
                      </p>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      <CreateGdprModal
        open={showCreate}
        onClose={() => setShowCreate(false)}
        tenants={tenants}
        lockedTenantId={tenant?.id ?? null}
        onCreated={() => { setShowCreate(false); }}
      />
    </div>
  );
}

function CreateGdprModal({
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
    user_email: '',
    external_user_id: '',
    reason: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();
  const createMut = useMutation(api.gdpr.create);

  useEffect(() => {
    if (lockedTenantId) setForm((f) => ({ ...f, tenant_id: lockedTenantId }));
  }, [lockedTenantId]);

  const handleSubmit = async () => {
    if (!form.user_email || !form.reason || !form.tenant_id) {
      setError('All fields are required');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await createMut({
        tenantId: form.tenant_id as Id<'tenants'>,
        email: form.user_email,
        reason: form.reason,
      });
      toast('Erasure request created', 'success');
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create request');
    }
    setSubmitting(false);
  };

  return (
    <Modal open={open} onClose={onClose} title="Submit GDPR Erasure Request" size="md">
      <div className="space-y-4">
        <div className="flex items-start gap-3 p-3 rounded-lg bg-warning-50 border border-warning-100">
          <AlertCircle className="w-5 h-5 text-warning-600 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-warning-700">
            This permanently deletes tickets, chat transcripts, follow-ups, and the customer profile for this email in the selected tenant.
          </p>
        </div>
        {error && <div className="px-4 py-3 rounded-lg bg-danger-50 text-danger-700 text-sm">{error}</div>}
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
          <label className="text-sm font-medium text-neutral-700 mb-1.5 block">User Email *</label>
          <input type="email" value={form.user_email} onChange={(e) => setForm({ ...form, user_email: e.target.value })} className="input" placeholder="user@example.com" />
        </div>
        <div>
          <label className="text-sm font-medium text-neutral-700 mb-1.5 block">External User ID *</label>
          <input type="text" value={form.external_user_id} onChange={(e) => setForm({ ...form, external_user_id: e.target.value })} className="input" placeholder="usr_12345" />
        </div>
        <div>
          <label className="text-sm font-medium text-neutral-700 mb-1.5 block">Reason *</label>
          <textarea value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} rows={3} className="input resize-none" placeholder="Right to be forgotten request #..." />
        </div>
        <div className="flex justify-end gap-3 pt-2">
          <button onClick={onClose} className="btn-secondary">Cancel</button>
          <button onClick={handleSubmit} disabled={submitting} className="btn-danger">
            {submitting ? <LoadingSpinner size={16} /> : <ShieldCheck className="w-4 h-4" />}
            Submit Erasure
          </button>
        </div>
      </div>
    </Modal>
  );
}
