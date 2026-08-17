import { type ReactNode, useState } from 'react';
import {
  LayoutDashboard,
  Ticket,
  MessageSquare,
  BookOpen,
  ShieldCheck,
  Building2,
  Search,
  Bell,
  Menu,
  X,
  ChevronDown,
  Layers,
  Shield,
  User,
  Zap,
  CreditCard,
  Tag,
  LogOut,
  Users,
  Crown,
  Star,
  Eye,
  Inbox,
  Settings,
  MessageCircle,
} from 'lucide-react';
import type { Tenant, RoleTier } from '@/types';
import { PlanBadge, StatusBadge } from '@/components/Badges';
import { ROLE_DISPLAY } from '@/lib/permissions';

export type PageId = 'dashboard' | 'tickets' | 'chat' | 'knowledge' | 'gdpr' | 'tenants' | 'integrations' | 'integration-detail' | 'new-integration' | 'routing' | 'pricing' | 'billing' | 'team' | 'inbox' | 'saved-replies' | 'solo-settings';
export type ViewMode = 'tenant' | 'admin';

const navItems: { id: PageId; label: string; icon: typeof LayoutDashboard; adminOnly?: boolean }[] = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'inbox', label: 'Unified Inbox', icon: Inbox },
  { id: 'tickets', label: 'Tickets', icon: Ticket },
  { id: 'chat', label: 'Live Chat', icon: MessageSquare },
  { id: 'knowledge', label: 'Knowledge Base', icon: BookOpen },
  { id: 'gdpr', label: 'GDPR Compliance', icon: ShieldCheck },
  { id: 'tenants', label: 'Tenants & Plans', icon: Building2, adminOnly: true },
];

const configNavItems: { id: PageId; label: string; icon: typeof LayoutDashboard }[] = [
  { id: 'saved-replies', label: 'Saved Replies', icon: MessageCircle },
  { id: 'integrations', label: 'Integrations', icon: Layers },
  { id: 'routing', label: 'Routing Rules', icon: Zap },
  { id: 'team', label: 'Team', icon: Users },
  { id: 'billing', label: 'Billing', icon: CreditCard },
  { id: 'pricing', label: 'Pricing', icon: Tag },
  { id: 'solo-settings', label: 'Solo Settings', icon: Settings },
];

