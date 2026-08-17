import { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { Loader2, ArrowRight, Mail, Building2, UserPlus } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { FullPageLoader } from '@/components/States';

export function AuthPage() {
  const { signIn, signUp, acceptInvite, resetPassword, session, loading: authLoading, tenants } = useAuth();
  const navigate = useNavigate();
  const params = new URLSearchParams(window.location.search);
  const initialMode = params.get('invite') ? 'invite' : 'signin';
  const [mode, setMode] = useState<'signin' | 'signup' | 'invite' | 'reset'>(initialMode);
  const [email, setEmail] = useState(params.get('email') ?? '');
  const [password, setPassword] = useState('');
  const [tenantName, setTenantName] = useState('');
  const [inviteToken] = useState(params.get('invite') ?? '');
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  if (authLoading) return <FullPageLoader />;
  if (session) return <Navigate to={tenants.length === 0 ? '/create-workspace' : '/dashboard'} replace />;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setInfo(null);
    setLoading(true);
    if (mode === 'signin') {
      const { error } = await signIn(email, password);
      if (error) setError(error);
      else navigate('/dashboard');
    } else if (mode === 'signup') {
      if (!tenantName.trim()) {
        setError('Organization name is required');
        setLoading(false);
        return;
      }
      const { error } = await signUp(email, password, tenantName);
      if (error) setError(error);
      else navigate('/dashboard');
    } else if (mode === 'invite') {
      const { error } = await acceptInvite(email, password, inviteToken);
      if (error) setError(error);
      else navigate('/dashboard');
    } else if (mode === 'reset') {
      const { error } = await resetPassword(email);
      if (error) setError(error);
      else setInfo('Check your email for a reset link.');
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-neutral-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="flex items-center justify-center gap-3 mb-8">
          <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-primary-500 to-accent-500 flex items-center justify-center shadow-sm">
            <svg viewBox="0 0 24 24" className="w-6 h-6 text-white" fill="none" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
          </div>
          <div>
            <h1 className="text-xl font-bold text-neutral-900">MSE Console</h1>
            <p className="text-xs text-neutral-400">Multi-tenant Support Engine</p>
          </div>
        </div>

        <div className="card p-8">
          {mode === 'invite' ? (
            <>
              <div className="flex items-center gap-2 mb-1">
                <UserPlus className="w-5 h-5 text-primary-500" />
                <h2 className="text-lg font-semibold text-neutral-900">Accept Team Invitation</h2>
              </div>
              <p className="text-sm text-neutral-500 mb-6">Create your account to join the team.</p>
            </>
          ) : mode === 'reset' ? (
            <>
              <h2 className="text-lg font-semibold text-neutral-900 mb-1">Reset password</h2>
              <p className="text-sm text-neutral-500 mb-6">We will email you a link to choose a new password.</p>
            </>
          ) : (
            <>
              <h2 className="text-lg font-semibold text-neutral-900 mb-1">
                {mode === 'signin' ? 'Welcome back' : 'Create your account'}
              </h2>
              <p className="text-sm text-neutral-500 mb-6">
                {mode === 'signin'
                  ? 'Sign in to manage your support operations.'
                  : 'Start your 14-day free trial. No credit card required.'}
              </p>
            </>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === 'signup' && (
              <div>
                <label className="text-sm font-medium text-neutral-700 mb-1.5 block">Organization Name</label>
                <div className="relative">
                  <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
                  <input type="text" value={tenantName} onChange={(e) => setTenantName(e.target.value)}
                    className="input pl-10" placeholder="Acme Corp" required />
                </div>
              </div>
            )}
            <div>
              <label className="text-sm font-medium text-neutral-700 mb-1.5 block">Email</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                  className="input pl-10" placeholder="you@company.com" required />
              </div>
            </div>
            {mode !== 'reset' && (
              <div>
                <label className="text-sm font-medium text-neutral-700 mb-1.5 block">Password</label>
                <input type="password" value={password} onChange={(e) => setPassword(e.target.value)}
                    className="input" placeholder="••••••••" required minLength={8} />
              </div>
            )}

            {error && <div className="px-4 py-3 rounded-lg bg-danger-50 text-danger-700 text-sm">{error}</div>}
            {info && <div className="px-4 py-3 rounded-lg bg-success-50 text-success-700 text-sm">{info}</div>}

            <button type="submit" disabled={loading} className="btn-primary w-full justify-center">
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4" />}
              {mode === 'signin' ? 'Sign In' : mode === 'signup' ? 'Create Account' : mode === 'invite' ? 'Accept Invitation' : 'Send reset link'}
            </button>
          </form>

          {mode !== 'invite' && (
            <div className="mt-6 text-center space-y-2">
              {mode === 'signin' && (
                <button onClick={() => { setMode('reset'); setError(null); }} className="block w-full text-sm text-neutral-500 hover:text-neutral-700">
                  Forgot password?
                </button>
              )}
              <button
                onClick={() => { setMode(mode === 'signup' ? 'signin' : 'signup'); setError(null); setInfo(null); }}
                className="text-sm text-primary-600 hover:text-primary-700 font-medium"
              >
                {mode === 'signup' ? 'Already have an account? Sign in' : "Don't have an account? Sign up"}
              </button>
            </div>
          )}
        </div>

        <p className="text-center text-xs text-neutral-400 mt-6">
          Need help as a customer? Ask your provider for their <Link to="/" className="underline">help center</Link> link.
        </p>
      </div>
    </div>
  );
}

export function UpdatePasswordPage() {
  const { updatePassword } = useAuth();
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await updatePassword(password);
    setLoading(false);
    if (error) setError(error);
    else navigate('/dashboard');
  };

  return (
    <div className="min-h-screen bg-neutral-50 flex items-center justify-center p-4">
      <form onSubmit={handleSubmit} className="card p-8 w-full max-w-md space-y-4">
        <h1 className="text-lg font-semibold text-neutral-900">Choose a new password</h1>
        <input type="password" className="input" minLength={8} required value={password} onChange={(e) => setPassword(e.target.value)} />
        {error && <div className="px-4 py-3 rounded-lg bg-danger-50 text-danger-700 text-sm">{error}</div>}
        <button className="btn-primary w-full" disabled={loading}>{loading ? 'Saving…' : 'Update password'}</button>
      </form>
    </div>
  );
}
