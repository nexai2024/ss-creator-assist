import { useEffect, useState } from 'react';
import { useMutation, useQuery } from 'convex/react';
import { api } from '../../convex/_generated/api';
import type { Id } from '../../convex/_generated/dataModel';

export function usePresence(args: {
  tenantId: string | null;
  entityType: 'ticket' | 'chat';
  entityId: string | null;
  typing: boolean;
}) {
  const heartbeat = useMutation(api.presence.heartbeat);
  const [now, setNow] = useState(() => Date.now());
  const others = useQuery(
    api.presence.list,
    args.tenantId && args.entityId
      ? {
          tenantId: args.tenantId as Id<'tenants'>,
          entityType: args.entityType,
          entityId: args.entityId,
          now,
        }
      : 'skip',
  );

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 5000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    if (!args.tenantId || !args.entityId) return;
    const beat = () => {
      void heartbeat({
        tenantId: args.tenantId as Id<'tenants'>,
        entityType: args.entityType,
        entityId: args.entityId!,
        typing: args.typing,
      });
    };
    beat();
    const id = window.setInterval(beat, 8000);
    return () => window.clearInterval(id);
  }, [args.tenantId, args.entityType, args.entityId, args.typing, heartbeat]);

  return others ?? [];
}