export function AppShell({
  currentPage,
  onPageChange,
  selectedTenant,
  onTenantChange,
  tenants,
  viewMode,
  onToggleView,
  onSignOut,
  userEmail,
  currentRole,
  children,
  hideTeam = false,
  showAdminToggle = true,
  notificationCount = 0,
  notifications = [],
  onSearch,
  helpCenterHref = null,
}: {
  currentPage: PageId;
  onPageChange: (page: PageId) => void;
  selectedTenant: Tenant | null;
  onTenantChange: (tenant: Tenant) => void;
  tenants: Tenant[];
  viewMode: ViewMode;
  onToggleView: () => void;
  onSignOut: () => void;
  userEmail: string;
  currentRole: RoleTier | null;
  children: ReactNode;
  hideTeam?: boolean;
  showAdminToggle?: boolean;
  notificationCount?: number;
  notifications?: string[];
  onSearch?: (query: string) => void;
  helpCenterHref?: string | null;
}) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [tenantMenuOpen, setTenantMenuOpen] = useState(false);
  const [tenantSearch, setTenantSearch] = useState('');
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [headerSearch, setHeaderSearch] = useState('');
  const [bellOpen, setBellOpen] = useState(false);
  const isAdmin = viewMode === 'admin';

  const visibleNavItems = navItems.filter((item) => !item.adminOnly || isAdmin);
  const visibleConfigItems = configNavItems.filter((item) => !(hideTeam && item.id === 'team'));
  const filteredTenants = tenantSearch
    ? tenants.filter((t) => t.name.toLowerCase().includes(tenantSearch.toLowerCase()) || t.id.toLowerCase().includes(tenantSearch.toLowerCase()))
    : tenants;

  return (
    <div className="min-h-screen bg-neutral-50 flex">
      {/* Sidebar */}
      <aside
        className={`fixed lg:sticky top-0 left-0 z-40 h-screen w-64 bg-white border-r border-neutral-200 flex flex-col transition-transform duration-300 ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        {/* Logo */}
        <div className="flex items-center justify-between px-5 h-16 border-b border-neutral-100">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary-500 to-accent-500 flex items-center justify-center shadow-sm">
              <svg viewBox="0 0 24 24" className="w-5 h-5 text-white" fill="none" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-bold text-neutral-900 leading-tight">MSE Console</p>
              <p className="text-[11px] text-neutral-400 leading-tight">
                {isAdmin ? 'Admin Overview' : 'Support Center'}
              </p>
            </div>
          </div>
          <button onClick={() => setMobileOpen(false)} className="lg:hidden p-1.5 rounded-lg text-neutral-400 hover:bg-neutral-100">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto scrollbar-thin">
          <p className="px-3 pb-2 text-[11px] font-semibold text-neutral-400 uppercase tracking-wider">Workspace</p>
          {visibleNavItems.map((item) => {
            const Icon = item.icon;
            const active = currentPage === item.id;
            return (
              <button
                key={item.id}
                onClick={() => {
                  onPageChange(item.id);
                  setMobileOpen(false);
                }}
                className={`sidebar-item w-full ${active ? 'sidebar-item-active' : 'sidebar-item-inactive'}`}
              >
                <Icon className="w-[18px] h-[18px] flex-shrink-0" />
                <span>{item.label}</span>
                {active && <span className="ml-auto w-1.5 h-1.5 rounded-full bg-primary-500" />}
              </button>
            );
          })}

          <p className="px-3 pb-2 pt-4 text-[11px] font-semibold text-neutral-400 uppercase tracking-wider">Configuration</p>
          {visibleConfigItems.map((item) => {
            const Icon = item.icon;
            const active = currentPage === item.id;
            return (
              <button
                key={item.id}
                onClick={() => {
                  onPageChange(item.id);
                  setMobileOpen(false);
                }}
                className={`sidebar-item w-full ${active ? 'sidebar-item-active' : 'sidebar-item-inactive'}`}
              >
                <Icon className="w-[18px] h-[18px] flex-shrink-0" />
                <span>{item.label}</span>
                {active && <span className="ml-auto w-1.5 h-1.5 rounded-full bg-primary-500" />}
              </button>
            );
          })}
        </nav>

        {/* Bottom section */}
        <div className="px-3 py-4 border-t border-neutral-100 space-y-2">
          {/* View mode toggle */}
          {showAdminToggle && (
          <button
            onClick={onToggleView}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors ${
              isAdmin
                ? 'bg-primary-50 text-primary-700 hover:bg-primary-100'
                : 'bg-neutral-50 text-neutral-600 hover:bg-neutral-100'
            }`}
          >
            {isAdmin ? (
              <Shield className="w-4 h-4 flex-shrink-0" />
            ) : (
              <User className="w-4 h-4 flex-shrink-0" />
            )}
            <div className="text-left min-w-0">
              <p className="text-sm font-medium truncate">
                {isAdmin ? 'Admin Mode' : 'Tenant Mode'}
              </p>
              <p className="text-xs text-neutral-400 truncate">
                {isAdmin ? 'Switch to tenant view' : 'Switch to admin view'}
              </p>
            </div>
          </button>
          )}

          {/* User identity with dropdown */}
          <div className="relative">
            <button
              onClick={() => setUserMenuOpen(!userMenuOpen)}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg bg-neutral-50 hover:bg-neutral-100 transition-colors"
            >
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary-400 to-accent-400 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                {userEmail.charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0 text-left flex-1">
                <p className="text-sm font-medium text-neutral-800 truncate">{userEmail}</p>
                <div className="flex items-center gap-1.5">
                  {currentRole && (
                    <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-medium ${ROLE_DISPLAY[currentRole].bg} ${ROLE_DISPLAY[currentRole].color}`}>
                      {currentRole === 'admin' ? <Crown className="w-2.5 h-2.5" /> : currentRole === 'manager' ? <Shield className="w-2.5 h-2.5" /> : currentRole === 'senior_agent' ? <Star className="w-2.5 h-2.5" /> : currentRole === 'read_only' ? <Eye className="w-2.5 h-2.5" /> : <User className="w-2.5 h-2.5" />}
                      {ROLE_DISPLAY[currentRole].label}
                    </span>
                  )}
                  <span className="text-xs text-neutral-400 truncate">{selectedTenant?.name ?? 'No tenant'}</span>
                </div>
              </div>
              <ChevronDown className="w-4 h-4 text-neutral-400 flex-shrink-0" />
            </button>

            {userMenuOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setUserMenuOpen(false)} />
                <div className="absolute bottom-full left-0 right-0 mb-2 bg-white rounded-xl border border-neutral-200 shadow-xl z-20 animate-slide-up overflow-hidden">
                  <div className="px-4 py-3 border-b border-neutral-100">
                    <p className="text-xs font-semibold text-neutral-400 uppercase tracking-wider">Account</p>
                    <p className="text-sm font-medium text-neutral-800 truncate mt-1">{userEmail}</p>
                  </div>
                  <button
                    onClick={() => { onSignOut(); setUserMenuOpen(false); }}
                    className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-danger-600 hover:bg-danger-50 transition-colors"
                  >
                    <LogOut className="w-4 h-4" />
                    Sign Out
                  </button>
                  {helpCenterHref && (
                    <a href={helpCenterHref} target="_blank" rel="noreferrer" className="block px-4 py-2.5 text-sm text-neutral-600 hover:bg-neutral-50 border-t border-neutral-100">
                      View public help center
                    </a>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </aside>

      {/* Mobile overlay */}
      {mobileOpen && <div className="fixed inset-0 z-30 bg-neutral-900/30 lg:hidden" onClick={() => setMobileOpen(false)} />}

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar */}
        <header className="sticky top-0 z-20 h-16 bg-white/80 backdrop-blur-md border-b border-neutral-200 flex items-center justify-between px-4 lg:px-6">
          <div className="flex items-center gap-3">
            <button onClick={() => setMobileOpen(true)} className="lg:hidden p-2 rounded-lg text-neutral-500 hover:bg-neutral-100">
              <Menu className="w-5 h-5" />
            </button>

            {/* Tenant selector — admin mode only */}
            {isAdmin ? (
              <div className="relative">
                <button
                  onClick={() => setTenantMenuOpen(!tenantMenuOpen)}
                  className="flex items-center gap-2.5 px-3 py-2 rounded-lg border border-neutral--200 hover:bg-neutral-50 transition-colors"
                >
                  <div className="w-7 h-7 rounded-lg bg-primary-100 flex items-center justify-center">
                    <Building2 className="w-4 h-4 text-primary-600" />
                  </div>
                  <div className="text-left hidden sm:block">
                    <p className="text-sm font-semibold text-neutral-800 leading-tight">{selectedTenant?.name ?? 'All Tenants'}</p>
                    <p className="text-[11px] text-neutral-400 leading-tight">{selectedTenant?.id ?? 'overview'}</p>
                  </div>
                  <ChevronDown className="w-4 h-4 text-neutral-400" />
                </button>

                {tenantMenuOpen && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setTenantMenuOpen(false)} />
                    <div className="absolute top-full left-0 mt-2 w-72 bg-white rounded-xl border border-neutral-200 shadow-xl z-20 animate-slide-up overflow-hidden">
                      <div className="px-3 py-2 border-b border-neutral-100">
                        <div className="relative">
                          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-neutral-400" />
                          <input
                            type="text"
                            placeholder="Search tenants..."
                            value={tenantSearch}
                            onChange={(e) => setTenantSearch(e.target.value)}
                            className="w-full pl-8 pr-3 py-1.5 text-sm rounded-lg border border-neutral-200 bg-neutral-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-400 transition-all"
                            autoFocus
                          />
                        </div>
                      </div>
                      <div className="max-h-64 overflow-y-auto scrollbar-thin py-1">
                        {filteredTenants.length === 0 ? (
                          <p className="text-sm text-neutral-400 text-center py-6">No tenants found</p>
                        ) : (
                        filteredTenants.map((t) => (
                          <button
                            key={t.id}
                            onClick={() => {
                              onTenantChange(t);
                              setTenantMenuOpen(false);
                            }}
                            className={`w-full flex items-center justify-between px-3 py-2.5 hover:bg-neutral-50 transition-colors ${
                              selectedTenant?.id === t.id ? 'bg-primary-50/50' : ''
                            }`}
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              <div className="w-8 h-8 rounded-lg bg-neutral-100 flex items-center justify-center text-xs font-bold text-neutral-600">
                                {t.name.charAt(0)}
                              </div>
                              <div className="min-w-0 text-left">
                                <p className="text-sm font-medium text-neutral-800 truncate">{t.name}</p>
                                <p className="text-xs text-neutral-400 truncate">{t.id}</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2 flex-shrink-0">
                              <PlanBadge plan={t.plan_tier} />
                            </div>
                          </button>
                        ))
                        )}
                      </div>
                    </div>
                  </>
                )}
              </div>
            ) : (
              /* Tenant mode — static badge showing the current tenant */
              <div className="flex items-center gap-2.5 px-3 py-2 rounded-lg bg-neutral-50 border border-neutral-100">
                <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: selectedTenant ? `${selectedTenant.plan_tier === 'enterprise' ? '#8b5cf6' : selectedTenant.plan_tier === 'growth' ? '#06b6d4' : '#64748b'}15` : '#f1f5f9' }}>
                  <Building2 className="w-4 h-4 text-neutral-500" />
                </div>
                <div className="hidden sm:block">
                  <p className="text-sm font-semibold text-neutral-800 leading-tight">{selectedTenant?.name ?? '—'}</p>
                  <p className="text-[11px] text-neutral-400 leading-tight">{selectedTenant?.id ?? ''}</p>
                </div>
                {selectedTenant && (
                  <div className="ml-1">
                    <PlanBadge plan={selectedTenant.plan_tier} />
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            <div className="relative hidden md:block">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
              <input
                type="text"
                placeholder="Search tickets..."
                value={headerSearch}
                onChange={(e) => setHeaderSearch(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && headerSearch.trim()) onSearch?.(headerSearch.trim());
                }}
                className="w-56 pl-9 pr-3 py-2 text-sm rounded-lg border border-neutral-200 bg-neutral-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-400 transition-all"
              />
            </div>
            <div className="relative">
              <button onClick={() => setBellOpen(!bellOpen)} className="relative p-2 rounded-lg text-neutral-500 hover:bg-neutral-100 transition-colors">
                <Bell className="w-5 h-5" />
                {notificationCount > 0 && (
                  <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-danger-500 ring-2 ring-white" />
                )}
              </button>
              {bellOpen && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setBellOpen(false)} />
                  <div className="absolute right-0 top-full mt-2 w-72 bg-white rounded-xl border border-neutral-200 z-20 p-3 space-y-2">
                    {notifications.length === 0 ? (
                      <p className="text-sm text-neutral-400 text-center py-4">No overdue follow-ups</p>
                    ) : (
                      notifications.map((n, i) => (
                        <p key={i} className="text-sm text-neutral-700">{n}</p>
                      ))
                    )}
                    <button onClick={() => { setBellOpen(false); onPageChange('inbox'); }} className="text-xs text-primary-600 font-medium">Open inbox</button>
                  </div>
                </>
              )}
            </div>
            <div className="hidden sm:flex items-center gap-2 pl-2 ml-1 border-l border-neutral-200">
              {selectedTenant && <StatusBadge status={selectedTenant.status} />}
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 p-4 lg:p-6 max-w-[1600px] w-full mx-auto">{children}</main>
      </div>
    </div>
  );
}
