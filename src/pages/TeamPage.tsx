import { useState } from 'react';
import {
  UserPlus, Trash2, Crown, Shield, Star, User, Eye, Mail, Clock,
  Copy, Check, AlertCircle, X, Loader2,
} from 'lucide-react';
import type { Tenant, TeamInvite, RoleTier, TeamMemberWithEmail } from '@/types';
import { ROLE_DISPLAY, ROLE_DESCRIPTIONS, ALL_ROLE_TIERS, canManageTeam } from '@/lib/permissions';
import { useAuth } from '@/hooks/useAuth';
import { EmptyState, ErrorState, TableSkeleton } from '@/components/States';
import { useToast } from '@/components/Toast';
import { useMutation, useQuery } from 'convex/react';
import { api } from '../../convex/_generated/api';
import type { Id } from '../../convex/_generated/dataModel';

export function TeamPage({ tenant }: { tenant: Tenant | null }) {
  const { user, currentRole } = useAuth();
  const { toast } = useToast();
  const members = (useQuery(
    api.team.members,
    tenant ? { tenantId: tenant.id as Id<'tenants'> } : 'skip',
  ) ?? []) as TeamMemberWithEmail[];
  const inviteRows = useQuery(
    api.team.invites,
    tenant ? { tenantId: tenant.id as Id<'tenants'> } : 'skip',
  );
  const invites = ((inviteRows ?? []) as TeamInvite[]).filter((i) => !i.used_at);
  const changeRoleMut = useMutation(api.team.changeRole);
  const revokeMut = useMutation(api.team.revoke);
  const deleteInviteMut = useMutation(api.team.deleteInvite);
  const [showInvite, setShowInvite] = useState(false);
  const [copiedToken, setCopiedToken] = useState<string | null>(null);

  const canManage = canManageTeam(currentRole);
  const loading = Boolean(tenant) && inviteRows === undefined;
  const error = null;

  const handleChangeRole = async (userId: string, newRole: RoleTier) => {
    if (!tenant) return;
    try {
      await changeRoleMut({ tenantId: tenant.id as Id<'tenants'>, userId: userId as Id<'users'>, role: newRole });
      toast(`Role changed to ${ROLE_DISPLAY[newRole].label}`, 'success');
    } catch {
      toast('Failed to change role', 'error');
    }
  };

  const handleRevoke = async (userId: string) => {
    if (!tenant) return;
    try {
      await revokeMut({ tenantId: tenant.id as Id<'tenants'>, userId: userId as Id<'users'> });
      toast('Team member access revoked', 'success');
    } catch {
      toast('Failed to revoke access', 'error');
    }
  };

  const handleCancelInvite = async (inviteId: string) => {
    if (!tenant) return;
    try {
      await deleteInviteMut({ tenantId: tenant.id as Id<'tenants'>, inviteId: inviteId as Id<'teamInvites'> });
      toast('Invite cancelled', 'success');
    } catch {
      toast('Failed to cancel invite', 'error');
    }
  };

  const copyInviteLink = (token: string) => {
    const url = `${window.location.origin}/login?invite=${token}`;
    navigator.clipboard.writeText(url);
    setCopiedToken(token);
    setTimeout(() => setCopiedToken(null), 2000);
    toast('Invite link copied to clipboard', 'success');
  };

  if (!tenant) {
    return (
      <div className="animate-fade-in">
        <h1 className="text-2xl font-bold text-neutral-900 mb-2">Team</h1>
        <div className="card">
          <EmptyState icon={<UserPlus className="w-7 h-7" />} title="Select a tenant" description="Choose a tenant to manage team members." />
        </div>
      </div>
    );
  }

  if (loading) return <TableSkeleton />;
  if (error) return <ErrorState message={error} />;

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900">Team Members</h1>
          <p className="text-sm text-neutral-500 mt-1">
            {members.length} {members.length === 1 ? 'member' : 'members'} · {invites.length} pending {invites.length === 1 ? 'invite' : 'invites'} · {tenant.name}
          </p>
        </div>
        {canManage && (
          <button onClick={() => setShowInvite(true)} className="btn-primary">
            <UserPlus className="w-4 h-4" />
            Invite Member
          </button>
        )}
      </div>

      {/* Role legend */}
      <div className="card p-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {ALL_ROLE_TIERS.map((tier) => {
            const info = ROLE_DISPLAY[tier];
            const Icon = tier === 'admin' ? Crown : tier === 'manager' ? Shield : tier === 'senior_agent' ? Star : tier === 'junior_agent' ? User : Eye;
            return (
              <div key={tier} className="flex items-start gap-2.5 p-2.5 rounded-lg bg-neutral-50">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${info.bg}`}>
                  <Icon className={`w-4 h-4 ${info.color}`} />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-neutral-800">{info.label}</p>
                  <p className="text-xs text-neutral-400 line-clamp-2">{ROLE_DESCRIPTIONS[tier]}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Members list */}
      <div className="card overflow-hidden">
        <div className="px-5 py-4 border-b border-neutral-100">
          <h3 className="text-sm font-semibold text-neutral-800">Active Members</h3>
        </div>
        <div className="divide-y divide-neutral-50">
          {members.map((member) => {
            const info = ROLE_DISPLAY[member.role];
            const Icon = member.role === 'admin' ? Crown : member.role === 'manager' ? Shield : member.role === 'senior_agent' ? Star : member.role === 'junior_agent' ? User : Eye;
            const isCurrentUser = member.user_id === user?.id;
            return (
              <div key={member.user_id} className="flex items-center justify-between px-5 py-3.5">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary-400 to-accent-400 flex items-center justify-center text-white text-sm font-bold flex-shrink-0">
                    {member.email.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-neutral-800 truncate">
                      {member.email}
                      {isCurrentUser && <span className="text-xs text-neutral-400 ml-2">(you)</span>}
                    </p>
                    <p className="text-xs text-neutral-400">Joined {new Date(member.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {canManage && !isCurrentUser ? (
                    <>
                      <select
                        value={member.role}
                        onChange={(e) => handleChangeRole(member.user_id, e.target.value as RoleTier)}
                        className={`text-xs font-medium rounded-full px-3 py-1.5 border-0 cursor-pointer ${info.bg} ${info.color}`}
                      >
                        {ALL_ROLE_TIERS.map((t) => (
                          <option key={t} value={t}>{ROLE_DISPLAY[t].label}</option>
                        ))}
                      </select>
                      <button onClick={() => handleRevoke(member.user_id)} className="p-1.5 rounded-lg text-danger-500 hover:bg-danger-50" title="Revoke access">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </>
                  ) : (
                    <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium ${info.bg} ${info.color}`}>
                      <Icon className="w-3.5 h-3.5" />
                      {info.label}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Pending invites */}
      {invites.length > 0 && (
        <div className="card overflow-hidden">
          <div className="px-5 py-4 border-b border-neutral-100">
            <h3 className="text-sm font-semibold text-neutral-800">Pending Invitations</h3>
          </div>
          <div className="divide-y divide-neutral-50">
            {invites.map((invite) => {
              const info = ROLE_DISPLAY[invite.role];
              const expired = new Date(invite.expires_at) < new Date();
              return (
                <div key={invite.id} className="flex items-center justify-between px-5 py-3.5">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-lg bg-neutral-100 flex items-center justify-center flex-shrink-0">
                      <Mail className="w-4 h-4 text-neutral-400" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-neutral-800 truncate">{invite.email}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${info.bg} ${info.color}`}>
                          {info.label}
                        </span>
                        <span className={`text-xs flex items-center gap-1 ${expired ? 'text-danger-500' : 'text-neutral-400'}`}>
                          <Clock className="w-3 h-3" />
                          {expired ? 'Expired' : `Expires ${new Date(invite.expires_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {!expired && (
                      <button onClick={() => copyInviteLink(invite.token)} className="btn-secondary text-xs py-1.5 px-3">
                        {copiedToken === invite.token ? <Check className="w-3.5 h-3.5 text-success-500" /> : <Copy className="w-3.5 h-3.5" />}
                        {copiedToken === invite.token ? 'Copied' : 'Copy Link'}
                      </button>
                    )}
                    {canManage && (
                      <button onClick={() => handleCancelInvite(invite.id)} className="p-1.5 rounded-lg text-danger-500 hover:bg-danger-50" title="Cancel invite">
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Invite modal */}
      {showInvite && canManage && tenant && (
        <InviteModal
          tenant={tenant}
          onClose={() => setShowInvite(false)}
          onInvited={() => { setShowInvite(false); }}
        />
      )}

      {/* Read-only notice */}
      {!canManage && (
        <div className="flex items-start gap-2 p-3 rounded-lg bg-neutral-50 text-neutral-500 text-xs">
          <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <span>You have read-only access to the team list. Only Admins can invite members, change roles, or revoke access.</span>
        </div>
      )}
    </div>
  );
}

function InviteModal({ tenant, onClose, onInvited }: { tenant: Tenant; onClose: () => void; onInvited: () => void }) {
  const { toast } = useToast();
  const inviteMut = useMutation(api.team.invite);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<RoleTier>('junior_agent');
  const [submitting, setSubmitting] = useState(false);
  const [createdLink, setCreatedLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const handleSubmit = async () => {
    if (!email.trim()) return;
    setSubmitting(true);
    try {
      const token = await inviteMut({
        tenantId: tenant.id as Id<'tenants'>,
        email: email.trim(),
        role,
      });
      const link = `${window.location.origin}/login?invite=${token}&email=${encodeURIComponent(email.trim())}`;
      setCreatedLink(link);
      toast(`Invitation sent to ${email.trim()}`, 'success');
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed to send invite', 'error');
    }
    setSubmitting(false);
  };

  const copyLink = () => {
    if (createdLink) {
      navigator.clipboard.writeText(createdLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fade-in">
      <div className="absolute inset-0 bg-neutral-900/40 backdrop-blur-sm" onClick={onClose} />
      <div role="dialog" aria-modal="true" className="relative max-w-md w-full bg-white rounded-2xl shadow-2xl border border-neutral-200 animate-slide-up overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-100">
          <div className="flex items-center gap-2">
            <UserPlus className="w-5 h-5 text-primary-500" />
            <h2 className="text-lg font-semibold text-neutral-900">Invite Team Member</h2>
          </div>
          <button onClick={onClose} aria-label="Close" className="p-1.5 rounded-lg text-neutral-400 hover:bg-neutral-100">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="px-6 py-5 space-y-4">
          {createdLink ? (
            <div className="space-y-3">
              <div className="flex items-center gap-2 p-3 rounded-lg bg-success-50 text-success-700 text-sm">
                <Check className="w-4 h-4" />
                Invitation created! Share this link with the invitee:
              </div>
              <div className="p-3 rounded-lg bg-neutral-50 border border-neutral-200">
                <p className="text-xs text-neutral-500 mb-1">Invitation link (expires in 48 hours):</p>
                <p className="text-sm font-mono text-neutral-700 break-all">{createdLink}</p>
              </div>
              <button onClick={copyLink} className="btn-primary w-full justify-center">
                {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                {copied ? 'Copied!' : 'Copy Link'}
              </button>
              <button onClick={onInvited} className="btn-secondary w-full justify-center">Done</button>
            </div>
          ) : (
            <>
              <div>
                <label className="text-sm font-medium text-neutral-700 mb-1.5 block">Email Address</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
                  <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                    className="input pl-10" placeholder="colleague@company.com" />
                </div>
              </div>
              <div>
                <label className="text-sm font-medium text-neutral-700 mb-1.5 block">Role</label>
                <div className="space-y-2">
                  {ALL_ROLE_TIERS.map((tier) => {
                    const info = ROLE_DISPLAY[tier];
                    const Icon = tier === 'admin' ? Crown : tier === 'manager' ? Shield : tier === 'senior_agent' ? Star : tier === 'junior_agent' ? User : Eye;
                    return (
                      <button key={tier} onClick={() => setRole(tier)} type="button"
                        className={`w-full flex items-start gap-3 p-3 rounded-lg border-2 transition-all text-left ${
                          role === tier ? 'border-primary-400 bg-primary-50/30' : 'border-neutral-200 hover:border-neutral-300'
                        }`}>
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${info.bg}`}>
                          <Icon className={`w-4 h-4 ${info.color}`} />
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-neutral-800">{info.label}</p>
                          <p className="text-xs text-neutral-400">{ROLE_DESCRIPTIONS[tier]}</p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button onClick={onClose} className="btn-secondary">Cancel</button>
                <button onClick={handleSubmit} disabled={submitting || !email.trim()} className="btn-primary">
                  {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
                  Send Invitation
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
