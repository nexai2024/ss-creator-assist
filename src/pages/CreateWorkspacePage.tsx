import { useState } from 'react';
import { Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { Building2, Loader2, ArrowRight, UserPlus } from 'lucide-react';
import { useQuery } from 'convex/react';
import { useAuth } from '@/hooks/useAuth';
import { FullPageLoader } from '@/components/States';
import { api } from '../../convex/_generated/api';

const ROLE_LABEL: Record<string, string> = {
  admin: 'Admin',
  manager: 'Manager',
  senior_agent: 'Senior agent',
  junior_agent: 'Junior agent',
  read_only: 'Read only',
};

export function CreateWorkspacePage() {
  const { session, user, loading, tenants, createWorkspace, joinInvite, signOut } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const inviteToken = searchParams.get('invite') ?? '';
  const peeked = useQuery(api.team.peekInvite, inviteToken ? { token: inviteToken } : 'skip');
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [joining, setJoining] = useState(false);

  if (loading) return <FullPageLoader />;
  if (!session || !user) {
    const login = inviteToken
      ? `/login?invite=${encodeURIComponent(inviteToken)}`
      : '/login';
    return <Navigate to={login} replace />;
  }
  if (tenants.length > 0 && !inviteToken) return <Navigate to="/dashboard" replace />;

  const inviteExpired = peeked ? peeked.expires_at < Date.now() : false;
  const inviteReady = Boolean(peeked && !peeked.used && !inviteExpired);
  const inviteBlocked = Boolean(inviteToken && peeked && (peeked.used || inviteExpired));

  const handleJoin = async () => {
    if (!inviteToken) return;
    setError(null);
    setJoining(true);
    const { error: joinError } = await joinInvite(inviteToken);
    setJoining(false);
    if (joinError) {
      setError(joinError);
      return;
    }
    navigate('/dashboard', { replace: true });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      setError('Organization name is required');
      return;
    }
    setError(null);
    setSaving(true);
    const { error: createError } = await createWorkspace(trimmed);
    setSaving(false);
    if (createError) {
      setError(createError);
      return;
    }
    navigate('/dashboard', { replace: true });
  };

  return (
    <div className="min-h-screen bg-neutral-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="flex items-center justify-center gap-3 mb-8">
          <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-primary-500 to-accent-500 flex items-center justify-center shadow-sm">
            {inviteToken ? <UserPlus className="w-6 h-6 text-white" /> : <Building2 className="w-6 h-6 text-white" />}
          </div>
          <div>
            <h1 className="text-xl font-bold text-neutral-900">
              {inviteToken ? 'Join a workspace' : 'Create your workspace'}
            </h1>
            <p className="text-xs text-neutral-400">Signed in as {user.email}</p>
          </div>
        </div>

        <div className="card p-8">
          {inviteToken && peeked === undefined && (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-5 h-5 animate-spin text-neutral-400" />
            </div>
          )}

          {inviteToken && peeked === null && (
            <div className="px-4 py-3 rounded-lg bg-danger-50 text-danger-700 text-sm mb-6">
              This invite link is invalid. Create a workspace below or ask your admin for a new invite.
            </div>
          )}

          {inviteBlocked && peeked && (
            <div className="px-4 py-3 rounded-lg bg-danger-50 text-danger-700 text-sm mb-6">
              {peeked.used ? 'This invite has already been used.' : 'This invite has expired.'}{' '}
              {tenants.length === 0 ? 'Create a workspace below or ask your admin for a new invite.' : 'Return to your dashboard or ask for a new invite.'}
            </div>
          )}

          {inviteReady && peeked && (
            <div className="mb-6">
              <p className="text-sm text-neutral-500 mb-4">
                You were invited to join <span className="font-medium text-neutral-800">{peeked.tenant_name}</span> as{' '}
                {ROLE_LABEL[peeked.role] ?? peeked.role}.
              </p>
              <dl className="rounded-lg border border-neutral-100 divide-y divide-neutral-50 text-sm mb-4">
                <div className="flex justify-between px-4 py-2.5">
                  <dt className="text-neutral-400">Workspace</dt>
                  <dd className="font-medium text-neutral-800">{peeked.tenant_name}</dd>
                </div>
                <div className="flex justify-between px-4 py-2.5">
                  <dt className="text-neutral-400">Role</dt>
                  <dd className="font-medium text-neutral-800">{ROLE_LABEL[peeked.role] ?? peeked.role}</dd>
                </div>
                <div className="flex justify-between px-4 py-2.5">
                  <dt className="text-neutral-400">Invite email</dt>
                  <dd className="font-medium text-neutral-800">{peeked.email}</dd>
                </div>
              </dl>
              {user.email.toLowerCase() !== peeked.email.toLowerCase() && (
                <p className="text-xs text-warning-700 bg-warning-50 rounded-lg px-3 py-2 mb-4">
                  This invite is for {peeked.email}. Sign in with that address to join.
                </p>
              )}
              {error && <div className="px-4 py-3 rounded-lg bg-danger-50 text-danger-700 text-sm mb-4">{error}</div>}
              <button
                type="button"
                disabled={joining || user.email.toLowerCase() !== peeked.email.toLowerCase()}
                onClick={() => void handleJoin()}
                className="btn-primary w-full justify-center"
              >
                {joining ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
                Join workspace
              </button>
            </div>
          )}

          {tenants.length === 0 && (
            <>
              {inviteToken && <div className="border-t border-neutral-100 pt-6 mt-2" />}
              <p className="text-sm text-neutral-500 mb-6">
                {inviteToken
                  ? 'Or create your own organization instead of joining.'
                  : 'Your account is ready, but it is not in a workspace yet. Name the organization to continue.'}
              </p>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-neutral-700 mb-1.5 block">Organization name</label>
                  <div className="relative">
                    <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="input pl-10"
                      placeholder="Acme Corp"
                      required
                      autoFocus={!inviteToken}
                    />
                  </div>
                </div>

                {error && !inviteReady && <div className="px-4 py-3 rounded-lg bg-danger-50 text-danger-700 text-sm">{error}</div>}

                <button type="submit" disabled={saving} className={inviteToken ? 'btn-secondary w-full justify-center' : 'btn-primary w-full justify-center'}>
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4" />}
                  Create workspace
                </button>
              </form>
            </>
          )}

          {tenants.length > 0 && inviteToken && (
            <>
              {error && <div className="px-4 py-3 rounded-lg bg-danger-50 text-danger-700 text-sm mb-4">{error}</div>}
              <button type="button" onClick={() => navigate('/dashboard')} className="btn-secondary w-full justify-center mt-2">
                Go to dashboard
              </button>
            </>
          )}

          {!inviteToken && tenants.length === 0 && (
            <p className="text-xs text-neutral-400 mt-6">
              Have a team invite? Open the invite link from your email to join instead of creating a second workspace.
            </p>
          )}
        </div>

        <button
          type="button"
          onClick={async () => {
            await signOut();
            navigate(inviteToken ? `/login?invite=${encodeURIComponent(inviteToken)}` : '/login');
          }}
          className="block w-full text-center text-sm text-neutral-500 hover:text-neutral-700 mt-6"
        >
          Sign out
        </button>
      </div>
    </div>
  );
}
