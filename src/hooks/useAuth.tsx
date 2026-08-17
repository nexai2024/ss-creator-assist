import { createContext, useContext, useState, useEffect, useCallback, useRef, type ReactNode } from 'react';
import { useAuthActions } from '@convex-dev/auth/react';
import { useConvexAuth, useMutation, useQuery } from 'convex/react';
import { api } from '../../convex/_generated/api';
import type { Id } from '../../convex/_generated/dataModel';
import type { Tenant, RoleTier, TenantMember } from '@/types';

export type AuthUser = {
  id: string;
  email: string;
  name?: string;
};

export type AuthSession = {
  user: AuthUser;
};

type AuthContextValue = {
  session: AuthSession | null;
  user: AuthUser | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signUp: (email: string, password: string, tenantName: string) => Promise<{ error: string | null }>;
  acceptInvite: (email: string, password: string, token: string) => Promise<{ error: string | null }>;
  resetPassword: (email: string) => Promise<{ error: string | null }>;
  updatePassword: (password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  createWorkspace: (name: string) => Promise<{ error: string | null }>;
  tenants: Tenant[];
  activeTenant: Tenant | null;
  setActiveTenant: (t: Tenant) => void;
  currentRole: RoleTier | null;
  currentMembership: TenantMember | null;
  refreshMembership: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

function toError(err: unknown): string {
  return err instanceof Error ? err.message : 'Something went wrong';
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const { isLoading, isAuthenticated } = useConvexAuth();
  const { signIn: authSignIn, signOut: authSignOut } = useAuthActions();
  const createTenant = useMutation(api.tenants.createForSignup);
  const acceptInviteMut = useMutation(api.team.acceptInvite);
  const authenticatedRef = useRef(false);

  useEffect(() => {
    authenticatedRef.current = isAuthenticated;
  }, [isAuthenticated]);

  const waitForAuth = useCallback(async () => {
    if (authenticatedRef.current) return;
    await new Promise<void>((resolve, reject) => {
      const started = Date.now();
      const id = window.setInterval(() => {
        if (authenticatedRef.current) {
          window.clearInterval(id);
          resolve();
        } else if (Date.now() - started > 10_000) {
          window.clearInterval(id);
          reject(new Error('Signed up, but the session is not ready yet. Try signing in.'));
        }
      }, 50);
    });
  }, []);
  const currentUser = useQuery(api.users.current, isAuthenticated ? {} : 'skip');
  const tenantRows = useQuery(api.tenants.listMine, isAuthenticated ? {} : 'skip');

  const [activeTenant, setActiveTenant] = useState<Tenant | null>(null);

  const user: AuthUser | null = currentUser
    ? { id: currentUser.id, email: currentUser.email, name: currentUser.name }
    : null;
  const session: AuthSession | null = isAuthenticated && user ? { user } : null;
  const tenants: Tenant[] = (tenantRows ?? []).map((row) => ({
    id: row.id,
    name: row.name,
    slug: row.slug,
    plan_tier: row.plan_tier,
    status: row.status,
    monthly_active_users: row.monthly_active_users,
    included_maus: row.included_maus,
    overage_rate: row.overage_rate,
    sla_uptime: row.sla_uptime,
    created_at: row.created_at,
  }));

  const membership = useQuery(
    api.tenants.myMembership,
    isAuthenticated && activeTenant ? { tenantId: activeTenant.id as Id<'tenants'> } : 'skip',
  );

  useEffect(() => {
    if (!isAuthenticated) {
      setActiveTenant(null);
      return;
    }
    if (tenants.length === 0) {
      setActiveTenant(null);
      return;
    }
    setActiveTenant((prev) => {
      if (prev && tenants.some((t) => t.id === prev.id)) return prev;
      return tenants[0];
    });
  }, [isAuthenticated, tenants]);

  const signIn = useCallback(async (email: string, password: string) => {
    try {
      await authSignIn('password', { email, password, flow: 'signIn' });
      return { error: null };
    } catch (err) {
      return { error: toError(err) };
    }
  }, [authSignIn]);

  const signUp = useCallback(async (email: string, password: string, tenantName: string) => {
    try {
      await authSignIn('password', { email, password, flow: 'signUp', tenantName });
      // JWT is stored, but the Convex React client attaches it on the next render.
      await waitForAuth();
      await createTenant({ name: tenantName });
      return { error: null };
    } catch (err) {
      return { error: toError(err) };
    }
  }, [authSignIn, createTenant, waitForAuth]);

  const acceptInvite = useCallback(async (email: string, password: string, token: string) => {
    try {
      try {
        await authSignIn('password', { email, password, flow: 'signUp', inviteToken: token });
      } catch {
        await authSignIn('password', { email, password, flow: 'signIn' });
      }
      await waitForAuth();
      await acceptInviteMut({ token });
      return { error: null };
    } catch (err) {
      return { error: toError(err) };
    }
  }, [authSignIn, acceptInviteMut, waitForAuth]);

  const resetPassword = useCallback(async (email: string) => {
    try {
      await authSignIn('password', { email, flow: 'reset' });
      return { error: null };
    } catch (err) {
      return { error: toError(err) };
    }
  }, [authSignIn]);

  const updatePassword = useCallback(async (password: string) => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code') ?? '';
    const email = params.get('email') ?? user?.email ?? '';
    if (!code || !email) {
      return { error: 'Open the reset link from your email to choose a new password.' };
    }
    try {
      await authSignIn('password', { email, code, newPassword: password, flow: 'reset-verification' });
      return { error: null };
    } catch (err) {
      return { error: toError(err) };
    }
  }, [authSignIn, user?.email]);

  const signOut = useCallback(async () => {
    await authSignOut();
    setActiveTenant(null);
  }, [authSignOut]);

  const createWorkspace = useCallback(async (name: string) => {
    try {
      await createTenant({ name: name.trim() });
      return { error: null };
    } catch (err) {
      return { error: toError(err) };
    }
  }, [createTenant]);

  const refreshMembership = useCallback(async () => {}, []);

  const loading = isLoading || (isAuthenticated && (currentUser === undefined || tenantRows === undefined));

  return (
    <AuthContext.Provider value={{
      session, user, loading,
      signIn, signUp, acceptInvite, resetPassword, updatePassword, signOut, createWorkspace,
      tenants, activeTenant, setActiveTenant,
      currentRole: membership?.role ?? null,
      currentMembership: membership as TenantMember | null,
      refreshMembership,
    }}>
      {children}
    </AuthContext.Provider>
  );
}
