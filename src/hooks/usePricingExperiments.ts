import { useEffect, useState } from 'react';
import { useMutation } from 'convex/react';
import { api } from '../../convex/_generated/api';
import type { Id } from '../../convex/_generated/dataModel';
import type { PricingExperiment } from '@/types';
import { useQuery } from 'convex/react';

export function usePricingExperiments() {
  const experiments = useQuery(api.public.experiments) as PricingExperiment[] | undefined;
  return { experiments: experiments ?? [], loading: experiments === undefined };
}

export function useExperimentVariant(experimentId: string | null, sessionId: string) {
  const [variant, setVariant] = useState<'A' | 'B' | null>(null);
  const assign = useMutation(api.public.assignExperiment);

  useEffect(() => {
    if (!experimentId) return;
    void assign({ experimentId: experimentId as Id<'pricingExperiments'>, sessionId }).then(setVariant);
  }, [experimentId, sessionId, assign]);

  return variant;
}
