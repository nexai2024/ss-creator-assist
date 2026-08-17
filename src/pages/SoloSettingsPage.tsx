import { useState } from 'react';
import { Clock, Save, MessageCircle, User, ToggleLeft, ToggleRight, Info } from 'lucide-react';
import type { Tenant } from '@/types';
import { useBusinessHours, useSoloSettings } from '@/hooks/useSolopreneur';
import { LoadingSpinner, EmptyState } from '@/components/States';
import { useToast } from '@/components/Toast';

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const TIMEZONES = ['America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles', 'America/Anchorage', 'Europe/London', 'Europe/Paris', 'Asia/Tokyo', 'Australia/Sydney', 'UTC'];

export function SoloSettingsPage({ tenant }: { tenant: Tenant | null }) {
  const { hours, loading, update, isCurrentlyOpen } = useBusinessHours(tenant?.id ?? null);
  const { solo, save } = useSoloSettings(tenant?.id ?? null);
  const { toast } = useToast();
  const autoResponder = solo.auto_responder_enabled;
  const soloMode = solo.solo_mode;
  const [draftMsg, setDraftMsg] = useState('');

  const persistSolo = async (patch: { solo_mode?: boolean; auto_responder_enabled?: boolean; auto_responder_message?: string }) => {
    await save({
      soloMode: patch.solo_mode,
      autoResponderEnabled: patch.auto_responder_enabled,
      autoResponderMessage: patch.auto_responder_message,
    });
  };

  if (!tenant) {
    return (
      <div className="animate-fade-in">
        <h1 className="text-2xl font-bold text-neutral-900 mb-2">Solo Settings</h1>
        <div className="card">
          <EmptyState icon={<User className="w-7 h-7" />} title="Select a tenant" description="Choose a tenant to configure your solo support settings." />
        </div>
      </div>
    );
  }

  if (loading) return <div className="flex items-center justify-center py-24"><LoadingSpinner size={32} /></div>;

  const currentlyOpen = isCurrentlyOpen();

  return (
    <div className="space-y-5 animate-fade-in max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold text-neutral-900">Solo Settings</h1>
        <p className="text-sm text-neutral-500 mt-1">Configure your one-person support operation — working hours, auto-responder, and more.</p>
      </div>

      <div className={`card p-5 ${currentlyOpen ? 'border-success-200 bg-success-50/30' : 'border-neutral-200 bg-neutral-50/30'}`}>
        <div className="flex items-center gap-3">
          <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${currentlyOpen ? 'bg-success-100' : 'bg-neutral-200'}`}>
            <Clock className={`w-6 h-6 ${currentlyOpen ? 'text-success-600' : 'text-neutral-500'}`} />
          </div>
          <div>
            <p className="text-sm font-semibold text-neutral-800">You're currently {currentlyOpen ? 'available' : 'away'}</p>
            <p className="text-xs text-neutral-400">{currentlyOpen ? 'New messages will be shown as active' : 'Auto-responder will let customers know you\'ll get back to them'}</p>
          </div>
          <div className={`ml-auto px-3 py-1.5 rounded-full text-xs font-medium ${currentlyOpen ? 'bg-success-100 text-success-700' : 'bg-neutral-200 text-neutral-600'}`}>
            {currentlyOpen ? 'Open' : 'Closed'}
          </div>
        </div>
      </div>

      <div className="card p-5">
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary-50 flex items-center justify-center">
              <User className="w-5 h-5 text-primary-500" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-neutral-800">Solo Mode</h3>
              <p className="text-xs text-neutral-400 mt-0.5 max-w-md">Optimizes the interface for one-person operations. Hides team features, shows a unified inbox, and enables time tracking by default.</p>
            </div>
          </div>
          <button onClick={() => { const next = !soloMode; persistSolo({ solo_mode: next }); toast(`Solo mode ${next ? 'enabled' : 'disabled'}`, 'success'); }} className="p-1">
            {soloMode ? <ToggleRight className="w-8 h-8 text-primary-500" /> : <ToggleLeft className="w-8 h-8 text-neutral-300" />}
          </button>
        </div>
      </div>

      <div className="card p-5">
        <div className="flex items-center gap-2 mb-4">
          <Clock className="w-5 h-5 text-primary-500" />
          <h3 className="text-sm font-semibold text-neutral-800">Business Hours</h3>
        </div>
        <p className="text-xs text-neutral-400 mb-4">Set when you're available for support. Outside these hours, the auto-responder handles incoming messages.</p>
        <div className="space-y-2">
          {hours.length === 0 ? (
            <p className="text-sm text-neutral-400 text-center py-4">No business hours configured. You'll appear as always available.</p>
          ) : (
            hours.map((day) => (
              <div key={day.id} className="flex items-center gap-3 p-3 rounded-lg bg-neutral-50">
                <div className="w-24 flex-shrink-0">
                  <span className="text-sm font-medium text-neutral-700">{DAYS[day.day_of_week]}</span>
                </div>
                <button onClick={() => update(day.id, { is_working_day: !day.is_working_day })}
                  className={`p-1 flex-shrink-0 ${day.is_working_day ? 'text-primary-500' : 'text-neutral-300'}`}>
                  {day.is_working_day ? <ToggleRight className="w-6 h-6" /> : <ToggleLeft className="w-6 h-6" />}
                </button>
                {day.is_working_day ? (
                  <div className="flex items-center gap-2 flex-1">
                    <input type="time" value={day.open_time} onChange={(e) => update(day.id, { open_time: e.target.value })}
                      className="px-2 py-1 text-sm rounded border border-neutral-200 bg-white" />
                    <span className="text-xs text-neutral-400">to</span>
                    <input type="time" value={day.close_time} onChange={(e) => update(day.id, { close_time: e.target.value })}
                      className="px-2 py-1 text-sm rounded border border-neutral-200 bg-white" />
                  </div>
                ) : (
                  <span className="text-sm text-neutral-400">Day off</span>
                )}
              </div>
            ))
          )}
        </div>
        {hours.length > 0 && (
          <div className="mt-4">
            <label className="text-sm font-medium text-neutral-700 mb-1.5 block">Timezone</label>
            <select value={hours[0]?.timezone ?? 'America/New_York'}
              onChange={(e) => hours.forEach((h) => update(h.id, { timezone: e.target.value }))} className="input">
              {TIMEZONES.map((tz) => <option key={tz} value={tz}>{tz.replace('_', ' ')}</option>)}
            </select>
          </div>
        )}
      </div>

      <div className="card p-5">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-accent-50 flex items-center justify-center">
              <MessageCircle className="w-5 h-5 text-accent-500" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-neutral-800">Auto-Responder</h3>
              <p className="text-xs text-neutral-400 mt-0.5 max-w-md">Automatically replies to customers who message you outside your business hours.</p>
            </div>
          </div>
          <button onClick={() => { const next = !autoResponder; persistSolo({ auto_responder_enabled: next }); }} className="p-1">
            {autoResponder ? <ToggleRight className="w-8 h-8 text-primary-500" /> : <ToggleLeft className="w-8 h-8 text-neutral-300" />}
          </button>
        </div>
        {autoResponder && (
          <div>
            <label className="text-sm font-medium text-neutral-700 mb-1.5 block">Auto-Reply Message</label>
            <textarea value={draftMsg || solo.auto_responder_message} onChange={(e) => setDraftMsg(e.target.value)} rows={3} className="input resize-none text-sm" />
            <button onClick={() => { persistSolo({ auto_responder_message: draftMsg || solo.auto_responder_message }); toast('Auto-responder saved', 'success'); }} className="btn-secondary mt-3 text-sm">
              <Save className="w-4 h-4" /> Save Message
            </button>
          </div>
        )}
      </div>

      <div className="flex items-start gap-3 p-4 rounded-xl bg-primary-50/30 border border-primary-100">
        <Info className="w-5 h-5 text-primary-500 flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-medium text-primary-800">Solo Creator Tips</p>
          <ul className="text-xs text-primary-600 mt-1.5 space-y-1">
            <li>• Set realistic business hours — customers respect transparency over 24/7 promises</li>
            <li>• Use saved replies for your top 5 most common questions to save hours per week</li>
            <li>• Enable follow-up reminders so no customer falls through the cracks</li>
            <li>• The AI assistant handles simple queries automatically, freeing you for complex issues</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
