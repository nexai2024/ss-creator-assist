import { useState } from 'react';
import { Plus, Trash2, Zap, ToggleLeft, ToggleRight, ArrowRight } from 'lucide-react';
import type { Tenant, RoutingRule, Agent } from '@/types';
import { useRoutingRules } from '@/hooks/useRoutingRules';
import { useAgents } from '@/hooks/useAgents';
import { Modal } from '@/components/Modal';
import { LoadingSpinner, EmptyState, ErrorState, TableSkeleton } from '@/components/States';
import { useToast } from '@/components/Toast';

export function RoutingRulesPage({ tenant }: { tenant: Tenant | null }) {
  const { rules, loading, error, create, update, remove } = useRoutingRules(tenant?.id ?? null);
  const { agents } = useAgents(tenant?.id ?? null);
  const { toast } = useToast();
  const [showCreate, setShowCreate] = useState(false);

  if (!tenant) {
    return (
      <div className="animate-fade-in">
        <h1 className="text-2xl font-bold text-neutral-900 mb-2">Routing Rules</h1>
        <div className="card">
          <EmptyState icon={<Zap className="w-7 h-7" />} title="Select a tenant" description="Choose a tenant to manage their ticket routing rules." />
        </div>
      </div>
    );
  }

  if (loading) return <TableSkeleton />;
  if (error) return <ErrorState message={error} />;

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900">Routing Rules</h1>
          <p className="text-sm text-neutral-500 mt-1">
            Automatically assign tickets based on category, priority, or keywords. Rules run in priority order.
          </p>
        </div>
        <button onClick={() => setShowCreate(true)} className="btn-primary">
          <Plus className="w-4 h-4" />
          New Rule
        </button>
      </div>

      {rules.length === 0 ? (
        <div className="card">
          <EmptyState
            icon={<Zap className="w-7 h-7" />}
            title="No routing rules yet"
            description="Create rules to automatically assign tickets, set priorities, or add tags based on ticket content."
          />
        </div>
      ) : (
        <div className="space-y-3">
          {rules.map((rule) => (
            <RoutingRuleCard
              key={rule.id}
              rule={rule}
              agents={agents}
              onToggle={() => {
                update(rule.id, { enabled: !rule.enabled });
                toast(`Rule ${rule.enabled ? 'disabled' : 'enabled'}`, 'success');
              }}
              onDelete={() => {
                remove(rule.id);
                toast('Rule deleted', 'success');
              }}
            />
          ))}
        </div>
      )}

      <CreateRuleModal
        open={showCreate}
        onClose={() => setShowCreate(false)}
        tenantId={tenant.id}
        agents={agents}
        onCreate={async (rule) => {
          const created = await create(rule);
          if (created) {
            toast('Routing rule created', 'success');
            setShowCreate(false);
          } else {
            toast('Failed to create rule', 'error');
          }
        }}
      />
    </div>
  );
}

