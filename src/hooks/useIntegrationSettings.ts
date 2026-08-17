import { useCallback } from 'react';
import { useMutation, useQuery } from 'convex/react';
import { api } from '../../convex/_generated/api';
import type { Id } from '../../convex/_generated/dataModel';
import type { IntegrationSettings } from '@/types';

function toPatch(patch: Partial<IntegrationSettings>) {
  return {
    name: patch.name,
    description: patch.description ?? undefined,
    status: patch.status,
    widgetEnabled: patch.widget_enabled,
    widgetPosition: patch.widget_position,
    widgetColor: patch.widget_color,
    widgetGreeting: patch.widget_greeting ?? undefined,
    customDomain: patch.custom_domain ?? undefined,
    helpCenterSubdomain: patch.help_center_subdomain ?? undefined,
    brandingLogoUrl: patch.branding_logo_url ?? undefined,
    brandingPrimaryColor: patch.branding_primary_color,
    webhookUrl: patch.webhook_url ?? undefined,
    webhookSecret: patch.webhook_secret ?? undefined,
    webhookEvents: patch.webhook_events,
    ssoEnabled: patch.sso_enabled,
    ssoProvider: patch.sso_provider ?? undefined,
    ssoMetadataUrl: patch.sso_metadata_url ?? undefined,
    onboardingCompleted: patch.onboarding_completed,
    onboardingStep: patch.onboarding_step,
  };
}

export function useIntegrations(tenantId: string | null) {
  const integrations = useQuery(
    api.integrations.list,
    tenantId ? { tenantId: tenantId as Id<'tenants'> } : 'skip',
  ) as IntegrationSettings[] | undefined;
  const createMut = useMutation(api.integrations.create);

  const create = useCallback(async (name: string, description?: string): Promise<IntegrationSettings | null> => {
    if (!tenantId) return null;
    return await createMut({
      tenantId: tenantId as Id<'tenants'>,
      name,
      description,
    }) as IntegrationSettings;
  }, [tenantId, createMut]);

  return {
    integrations: integrations ?? [],
    loading: tenantId ? integrations === undefined : false,
    error: null as string | null,
    create,
    reload: async () => {},
  };
}

export function useIntegration(integrationId: string | null) {
  const integration = useQuery(
    api.integrations.get,
    integrationId ? { integrationId: integrationId as Id<'integrationSettings'> } : 'skip',
  ) as IntegrationSettings | null | undefined;
  const updateMut = useMutation(api.integrations.update);
  const removeMut = useMutation(api.integrations.remove);
  const rotateKeyMut = useMutation(api.integrations.rotateApiKey);
  const rotateSecretMut = useMutation(api.integrations.rotateWebhookSecret);

  const update = useCallback(async (patch: Partial<IntegrationSettings>) => {
    if (!integrationId) return;
    await updateMut({
      integrationId: integrationId as Id<'integrationSettings'>,
      patch: toPatch(patch),
    });
  }, [integrationId, updateMut]);

  const remove = useCallback(async () => {
    if (!integrationId) return;
    await removeMut({ integrationId: integrationId as Id<'integrationSettings'> });
  }, [integrationId, removeMut]);

  const rotateApiKey = useCallback(async (): Promise<IntegrationSettings | null> => {
    if (!integrationId) return null;
    return await rotateKeyMut({ integrationId: integrationId as Id<'integrationSettings'> }) as IntegrationSettings;
  }, [integrationId, rotateKeyMut]);

  const rotateWebhookSecret = useCallback(async (): Promise<IntegrationSettings | null> => {
    if (!integrationId) return null;
    return await rotateSecretMut({ integrationId: integrationId as Id<'integrationSettings'> }) as IntegrationSettings;
  }, [integrationId, rotateSecretMut]);

  return {
    integration: integration ?? null,
    loading: integrationId ? integration === undefined : false,
    error: null as string | null,
    update,
    remove,
    rotateApiKey,
    rotateWebhookSecret,
    reload: async () => {},
  };
}

export const PLAN_INTEGRATION_LIMITS: Record<string, number> = {
  starter: 1,
  growth: 3,
  enterprise: -1,
};
