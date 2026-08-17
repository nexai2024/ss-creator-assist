import { useCallback } from 'react';
import { useMutation, useQuery } from 'convex/react';
import { api } from '../../convex/_generated/api';
import type { Id } from '../../convex/_generated/dataModel';
import type { RoutingRule } from '@/types';

export function useRoutingRules(tenantId: string | null) {
  const rules = useQuery(
    api.integrations.listRules,
    tenantId ? { tenantId: tenantId as Id<'tenants'> } : 'skip',
  ) as RoutingRule[] | undefined;
  const createMut = useMutation(api.integrations.createRule);
  const updateMut = useMutation(api.integrations.updateRule);
  const removeMut = useMutation(api.integrations.removeRule);

  const create = useCallback(async (rule: Omit<RoutingRule, 'id' | 'tenant_id' | 'created_at' | 'updated_at'>) => {
    if (!tenantId) return null;
    await createMut({
      tenantId: tenantId as Id<'tenants'>,
      name: rule.name,
      conditionField: rule.condition_field,
      conditionValue: rule.condition_value,
      action: rule.action,
      actionValue: rule.action_value,
      priority: rule.priority,
    });
    return rule as RoutingRule;
  }, [tenantId, createMut]);

  const update = useCallback(async (id: string, patch: Partial<RoutingRule>) => {
    if (!tenantId) return;
    await updateMut({
      tenantId: tenantId as Id<'tenants'>,
      ruleId: id as Id<'routingRules'>,
      enabled: patch.enabled,
    });
  }, [tenantId, updateMut]);

  const remove = useCallback(async (id: string) => {
    if (!tenantId) return;
    await removeMut({ tenantId: tenantId as Id<'tenants'>, ruleId: id as Id<'routingRules'> });
  }, [tenantId, removeMut]);

  return {
    rules: rules ?? [],
    loading: tenantId ? rules === undefined : false,
    error: null as string | null,
    create,
    update,
    remove,
    reload: async () => {},
  };
}
