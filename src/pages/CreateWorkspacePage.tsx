import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { Building2, Loader2, ArrowRight } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { FullPageLoader } from '@/components/States';

export function CreateWorkspacePage() {
  const { session, user, loading, tenants, createWorkspace, signOut } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  if (loading) return <FullPageLoader />;
  if (!session || !user) return <Navigate to="/login" replace />;
  if (tenants.length > 0) return <Navigate to="/dashboard" replace />;

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
            <Building2 className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-neutral-900">Create your workspace</h1>
            <p className="text-xs text-neutral-400">Finish setting up {user.email}</p>
          </div>
        </div>

        <div className="card p-8">
          <p className="text-sm text-neutral-500 mb-6">
            Your account is ready, but it is not in a workspace yet. Name the organization to continue.
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
                  autoFocus
                />
              </div>
            </div>

            {error && <div className="px-4 py-3 rounded-lg bg-danger-50 text-danger-700 text-sm">{error}</div>}

            <button type="submit" disabled={saving} className="btn-primary w-full justify-center">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4" />}
              Create workspace
            </button>
          </form>

          <p className="text-xs text-neutral-400 mt-6">
            Have a team invite? Open the invite link from your email instead of creating a new workspace.
          </p>
        </div>

        <button
          type="button"
          onClick={async () => {
            await signOut();
            navigate('/login');
          }}
          className="block w-full text-center text-sm text-neutral-500 hover:text-neutral-700 mt-6"
        >
          Sign out
        </button>
      </div>
    </div>
  );
}
