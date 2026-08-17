import { useCallback } from 'react';
import { useMutation, useQuery } from 'convex/react';
import { api } from '../../convex/_generated/api';
import type { Id } from '../../convex/_generated/dataModel';
import type { SavedReply, CustomerProfile, TimeEntry, FollowUp, BusinessHours } from '@/types';

export function useSavedReplies(tenantId: string | null) {
  const replies = useQuery(
    api.solopreneur.savedReplies,
    tenantId ? { tenantId: tenantId as Id<'tenants'> } : 'skip',
  ) as SavedReply[] | undefined;
  const createMut = useMutation(api.solopreneur.createReply);
  const updateMut = useMutation(api.solopreneur.updateReply);
  const removeMut = useMutation(api.solopreneur.removeReply);
  const incrementMut = useMutation(api.solopreneur.incrementReply);

  const create = useCallback(async (reply: Omit<SavedReply, 'id' | 'tenant_id' | 'usage_count' | 'created_at' | 'updated_at'>) => {
    if (!tenantId) return null;
    const id = await createMut({
      tenantId: tenantId as Id<'tenants'>,
      title: reply.title,
      content: reply.content,
      category: reply.category,
      shortcut: reply.shortcut ?? undefined,
    });
    return { ...reply, id, tenant_id: tenantId, usage_count: 0, created_at: new Date().toISOString(), updated_at: new Date().toISOString() } as SavedReply;
  }, [tenantId, createMut]);

  const update = useCallback(async (id: string, patch: Partial<SavedReply>) => {
    if (!tenantId) return;
    await updateMut({
      tenantId: tenantId as Id<'tenants'>,
      replyId: id as Id<'savedReplies'>,
      title: patch.title,
      content: patch.content,
      category: patch.category,
    });
  }, [tenantId, updateMut]);

  const remove = useCallback(async (id: string) => {
    if (!tenantId) return;
    await removeMut({ tenantId: tenantId as Id<'tenants'>, replyId: id as Id<'savedReplies'> });
  }, [tenantId, removeMut]);

  const incrementUsage = useCallback(async (id: string) => {
    if (!tenantId) return;
    await incrementMut({ tenantId: tenantId as Id<'tenants'>, replyId: id as Id<'savedReplies'> });
  }, [tenantId, incrementMut]);

  return { replies: replies ?? [], loading: tenantId ? replies === undefined : false, create, update, remove, incrementUsage, reload: async () => {} };
}

export function useCustomerProfile(tenantId: string | null, email: string | null) {
  const profile = useQuery(
    api.solopreneur.profile,
    tenantId && email ? { tenantId: tenantId as Id<'tenants'>, email } : 'skip',
  ) as CustomerProfile | null | undefined;
  const upsertMut = useMutation(api.solopreneur.upsertProfile);

  const upsert = useCallback(async (updates: Partial<CustomerProfile>) => {
    if (!tenantId || !email) return;
    await upsertMut({
      tenantId: tenantId as Id<'tenants'>,
      email,
      customerName: updates.customer_name ?? undefined,
      isVip: updates.is_vip,
      personalNotes: updates.personal_notes ?? undefined,
      lifetimeValue: updates.lifetime_value,
    });
  }, [tenantId, email, upsertMut]);

  return { profile: profile ?? null, loading: tenantId && email ? profile === undefined : false, upsert, reload: async () => {} };
}

export function useTimeEntries(tenantId: string | null) {
  const entries = useQuery(
    api.solopreneur.timeEntries,
    tenantId ? { tenantId: tenantId as Id<'tenants'> } : 'skip',
  ) as TimeEntry[] | undefined;
  const addMut = useMutation(api.solopreneur.addTime);

  const add = useCallback(async (entry: { entity_type: 'ticket' | 'chat'; entity_id: string; minutes: number; description?: string; billable?: boolean }) => {
    if (!tenantId) return null;
    await addMut({
      tenantId: tenantId as Id<'tenants'>,
      entityType: entry.entity_type,
      entityId: entry.entity_id,
      minutes: entry.minutes,
      description: entry.description,
      billable: entry.billable,
    });
    return entry as TimeEntry;
  }, [tenantId, addMut]);

  const list = entries ?? [];
  const totalMinutes = list.reduce((sum, e) => sum + e.minutes, 0);
  const billableMinutes = list.filter((e) => e.billable).reduce((sum, e) => sum + e.minutes, 0);
  return { entries: list, loading: tenantId ? entries === undefined : false, add, totalMinutes, billableMinutes, reload: async () => {} };
}

