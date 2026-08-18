export type Tenant = {
  id: string;
  name: string;
  slug: string;
  plan_tier: 'starter' | 'growth' | 'enterprise';
  status: 'active' | 'trial' | 'suspended';
  monthly_active_users: number;
  included_maus: number;
  overage_rate: number;
  sla_uptime: string;
  created_at: string;
};

export type Agent = {
  id: string;
  tenant_id: string;
  name: string;
  email: string;
  role: 'admin' | 'agent';
  status: 'online' | 'away' | 'offline';
  avatar_color: string;
  created_at: string;
};

export type Ticket = {
  id: string;
  tenant_id: string;
  subject: string;
  category: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  status: 'open' | 'pending' | 'resolved' | 'closed';
  customer_name: string;
  customer_email: string;
  customer_external_id: string | null;
  assigned_agent_id: string | null;
  sla_deadline: string | null;
  created_at: string;
  updated_at: string;
  resolved_at: string | null;
  csat_score: number | null;
  deflection_suggested: boolean;
  custom_fields: Record<string, string>;
  tags: string[] | null;
};

export type TicketMessage = {
  id: string;
  ticket_id: string;
  sender_type: 'end_user' | 'agent' | 'system';
  sender_name: string;
  content: string;
  created_at: string;
};

export type ChatConversation = {
  id: string;
  tenant_id: string;
  customer_name: string;
  customer_email: string;
  status: 'active' | 'waiting' | 'closed';
  assigned_agent_id: string | null;
  created_at: string;
  closed_at: string | null;
};

export type ChatMessage = {
  id: string;
  conversation_id: string;
  sender_type: 'end_user' | 'agent' | 'bot';
  sender_name: string;
  content: string;
  created_at: string;
};

export type KbCategory = {
  id: string;
  tenant_id: string;
  name: string;
  slug: string;
  description: string | null;
  created_at: string;
};

export type KbArticle = {
  id: string;
  tenant_id: string;
  category_id: string | null;
  title: string;
  slug: string;
  content: string;
  status: 'published' | 'draft';
  views: number;
  helpful_votes: number;
  unhelpful_votes: number;
  created_at: string;
  updated_at: string;
};

export type GdprRequest = {
  id: string;
  tenant_id: string;
  subject_type: string;
  external_user_id: string;
  user_email: string;
  reason: string;
  status: 'processing' | 'completed' | 'failed';
  job_id: string | null;
  created_at: string;
  completed_at: string | null;
};

export type IntegrationSettings = {
  id: string;
  tenant_id: string;
  name: string;
  description: string | null;
  status: 'active' | 'inactive' | 'draft';
  api_key: string | null;
  api_key_hint: string | null;
  widget_enabled: boolean;
  widget_position: string;
  widget_color: string;
  widget_greeting: string | null;
  custom_domain: string | null;
  help_center_subdomain: string | null;
  branding_logo_url: string | null;
  branding_primary_color: string;
  webhook_url: string | null;
  webhook_secret: string | null;
  webhook_secret_hint: string | null;
  webhook_events: string[];
  sso_enabled: boolean;
  sso_provider: string | null;
  sso_metadata_url: string | null;
  onboarding_completed: boolean;
  onboarding_step: number;
  created_at: string;
  updated_at: string;
};

export type AuditLogEntry = {
  id: string;
  tenant_id: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  details: string | null;
  user_id: string | null;
  ip_address: string | null;
  severity: 'info' | 'warning' | 'critical' | null;
  created_at: string;
};

export type RoutingRule = {
  id: string;
  tenant_id: string;
  name: string;
  condition_field: 'category' | 'priority' | 'subject_keyword';
  condition_value: string;
  action: 'assign_agent' | 'set_priority' | 'add_tag';
  action_value: string;
  priority: number;
  enabled: boolean;
  created_at: string;
  updated_at: string;
};

export type ChatbotMessage = {
  id: string;
  conversation_id: string;
  content: string;
  suggested_article_id: string | null;
  confidence: number;
  was_helpful: boolean | null;
  created_at: string;
};

export type TicketFeedback = {
  id: string;
  ticket_id: string;
  rating: number;
  comment: string | null;
  submitted_by: string | null;
  created_at: string;
};

export type WebhookDelivery = {
  id: string;
  tenant_id: string;
  event_type: string;
  payload: Record<string, unknown> | null;
  response_status: number | null;
  response_body: string | null;
  delivered_at: string;
};

export type RoleTier = 'admin' | 'manager' | 'senior_agent' | 'junior_agent' | 'read_only';

export type TenantMember = {
  id: string;
  user_id: string;
  tenant_id: string;
  role: RoleTier;
  created_at: string;
  updated_at: string | null;
};

export type Role = {
  id: string;
  display_name: string;
  description: string;
  sort_order: number;
};

export type Permission = {
  id: string;
  category: string;
  display_label: string;
  description: string;
};

export type RolePermission = {
  role_id: string;
  permission_id: string;
};

export type TeamInvite = {
  id: string;
  tenant_id: string;
  email: string;
  role: RoleTier;
  token: string;
  invited_by: string | null;
  expires_at: string;
  used_at: string | null;
  created_at: string;
};

export type TeamMemberWithEmail = {
  user_id: string;
  email: string;
  role: RoleTier;
  created_at: string;
  updated_at: string | null;
};

export type SavedReply = {
  id: string;
  tenant_id: string;
  title: string;
  content: string;
  category: string;
  shortcut: string | null;
  usage_count: number;
  created_at: string;
  updated_at: string;
};

export type CustomerProfile = {
  id: string;
  tenant_id: string;
  customer_email: string;
  customer_name: string | null;
  is_vip: boolean;
  personal_notes: string | null;
  lifetime_value: number;
  total_tickets: number;
  last_contact_at: string | null;
  created_at: string;
  updated_at: string;
};

export type TimeEntry = {
  id: string;
  tenant_id: string;
  entity_type: 'ticket' | 'chat';
  entity_id: string;
  minutes: number;
  description: string | null;
  billable: boolean;
  created_at: string;
};

export type FollowUp = {
  id: string;
  tenant_id: string;
  entity_type: 'ticket' | 'chat';
  entity_id: string;
  customer_email: string;
  customer_name: string | null;
  reminder_at: string;
  completed: boolean;
  note: string | null;
  created_at: string;
};

export type BusinessHours = {
  id: string;
  tenant_id: string;
  day_of_week: number;
  is_working_day: boolean;
  open_time: string;
  close_time: string;
  timezone: string;
};
