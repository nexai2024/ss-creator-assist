import { useQuery } from 'convex/react';
import { api } from '../../convex/_generated/api';
import type { Tenant } from '@/types';

export function useTenants() {
  const rows = useQuery(api.tenants.listMine);
  const tenants: Tenant[] = (rows ?? []).map((row) => ({
    id: row.id,
    name: row.name,
    slug: row.slug,
    plan_tier: row.plan_tier,
    status: row.status,
    monthly_active_users: row.monthly_active_users,
    included_maus: row.included_maus,
    overage_rate: row.overage_rate,
    sla_uptime: row.sla_uptime,
    created_at: row.created_at,
  }));
  return {
    tenants,
    loading: rows === undefined,
    error: null as string | null,
  };
}

export function useTenantLookup(tenants: Tenant[]) {
  const map = new Map(tenants.map((t) => [t.id, t]));
  return (id: string) => map.get(id);
}
