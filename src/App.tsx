import { createContext, useContext, useEffect, useState } from 'react';
import { Navigate, Outlet, Route, Routes, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { AppShell, type PageId, type ViewMode } from '@/components/AppShell';
import { AuthPage, UpdatePasswordPage } from '@/pages/AuthPage';
import { CreateWorkspacePage } from '@/pages/CreateWorkspacePage';
import { DashboardPage } from '@/pages/DashboardPage';
import { TicketsPage } from '@/pages/TicketsPage';
import { ChatPage } from '@/pages/ChatPage';
import { KnowledgePage } from '@/pages/KnowledgePage';
import { GdprPage } from '@/pages/GdprPage';
import { TenantsPage } from '@/pages/TenantsPage';
import { IntegrationsPage } from '@/pages/IntegrationsPage';
import { IntegrationPage } from '@/pages/IntegrationPage';
import { OnboardingPage } from '@/pages/OnboardingPage';
import { RoutingRulesPage } from '@/pages/RoutingRulesPage';
import { BillingPage } from '@/pages/BillingPage';
import { TeamPage } from '@/pages/TeamPage';
import { InboxPage } from '@/pages/InboxPage';
import { SavedRepliesPage } from '@/pages/SavedRepliesPage';
import { SoloSettingsPage } from '@/pages/SoloSettingsPage';
import { HelpArticlePage, HelpCenterHomePage, HelpContactPage } from '@/pages/HelpCenterPage';
import { TicketStatusPage } from '@/pages/TicketStatusPage';
import { WidgetPage } from '@/pages/WidgetPage';
import { useAuth } from '@/hooks/useAuth';
import { FullPageLoader, ErrorState } from '@/components/States';
import { pageFromPath, pathForPage } from '@/lib/pageRoutes';
import { canManageBilling, canManageIntegrations, canManageRouting, canManageTeam, hasPermission } from '@/lib/permissions';
import { useFollowUps, useSoloSettings } from '@/hooks/useSolopreneur';
import { convexConfigured } from '@/lib/convex';
import type { Tenant } from '@/types';

type ConsoleContextValue = {
  tenant: Tenant | null;
  tenants: Tenant[];
  viewMode: ViewMode;
  setViewMode: (mode: ViewMode) => void;
  setSelectedTenant: (tenant: Tenant | null) => void;
};

const ConsoleContext = createContext<ConsoleContextValue | null>(null);

function useConsole() {
  const ctx = useContext(ConsoleContext);
  if (!ctx) throw new Error('Console routes must render inside ConsoleLayout');
  return ctx;
}

function ConsoleLayout() {
  const { session, user, loading: authLoading, signOut, currentRole, tenants: authTenants } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const page = pageFromPath(location.pathname);
  const [viewMode, setViewMode] = useState<ViewMode>('tenant');
  const [selectedTenant, setSelectedTenant] = useState<Tenant | null>(null);
  const tenants = authTenants;
  const { solo } = useSoloSettings(selectedTenant?.id ?? null);
  const soloMode = Boolean(solo.solo_mode);

  useEffect(() => {
    const tenantId = searchParams.get('tenant');
    if (tenantId) {
      const match = tenants.find((t) => t.id === tenantId);
      if (match) setSelectedTenant(match);
      return;
    }
    if (!selectedTenant && tenants.length > 0) setSelectedTenant(tenants[0]);
  }, [tenants, searchParams, selectedTenant]);

  const { overdue } = useFollowUps(selectedTenant?.id ?? null);

  const handleToggleView = () => {
    if (viewMode === 'tenant') {
      setViewMode('admin');
      setSelectedTenant(null);
      navigate('/dashboard');
    } else {
      setViewMode('tenant');
      setSelectedTenant(tenants[0] ?? null);
      navigate('/dashboard');
    }
  };

  if (authLoading) return <FullPageLoader />;
  if (!session || !user) return <Navigate to="/login" replace />;
  if (tenants.length === 0) return <Navigate to="/create-workspace" replace />;

  const go = (next: PageId) => {
    const integrationId = next === 'integration-detail' ? searchParams.get('id') ?? undefined : undefined;
    navigate(pathForPage(next, { integrationId }));
  };

  return (
    <ConsoleContext.Provider value={{ tenant: selectedTenant, tenants, viewMode, setViewMode, setSelectedTenant }}>
      <AppShell
        currentPage={page}
        onPageChange={go}
        selectedTenant={selectedTenant}
        onTenantChange={(t) => {
          setSelectedTenant(t);
          const next = new URLSearchParams(searchParams);
          next.set('tenant', t.id);
          setSearchParams(next);
          navigate({ pathname: '/dashboard', search: `?tenant=${t.id}` });
        }}
        tenants={tenants}
        viewMode={viewMode}
        onToggleView={handleToggleView}
        onSignOut={async () => { await signOut(); navigate('/login'); }}
        userEmail={user.email ?? ''}
        currentRole={currentRole}
        hideTeam={soloMode}
        showAdminToggle={tenants.length > 1}
        notificationCount={overdue.length}
        notifications={overdue.slice(0, 5).map((f) => `${f.customer_name ?? f.customer_email} follow-up overdue`)}
        onSearch={(q) => navigate(`/tickets?q=${encodeURIComponent(q)}`)}
        helpCenterHref={selectedTenant ? `/help/${selectedTenant.slug}` : null}
      >
        <Outlet />
      </AppShell>
    </ConsoleContext.Provider>
  );
}

function DashboardRoute() {
  const { tenant, tenants } = useConsole();
  return <DashboardPage tenant={tenant} tenants={tenants} />;
}

function InboxRoute() {
  const { tenant, tenants } = useConsole();
  return <InboxPage tenant={tenant} tenants={tenants} />;
}

function TicketsRoute() {
  const { tenant, tenants } = useConsole();
  return <TicketsPage tenant={tenant} tenants={tenants} />;
}

function ChatRoute() {
  const { tenant, tenants } = useConsole();
  return <ChatPage tenant={tenant} tenants={tenants} />;
}

function KnowledgeRoute() {
  const { tenant, tenants } = useConsole();
  return <KnowledgePage tenant={tenant} tenants={tenants} />;
}

function GdprRoute() {
  const { tenant, tenants } = useConsole();
  return <GdprPage tenant={tenant} tenants={tenants} />;
}

function TenantsRoute() {
  const { tenants, viewMode, setViewMode, setSelectedTenant } = useConsole();
  const navigate = useNavigate();
  if (viewMode !== 'admin') return <Navigate to="/dashboard" replace />;
  return (
    <TenantsPage
      tenants={tenants}
      loading={false}
      error={null}
      onTenantClick={(t) => {
        setSelectedTenant(t);
        setViewMode('tenant');
        navigate(`/dashboard?tenant=${t.id}`);
      }}
    />
  );
}

function RoutingRoute() {
  const { tenant } = useConsole();
  const { currentRole } = useAuth();
  if (!canManageRouting(currentRole)) return <ErrorState message="You do not have permission to manage routing." />;
  return <RoutingRulesPage tenant={tenant} />;
}

function BillingRoute() {
  const { tenant } = useConsole();
  const { currentRole } = useAuth();
  if (!canManageBilling(currentRole)) return <ErrorState message="You do not have permission to manage billing." />;
  return <BillingPage tenant={tenant} />;
}

function TeamRoute() {
  const { tenant } = useConsole();
  const { currentRole } = useAuth();
  if (!canManageTeam(currentRole) && !hasPermission(currentRole, 'team:view')) {
    return <ErrorState message="You do not have permission to view the team." />;
  }
  return <TeamPage tenant={tenant} />;
}

function SavedRepliesRoute() {
  const { tenant } = useConsole();
  return <SavedRepliesPage tenant={tenant} />;
}

function SoloSettingsRoute() {
  const { tenant } = useConsole();
  return <SoloSettingsPage tenant={tenant} />;
}

function IntegrationsRoute() {
  const { tenant } = useConsole();
  const navigate = useNavigate();
  return (
    <IntegrationsPage
      tenant={tenant}
      onOpenIntegration={(id) => navigate(`/integrations/${id}`)}
      onCreateIntegration={() => navigate('/integrations/new')}
    />
  );
}

function NewIntegrationRoute() {
  const { tenant } = useConsole();
  const { currentRole } = useAuth();
  const navigate = useNavigate();
  if (!canManageIntegrations(currentRole)) return <ErrorState message="You do not have permission to manage integrations." />;
  return (
    <OnboardingPage
      tenant={tenant}
      onCompleted={(id) => navigate(`/integrations/${id}`)}
      onCancel={() => navigate('/integrations')}
    />
  );
}

function IntegrationRoute() {
  const { integrationId } = useParams();
  const navigate = useNavigate();
  return <IntegrationPage integrationId={integrationId ?? null} onBack={() => navigate('/integrations')} />;
}

export default function App() {
  if (!convexConfigured) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-neutral-50">
        <div className="max-w-md w-full card p-8">
          <h1 className="text-lg font-semibold text-neutral-900 mb-2">Missing Convex config</h1>
          <p className="text-sm text-neutral-500">
            Create a <code className="text-neutral-800">.env</code> file with
            {' '}VITE_CONVEX_URL, run <code className="text-neutral-800">npx convex dev</code>, then restart the Vite server.
          </p>
        </div>
      </div>
    );
  }

  return (
    <Routes>
      <Route path="/help/:slug" element={<HelpCenterHomePage />} />
      <Route path="/help/:slug/contact" element={<HelpContactPage />} />
      <Route path="/help/:slug/:articleSlug" element={<HelpArticlePage />} />
      <Route path="/ticket/:ticketId" element={<TicketStatusPage />} />
      <Route path="/ticket" element={<TicketStatusPage />} />
      <Route path="/widget/:integrationId" element={<WidgetPage />} />
      <Route path="/login" element={<AuthPage />} />
      <Route path="/create-workspace" element={<CreateWorkspacePage />} />
      <Route path="/update-password" element={<UpdatePasswordPage />} />
      <Route element={<ConsoleLayout />}>
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard" element={<DashboardRoute />} />
        <Route path="/inbox" element={<InboxRoute />} />
        <Route path="/tickets" element={<TicketsRoute />} />
        <Route path="/tickets/:ticketId" element={<TicketsRoute />} />
        <Route path="/chat" element={<ChatRoute />} />
        <Route path="/chat/:conversationId" element={<ChatRoute />} />
        <Route path="/knowledge" element={<KnowledgeRoute />} />
        <Route path="/gdpr" element={<GdprRoute />} />
        <Route path="/tenants" element={<TenantsRoute />} />
        <Route path="/routing" element={<RoutingRoute />} />
        <Route path="/pricing" element={<Navigate to="/billing" replace />} />
        <Route path="/billing" element={<BillingRoute />} />
        <Route path="/team" element={<TeamRoute />} />
        <Route path="/saved-replies" element={<SavedRepliesRoute />} />
        <Route path="/solo-settings" element={<SoloSettingsRoute />} />
        <Route path="/integrations" element={<IntegrationsRoute />} />
        <Route path="/integrations/new" element={<NewIntegrationRoute />} />
        <Route path="/integrations/:integrationId" element={<IntegrationRoute />} />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Route>
    </Routes>
  );
}
