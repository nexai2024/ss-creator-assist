import type { PageId } from '@/components/AppShell';

export const PAGE_PATHS: Record<PageId, string> = {
  dashboard: '/dashboard',
  inbox: '/inbox',
  tickets: '/tickets',
  chat: '/chat',
  knowledge: '/knowledge',
  gdpr: '/gdpr',
  tenants: '/tenants',
  integrations: '/integrations',
  'integration-detail': '/integrations',
  'new-integration': '/integrations/new',
  routing: '/routing',
  pricing: '/pricing',
  billing: '/billing',
  team: '/team',
  'saved-replies': '/saved-replies',
  'solo-settings': '/solo-settings',
};

export function pathForPage(page: PageId, extra?: { integrationId?: string; ticketId?: string; conversationId?: string }): string {
  if (page === 'integration-detail' && extra?.integrationId) return `/integrations/${extra.integrationId}`;
  if (page === 'tickets' && extra?.ticketId) return `/tickets/${extra.ticketId}`;
  if (page === 'chat' && extra?.conversationId) return `/chat/${extra.conversationId}`;
  return PAGE_PATHS[page];
}

export function pageFromPath(pathname: string): PageId {
  if (pathname.startsWith('/inbox')) return 'inbox';
  if (pathname.startsWith('/tickets')) return 'tickets';
  if (pathname.startsWith('/chat')) return 'chat';
  if (pathname.startsWith('/knowledge')) return 'knowledge';
  if (pathname.startsWith('/gdpr')) return 'gdpr';
  if (pathname.startsWith('/tenants')) return 'tenants';
  if (pathname === '/integrations/new') return 'new-integration';
  if (pathname.startsWith('/integrations/') && pathname !== '/integrations') return 'integration-detail';
  if (pathname.startsWith('/integrations')) return 'integrations';
  if (pathname.startsWith('/routing')) return 'routing';
  if (pathname.startsWith('/pricing')) return 'pricing';
  if (pathname.startsWith('/billing')) return 'billing';
  if (pathname.startsWith('/team')) return 'team';
  if (pathname.startsWith('/saved-replies')) return 'saved-replies';
  if (pathname.startsWith('/solo-settings')) return 'solo-settings';
  return 'dashboard';
}