export function useFollowUps(tenantId: string | null) {
  const followUps = useQuery(
    api.solopreneur.followUps,
    tenantId ? { tenantId: tenantId as Id<'tenants'> } : 'skip',
  ) as FollowUp[] | undefined;
  const createMut = useMutation(api.solopreneur.createFollowUp);
  const completeMut = useMutation(api.solopreneur.completeFollowUp);
  const removeMut = useMutation(api.solopreneur.removeFollowUp);

  const create = useCallback(async (fup: { entity_type: 'ticket' | 'chat'; entity_id: string; customer_email: string; customer_name?: string; reminder_at: string; note?: string }) => {
    if (!tenantId) return null;
    await createMut({
      tenantId: tenantId as Id<'tenants'>,
      entityType: fup.entity_type,
      entityId: fup.entity_id,
      customerEmail: fup.customer_email,
      customerName: fup.customer_name,
      reminderAt: new Date(fup.reminder_at).getTime(),
      note: fup.note,
    });
    return fup as FollowUp;
  }, [tenantId, createMut]);

  const complete = useCallback(async (id: string) => {
    if (!tenantId) return;
    await completeMut({ tenantId: tenantId as Id<'tenants'>, followUpId: id as Id<'followUps'> });
  }, [tenantId, completeMut]);

  const remove = useCallback(async (id: string) => {
    if (!tenantId) return;
    await removeMut({ tenantId: tenantId as Id<'tenants'>, followUpId: id as Id<'followUps'> });
  }, [tenantId, removeMut]);

  const list = followUps ?? [];
  const pending = list.filter((f) => !f.completed);
  const overdue = pending.filter((f) => new Date(f.reminder_at) < new Date());
  const dueToday = pending.filter((f) => {
    const d = new Date(f.reminder_at);
    const now = new Date();
    return d.toDateString() === now.toDateString();
  });

  return { followUps: list, loading: tenantId ? followUps === undefined : false, create, complete, remove, pending, overdue, dueToday, reload: async () => {} };
}

export function useBusinessHours(tenantId: string | null) {
  const hours = useQuery(
    api.solopreneur.hours,
    tenantId ? { tenantId: tenantId as Id<'tenants'> } : 'skip',
  ) as BusinessHours[] | undefined;
  const updateMut = useMutation(api.solopreneur.updateHour);

  const update = useCallback(async (id: string, patch: Partial<BusinessHours>) => {
    if (!tenantId) return;
    await updateMut({
      tenantId: tenantId as Id<'tenants'>,
      hourId: id as Id<'businessHours'>,
      isWorkingDay: patch.is_working_day,
      openTime: patch.open_time,
      closeTime: patch.close_time,
      timezone: patch.timezone,
    });
  }, [tenantId, updateMut]);

  const list = hours ?? [];
  const isCurrentlyOpen = useCallback(() => {
    if (list.length === 0) return true;
    const now = new Date();
    const dayOfWeek = now.getDay();
    const todayHours = list.find((h) => h.day_of_week === dayOfWeek);
    if (!todayHours || !todayHours.is_working_day) return false;
    const currentTime = now.toTimeString().slice(0, 5);
    return currentTime >= todayHours.open_time && currentTime < todayHours.close_time;
  }, [list]);

  return { hours: list, loading: tenantId ? hours === undefined : false, update, isCurrentlyOpen, reload: async () => {} };
}

export function useSoloSettings(tenantId: string | null) {
  const solo = useQuery(
    api.solopreneur.solo,
    tenantId ? { tenantId: tenantId as Id<'tenants'> } : 'skip',
  );
  const saveMut = useMutation(api.solopreneur.saveSolo);
  const save = useCallback(async (patch: { soloMode?: boolean; autoResponderEnabled?: boolean; autoResponderMessage?: string }) => {
    if (!tenantId) return;
    await saveMut({ tenantId: tenantId as Id<'tenants'>, ...patch });
  }, [tenantId, saveMut]);
  return { solo: solo ?? { solo_mode: false, auto_responder_enabled: false, auto_responder_message: '' }, loading: tenantId ? solo === undefined : false, save };
}
