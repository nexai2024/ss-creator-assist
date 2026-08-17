import { type ReactNode } from 'react';

type BadgeColor = 'blue' | 'green' | 'amber' | 'red' | 'gray' | 'cyan' | 'violet';

const colorMap: Record<BadgeColor, string> = {
  blue: 'bg-primary-50 text-primary-700',
  green: 'bg-success-50 text-success-700',
  amber: 'bg-warning-50 text-warning-700',
  red: 'bg-danger-50 text-danger-700',
  gray: 'bg-neutral-100 text-neutral-600',
  cyan: 'bg-accent-50 text-accent-700',
  violet: 'bg-violet-50 text-violet-700',
};

export function Badge({ color = 'gray', children }: { color?: BadgeColor; children: ReactNode }) {
  return <span className={`badge ${colorMap[color]}`}>{children}</span>;
}

export function PriorityBadge({ priority }: { priority: string }) {
  const map: Record<string, { color: BadgeColor; label: string }> = {
    urgent: { color: 'red', label: 'Urgent' },
    high: { color: 'amber', label: 'High' },
    medium: { color: 'blue', label: 'Medium' },
    low: { color: 'gray', label: 'Low' },
  };
  const config = map[priority] ?? map.low;
  return (
    <Badge color={config.color}>
      <span className={`w-1.5 h-1.5 rounded-full ${
        config.color === 'red' ? 'bg-danger-500' :
        config.color === 'amber' ? 'bg-warning-500' :
        config.color === 'blue' ? 'bg-primary-500' : 'bg-neutral-400'
      }`} />
      {config.label}
    </Badge>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { color: BadgeColor; label: string }> = {
    open: { color: 'blue', label: 'Open' },
    pending: { color: 'amber', label: 'Pending' },
    resolved: { color: 'green', label: 'Resolved' },
    closed: { color: 'gray', label: 'Closed' },
    active: { color: 'green', label: 'Active' },
    waiting: { color: 'amber', label: 'Waiting' },
    processing: { color: 'amber', label: 'Processing' },
    completed: { color: 'green', label: 'Completed' },
    failed: { color: 'red', label: 'Failed' },
    published: { color: 'green', label: 'Published' },
    draft: { color: 'gray', label: 'Draft' },
    online: { color: 'green', label: 'Online' },
    away: { color: 'amber', label: 'Away' },
    offline: { color: 'gray', label: 'Offline' },
    trial: { color: 'cyan', label: 'Trial' },
    suspended: { color: 'red', label: 'Suspended' },
  };
  const config = map[status] ?? { color: 'gray' as BadgeColor, label: status };
  return <Badge color={config.color}>{config.label}</Badge>;
}

export function PlanBadge({ plan }: { plan: string }) {
  const map: Record<string, { color: BadgeColor; label: string }> = {
    starter: { color: 'gray', label: 'Starter' },
    growth: { color: 'cyan', label: 'Growth' },
    enterprise: { color: 'violet', label: 'Enterprise' },
  };
  const config = map[plan] ?? { color: 'gray' as BadgeColor, label: plan };
  return <Badge color={config.color}>{config.label}</Badge>;
}