function RoutingRuleCard({
  rule,
  agents,
  onToggle,
  onDelete,
}: {
  rule: RoutingRule;
  agents: Agent[];
  onToggle: () => void;
  onDelete: () => void;
}) {
  const agent = agents.find((a) => a.id === rule.action_value);
  const actionLabel = rule.action === 'assign_agent'
    ? `Assign to ${agent?.name ?? rule.action_value}`
    : rule.action === 'set_priority'
    ? `Set priority to ${rule.action_value}`
    : `Add tag "${rule.action_value}"`;

  const conditionLabel = rule.condition_field === 'subject_keyword'
    ? `Subject contains "${rule.condition_value}"`
    : `${rule.condition_field === 'category' ? 'Category' : 'Priority'} is "${rule.condition_value}"`;

  return (
    <div className={`card p-4 ${!rule.enabled ? 'opacity-60' : ''}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${rule.enabled ? 'bg-primary-50' : 'bg-neutral-100'}`}>
            <Zap className={`w-4 h-4 ${rule.enabled ? 'text-primary-600' : 'text-neutral-400'}`} />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-neutral-800">{rule.name}</p>
            <div className="flex items-center gap-2 mt-1 text-xs text-neutral-500">
              <span className="px-2 py-0.5 rounded bg-neutral-100 text-neutral-600">{conditionLabel}</span>
              <ArrowRight className="w-3 h-3" />
              <span className="px-2 py-0.5 rounded bg-primary-50 text-primary-600">{actionLabel}</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <span className="text-xs text-neutral-400">Priority {rule.priority}</span>
          <button onClick={onToggle} aria-label={rule.enabled ? 'Disable rule' : 'Enable rule'} className="p-1.5 rounded-lg hover:bg-neutral-100">
            {rule.enabled
              ? <ToggleRight className="w-6 h-6 text-primary-500" />
              : <ToggleLeft className="w-6 h-6 text-neutral-400" />}
          </button>
          <button onClick={onDelete} aria-label="Delete rule" className="p-1.5 rounded-lg hover:bg-danger-50 text-danger-500">
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

function CreateRuleModal({
  open,
  onClose,
  agents,
  onCreate,
}: {
  open: boolean;
  onClose: () => void;
  tenantId: string;
  agents: Agent[];
  onCreate: (rule: Omit<RoutingRule, 'id' | 'tenant_id' | 'created_at' | 'updated_at'>) => Promise<void>;
}) {
  const [name, setName] = useState('');
  const [conditionField, setConditionField] = useState<RoutingRule['condition_field']>('category');
  const [conditionValue, setConditionValue] = useState('');
  const [action, setAction] = useState<RoutingRule['action']>('assign_agent');
  const [actionValue, setActionValue] = useState('');
  const [priority, setPriority] = useState(100);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!name || !conditionValue || !actionValue) return;
    setSubmitting(true);
    await onCreate({ name, condition_field: conditionField, condition_value: conditionValue, action, action_value: actionValue, priority, enabled: true });
    setName(''); setConditionValue(''); setActionValue(''); setPriority(100);
    setSubmitting(false);
  };

  return (
    <Modal open={open} onClose={onClose} title="Create Routing Rule" size="md">
      <div className="space-y-4">
        <div>
          <label className="text-sm font-medium text-neutral-700 mb-1.5 block">Rule Name</label>
          <input type="text" value={name} onChange={(e) => setName(e.target.value)} className="input" placeholder="e.g. Assign billing tickets" />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-sm font-medium text-neutral-700 mb-1.5 block">Condition</label>
            <select value={conditionField} onChange={(e) => setConditionField(e.target.value as RoutingRule['condition_field'])} className="input">
              <option value="category">Category is</option>
              <option value="priority">Priority is</option>
              <option value="subject_keyword">Subject contains</option>
            </select>
          </div>
          <div>
            <label className="text-sm font-medium text-neutral-700 mb-1.5 block">Value</label>
            {conditionField === 'priority' ? (
              <select value={conditionValue} onChange={(e) => setConditionValue(e.target.value)} className="input">
                <option value="">Select...</option>
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="urgent">Urgent</option>
              </select>
            ) : (
              <input type="text" value={conditionValue} onChange={(e) => setConditionValue(e.target.value)} className="input" placeholder={conditionField === 'category' ? 'Billing' : 'bug'} />
            )}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-sm font-medium text-neutral-700 mb-1.5 block">Action</label>
            <select value={action} onChange={(e) => setAction(e.target.value as RoutingRule['action'])} className="input">
              <option value="assign_agent">Assign to agent</option>
              <option value="set_priority">Set priority</option>
              <option value="add_tag">Add tag</option>
            </select>
          </div>
          <div>
            <label className="text-sm font-medium text-neutral-700 mb-1.5 block">Action Value</label>
            {action === 'assign_agent' ? (
              <select value={actionValue} onChange={(e) => setActionValue(e.target.value)} className="input">
                <option value="">Select agent...</option>
                {agents.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            ) : action === 'set_priority' ? (
              <select value={actionValue} onChange={(e) => setActionValue(e.target.value)} className="input">
                <option value="">Select...</option>
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="urgent">Urgent</option>
              </select>
            ) : (
              <input type="text" value={actionValue} onChange={(e) => setActionValue(e.target.value)} className="input" placeholder="tag-name" />
            )}
          </div>
        </div>
        <div>
          <label className="text-sm font-medium text-neutral-700 mb-1.5 block">Priority (lower runs first)</label>
          <input type="number" value={priority} onChange={(e) => setPriority(Number(e.target.value))} className="input w-32" min={1} max={999} />
        </div>
        <div className="flex justify-end gap-3 pt-2">
          <button onClick={onClose} className="btn-secondary">Cancel</button>
          <button onClick={handleSubmit} disabled={submitting || !name || !conditionValue || !actionValue} className="btn-primary">
            {submitting ? <LoadingSpinner size={16} /> : <Plus className="w-4 h-4" />}
            Create Rule
          </button>
        </div>
      </div>
    </Modal>
  );
}
