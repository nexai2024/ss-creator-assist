import { useQuery } from 'convex/react';
import { api } from '../../convex/_generated/api';
import type { Id } from '../../convex/_generated/dataModel';
import type { Agent } from '@/types';

export function useAgents(tenantId: string | null) {
  const agents = useQuery(
    api.integrations.listAgents,
    tenantId ? { tenantId: tenantId as Id<'tenants'> } : 'skip',
  );
  return {
    agents: (agents ?? []) as Agent[],
    loading: tenantId ? agents === undefined : false,
    error: null as string | null,
  };
}
