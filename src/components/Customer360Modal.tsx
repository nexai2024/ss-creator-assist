import { useEffect, useState } from 'react';
import { Star, Ticket as TicketIcon, MessageSquare, X, Save, DollarSign, StickyNote } from 'lucide-react';
import type { Tenant, Ticket, ChatConversation } from '@/types';
import { useCustomerProfile } from '@/hooks/useSolopreneur';
import { LoadingSpinner } from '@/components/States';
import { PriorityBadge, StatusBadge } from '@/components/Badges';
import { useQuery } from 'convex/react';
import { api } from '../../convex/_generated/api';
import type { Id } from '../../convex/_generated/dataModel';

export function Customer360Modal({ tenant, email, name, onClose }: {
  tenant: Tenant;
  email: string;
  name?: string;
  onClose: () => void;
}) {
  const { profile, loading, upsert } = useCustomerProfile(tenant.id, email);
  const history = useQuery(api.dashboard.customerHistory, {
    tenantId: tenant.id as Id<'tenants'>,
    email,
  });
  const tickets = (history?.tickets ?? []) as Ticket[];
  const chats = (history?.chats ?? []) as ChatConversation[];
  const [notes, setNotes] = useState('');
  const [isVip, setIsVip] = useState(false);
  const [ltv, setLtv] = useState(0);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (profile) {
      setNotes(profile.personal_notes ?? '');
      setIsVip(profile.is_vip);
      setLtv(Number(profile.lifetime_value) || 0);
    }
  }, [profile]);

  const handleSave = async () => {
    setSaving(true);
    await upsert({
      customer_name: name,
      personal_notes: notes,
      is_vip: isVip,
      lifetime_value: ltv,
      total_tickets: tickets.length,
      last_contact_at: tickets[0]?.created_at ?? chats[0]?.created_at ?? null,
    });
    setSaving(false);
  };

  const totalInteractions = tickets.length + chats.length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fade-in">
      <div className="absolute inset-0 bg-neutral-900/40 backdrop-blur-sm" onClick={onClose} />
      <div role="dialog" aria-modal="true" className="relative max-w-2xl w-full bg-white rounded-2xl shadow-2xl border border-neutral-200 max-h-[85vh] flex flex-col animate-slide-up overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-100">
          <div className="flex items-center gap-3">
            <div className={`w-11 h-11 rounded-full flex items-center justify-center text-white text-lg font-bold ${isVip ? 'bg-gradient-to-br from-amber-400 to-orange-500' : 'bg-gradient-to-br from-primary-400 to-accent-400'}`}>
              {(name ?? email).charAt(0).toUpperCase()}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-semibold text-neutral-900">{name ?? email}</h2>
                {isVip && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-50 text-amber-600">
                    <Star className="w-3 h-3 fill-amber-400 text-amber-400" /> VIP
                  </span>
                )}
              </div>
              <p className="text-xs text-neutral-400">{email}</p>
            </div>
          </div>
          <button onClick={onClose} aria-label="Close" className="p-1.5 rounded-lg text-neutral-400 hover:bg-neutral-100">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto scrollbar-thin px-6 py-5 space-y-5">
          {loading ? (
            <div className="flex justify-center py-12"><LoadingSpinner /></div>
          ) : (
            <>
              <div className="grid grid-cols-3 gap-3">
                <div className="p-3 rounded-lg bg-neutral-50 text-center">
                  <TicketIcon className="w-4 h-4 text-primary-400 mx-auto mb-1" />
                  <p className="text-lg font-bold text-neutral-800">{tickets.length}</p>
                  <p className="text-xs text-neutral-400">Tickets</p>
                </div>
                <div className="p-3 rounded-lg bg-neutral-50 text-center">
                  <MessageSquare className="w-4 h-4 text-accent-400 mx-auto mb-1" />
                  <p className="text-lg font-bold text-neutral-800">{chats.length}</p>
                  <p className="text-xs text-neutral-400">Chats</p>
                </div>
                <div className="p-3 rounded-lg bg-neutral-50 text-center">
                  <DollarSign className="w-4 h-4 text-success-400 mx-auto mb-1" />
                  <p className="text-lg font-bold text-neutral-800">${ltv.toFixed(0)}</p>
                  <p className="text-xs text-neutral-400">LTV</p>
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 rounded-lg bg-neutral-50">
                  <div className="flex items-center gap-2">
                    <Star className={`w-4 h-4 ${isVip ? 'text-amber-400 fill-amber-400' : 'text-neutral-300'}`} />
                    <span className="text-sm font-medium text-neutral-700">VIP Customer</span>
                  </div>
                  <button onClick={() => setIsVip(!isVip)} className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${isVip ? 'bg-amber-100 text-amber-700' : 'bg-white border border-neutral-200 text-neutral-500'}`}>
                    {isVip ? 'VIP Active' : 'Mark as VIP'}
                  </button>
                </div>

                <div>
                  <label className="text-sm font-medium text-neutral-700 mb-1.5 flex items-center gap-1.5">
                    <StickyNote className="w-4 h-4 text-amber-400" /> Personal Notes
                  </label>
                  <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3}
                    className="input resize-none text-sm" placeholder="Notes about this customer — preferences, history, context..." />
                </div>

                <div>
                  <label className="text-sm font-medium text-neutral-700 mb-1.5 block">Lifetime Value ($)</label>
                  <input type="number" value={ltv} onChange={(e) => setLtv(Number(e.target.value))} className="input w-32" min={0} />
                </div>
              </div>

              <div>
                <h3 className="text-sm font-semibold text-neutral-800 mb-3">Interaction History ({totalInteractions})</h3>
                {totalInteractions === 0 ? (
                  <p className="text-sm text-neutral-400 text-center py-4">No previous interactions</p>
                ) : (
                  <div className="space-y-2">
                    {tickets.slice(0, 5).map((t) => (
                      <div key={t.id} className="flex items-center gap-3 p-3 rounded-lg bg-neutral-50">
                        <TicketIcon className="w-4 h-4 text-primary-400 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-neutral-700 truncate">{t.subject}</p>
                          <p className="text-xs text-neutral-400">{new Date(t.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</p>
                        </div>
                        <PriorityBadge priority={t.priority} />
                        <StatusBadge status={t.status} />
                      </div>
                    ))}
                    {chats.slice(0, 3).map((c) => (
                      <div key={c.id} className="flex items-center gap-3 p-3 rounded-lg bg-neutral-50">
                        <MessageSquare className="w-4 h-4 text-accent-400 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-neutral-700 truncate">Chat conversation</p>
                          <p className="text-xs text-neutral-400">{new Date(c.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</p>
                        </div>
                        <StatusBadge status={c.status} />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        <div className="flex justify-end gap-3 px-6 py-4 border-t border-neutral-100">
          <button onClick={onClose} className="btn-secondary">Close</button>
          <button onClick={handleSave} disabled={saving} className="btn-primary">
            {saving ? <LoadingSpinner size={16} /> : <Save className="w-4 h-4" />}
            Save Profile
          </button>
        </div>
      </div>
    </div>
  );
}
