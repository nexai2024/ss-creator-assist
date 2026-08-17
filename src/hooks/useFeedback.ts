import { useCallback } from 'react';
import { useMutation, useQuery } from 'convex/react';
import { api } from '../../convex/_generated/api';
import type { Id } from '../../convex/_generated/dataModel';
import type { TicketFeedback } from '@/types';

export function useTicketFeedback(tenantId: string | null, ticketId: string | null) {
  const feedback = useQuery(
    api.tickets.feedback,
    tenantId && ticketId
      ? { tenantId: tenantId as Id<'tenants'>, ticketId: ticketId as Id<'tickets'> }
      : 'skip',
  ) as TicketFeedback | null | undefined;
  const submitMut = useMutation(api.tickets.submitCsat);

  const submit = useCallback(async (rating: number) => {
    if (!tenantId || !ticketId) return null;
    await submitMut({
      tenantId: tenantId as Id<'tenants'>,
      ticketId: ticketId as Id<'tickets'>,
      rating,
    });
    return { ticket_id: ticketId, rating } as TicketFeedback;
  }, [tenantId, ticketId, submitMut]);

  return {
    feedback: feedback ?? null,
    loading: ticketId ? feedback === undefined : false,
    submit,
  };
}
