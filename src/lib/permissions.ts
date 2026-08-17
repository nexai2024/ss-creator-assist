import type { RoleTier } from '@/types';

export const ROLE_DISPLAY: Record<RoleTier, { label: string; color: string; bg: string }> = {
  admin: { label: 'Admin', color: 'text-primary-700', bg: 'bg-primary-50' },
  manager: { label: 'Manager', color: 'text-accent-700', bg: 'bg-accent-50' },
  senior_agent: { label: 'Senior Agent', color: 'text-success-700', bg: 'bg-success-50' },
  junior_agent: { label: 'Junior Agent', color: 'text-neutral-700', bg: 'bg-neutral-100' },
  read_only: { label: 'Read-Only', color: 'text-warning-700', bg: 'bg-warning-50' },
};

export const ROLE_DESCRIPTIONS: Record<RoleTier, string> = {
  admin: 'Full system access: manage integrations, billing, roles, and all tickets.',
  manager: 'Oversight and quality control: reassign tickets, view analytics, approve refunds, edit KB.',
  senior_agent: 'Handle complex issues and escalations: resolve escalated tickets, issue refunds, trigger webhooks.',
  junior_agent: 'Front-line triage: view assigned queue, reply with templates, add notes, escalate.',
  read_only: 'Compliance and training: read tickets, notes, and reports. Cannot send replies or alter statuses.',
};

export const ALL_ROLE_TIERS: RoleTier[] = ['admin', 'manager', 'senior_agent', 'junior_agent', 'read_only'];

// Client-side permission mapping (mirrors the database role_permissions table)
export const ROLE_PERMISSIONS: Record<RoleTier, string[]> = {
  admin: [
    'tickets:read', 'tickets:reply', 'tickets:assign', 'tickets:escalate', 'tickets:delete', 'tickets:resolve', 'tickets:manage_all',
    'notes:create', 'notes:read',
    'finance:refund', 'finance:apply_credit',
    'kb:read', 'kb:edit', 'kb:publish',
    'settings:manage_integrations', 'settings:manage_webhooks', 'settings:manage_roles', 'settings:manage_billing', 'settings:manage_routing',
    'team:invite', 'team:revoke', 'team:view',
    'audit:read',
    'chat:reply', 'chat:close', 'chat:escalate',
  ],
  manager: [
    'tickets:read', 'tickets:reply', 'tickets:assign', 'tickets:escalate', 'tickets:resolve', 'tickets:manage_all',
    'notes:create', 'notes:read',
    'finance:refund', 'finance:apply_credit',
    'kb:read', 'kb:edit', 'kb:publish',
    'settings:manage_routing',
    'team:view',
    'audit:read',
    'chat:reply', 'chat:close', 'chat:escalate',
  ],
  senior_agent: [
    'tickets:read', 'tickets:reply', 'tickets:assign', 'tickets:escalate', 'tickets:resolve',
    'notes:create', 'notes:read',
    'finance:refund',
    'kb:read', 'kb:edit',
    'chat:reply', 'chat:close', 'chat:escalate',
  ],
  junior_agent: [
    'tickets:read', 'tickets:reply',
    'notes:create', 'notes:read',
    'tickets:escalate',
    'kb:read',
    'chat:reply', 'chat:escalate',
  ],
  read_only: [
    'tickets:read',
    'notes:read',
    'kb:read',
    'team:view',
    'audit:read',
  ],
};

export function hasPermission(role: RoleTier | null, permission: string): boolean {
  if (!role) return false;
  return ROLE_PERMISSIONS[role]?.includes(permission) ?? false;
}

export function hasAnyPermission(role: RoleTier | null, permissions: string[]): boolean {
  if (!role) return false;
  return permissions.some((p) => hasPermission(role, p));
}

export function canManageTeam(role: RoleTier | null): boolean {
  return role === 'admin';
}

export function canManageBilling(role: RoleTier | null): boolean {
  return hasPermission(role, 'settings:manage_billing');
}

export function canManageIntegrations(role: RoleTier | null): boolean {
  return hasPermission(role, 'settings:manage_integrations');
}

export function canManageRouting(role: RoleTier | null): boolean {
  return hasPermission(role, 'settings:manage_routing');
}
