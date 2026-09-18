# Internal Documentation

## Table of Contents
- [Overview](#overview)
  - [System Purpose](#system-purpose)
  - [High-Level Architecture](#high-level-architecture)
- [Component Breakdown](#component-breakdown)
  - [Database Schema (`convex/schema.ts`)](#database-schema-convexschemats)
  - [AI Engine (`convex/ai.ts`)](#ai-engine-convexaits)
  - [Ticketing Core (`convex/tickets.ts`)](#ticketing-core-convexticketsts)
  - [Live Chat System (`convex/chat.ts`)](#live-chat-system-convexchatts)
  - [Knowledge Base & Public Portal (`convex/knowledge.ts` & `convex/public.ts`)](#knowledge-base--public-portal-convexknowledgets--convexpublicts)
  - [Billing & Stripe (`convex/billing.ts` & `convex/lib/stripeCatalog.ts`)](#billing--stripe-convexbillingts--convexlibstripecatalogts)
  - [Workflows & Routing (`convex/workflows.ts` & `convex/lib/workflows.ts`)](#workflows--routing-convexworkflowsts--convexlibworkflowsts)
  - [Solopreneur Tools (`convex/solopreneur.ts`)](#solopreneur-tools-convexsolopreneurts)
  - [Integrations & HTTP Router (`convex/integrations.ts`, `convex/http.ts`, `convex/httpApi.ts`)](#integrations--http-router-convexintegrationsts-convexhttpts-convexhttpapits)
  - [Presence & Collision (`convex/presence.ts`)](#presence--collision-convexpresencets)
  - [GDPR & Compliance (`convex/gdpr.ts`)](#gdpr--compliance-convexgdprts)
  - [Frontend SPA (`src/`)](#frontend-spa-src)
- [Data Flow](#data-flow)
  - [Flow 1: Inbound Ticket Creation & Automated Routing](#flow-1-inbound-ticket-creation--automated-routing)
  - [Flow 2: Live Chat Message & AI Vector Deflection](#flow-2-live-chat-message--ai-vector-deflection)
  - [Flow 3: External Webhook Delivery](#flow-3-external-webhook-delivery)
  - [Flow 4: Stripe Webhook Billing Reconciliation](#flow-4-stripe-webhook-billing-reconciliation)
- [Dependencies](#dependencies)
  - [Runtime Dependencies](#runtime-dependencies)
  - [External Cloud Services](#external-cloud-services)
- [Key Functions/Classes](#key-functionsclasses)
  - [`convex/ai.ts`: `copilot`](#convexaits-copilot)
  - [`convex/lib/businessSla.ts`: `calculateSlaDeadline`](#convexlibbusinessslats-calculatesladeadline)
  - [`convex/lib/workflows.ts`: `applyWorkflows`](#convexlibworkflowsts-applyworkflows)
  - [`convex/lib/insertTicket.ts`: `insertTicketHelper`](#convexlibinsertticketts-inserttickethelper)
  - [`convex/webhooks.ts`: `deliverWebhook`](#convexwebhooksts-deliverwebhook)
  - [`convex/billing.ts`: `applyPaidPlan`](#convexbillingts-applypaidplan)
- [Cross-Links](#cross-links)

---

## Overview

### System Purpose
Webwi (repository `ss-creator-assist`) is a full-stack, multi-tenant customer support platform. It consolidates omnichannel ticket management (email, web forms, live chat, and REST API), AI-driven deflection and copilot assistance, self-service knowledge bases, macro workflows, role-based access control (RBAC), and subscription billing into a single web application.

### High-Level Architecture
The platform operates on a two-tier serverless architecture:
1. **Client Tier**: Single Page Application (SPA) built with React 18, Vite, TypeScript, and Tailwind CSS. Client routing dynamically serves the internal agent console, public Help Center portals, or embedded live chat widgets based on URL hostname/slug.
2. **Serverless Backend Tier**: Powered by Convex BaaS. Manages real-time WebSocket database subscriptions, serverless mutations and queries, scheduled background jobs, vector search indexes, HTTP endpoints, and authentication (`@convex-dev/auth`).

For component interaction details, see [Component Breakdown](#component-breakdown). For end-to-end processing steps, see [Data Flow](#data-flow).

---

## Component Breakdown

### Database Schema (`convex/schema.ts`)
- **Purpose**: Defines database tables, field validators, and indexes using Convex's strict schema system.
- **Internal Mechanics**: Houses 25 relational tables including `tenants`, `tenantMembers`, `tickets`, `ticketMessages`, `chatConversations`, `chatMessages`, `kbArticles`, `workflows`, `auditLog`, and `webhookDeliveries`.
- **Connections**: Serves as the single source of truth for all backend queries, mutations, and actions. Vector index `by_embedding` on `kbArticles` enables AI similarity search.

### AI Engine (`convex/ai.ts`)
- **Purpose**: Provides AI vector embedding, knowledge retrieval, RAG chat deflection, and agent Copilot drafting.
- **Internal Mechanics**: Communicates with OpenAI REST API via `convex/lib/openai.ts`. Embeds articles using `text-embedding-3-small` (1536 dimensions) and generates completions using `gpt-4o-mini`.
- **Connections**: Consumed by `chat.ts` for automated visitor deflection and by `src/components/CopilotBox.tsx` in the agent interface. See [`copilot`](#convexaits-copilot) for implementation details.

### Ticketing Core (`convex/tickets.ts`)
- **Purpose**: Handles ticket lifecycle management including creation, pagination, full-text search, assignment, status transition, and CSAT logging.
- **Internal Mechanics**: Executes mutations that enforce SLA target deadlines and log state changes to `auditLog`.
- **Connections**: Triggered by web forms, inbound email, REST API, or live chat escalation via [`insertTicketHelper`](#convexlibinsertticketts-inserttickethelper).

### Live Chat System (`convex/chat.ts`)
- **Purpose**: Manages real-time visitor-to-agent chat conversations, internal agent notes, and ticket escalation.
- **Internal Mechanics**: Maintains `chatConversations` and `chatMessages`. Generates visitor auth tokens and encodes shareable ticket links (`encodeChatShare`).
- **Connections**: Links directly to [`convex/ai.ts`](#ai-engine-convexaits) for automated bot replies and [`convex/tickets.ts`](#ticketing-core-convexticketsts) when escalating a chat.

### Knowledge Base & Public Portal (`convex/knowledge.ts` & `convex/public.ts`)
- **Purpose**: Enables knowledge article creation, category structuring, vector indexing, public search, and article helpfulness voting.
- **Internal Mechanics**: Admin mutations update markdown content and trigger background embedding generation. Public queries expose published articles without requiring agent authentication.
- **Connections**: Interacts with [`convex/ai.ts`](#ai-engine-convexaits) for vector retrieval and [`src/pages/HelpCenterPage.tsx`](#frontend-spa-src) for public display.

### Billing & Stripe (`convex/billing.ts` & `convex/lib/stripeCatalog.ts`)
- **Purpose**: Controls tier subscription management (Starter $29/mo, Growth $99/mo, Enterprise $299/mo), Stripe Checkout, and Billing Portal redirects.
- **Internal Mechanics**: Converts incoming Stripe webhook events (`checkout.session.completed`, `customer.subscription.updated`) into tenant tier updates.
- **Connections**: Enforces feature gates and active user limits across tenant settings. See [`applyPaidPlan`](#convexbillingts-applypaidplan).

### Workflows & Routing (`convex/workflows.ts` & `convex/lib/workflows.ts`)
- **Purpose**: Executes automated rules and macros triggered by ticket creation or status updates.
- **Internal Mechanics**: Evaluates step sequences (assign agent, set priority, set status, add tags) sequentially against ticket attributes.
- **Connections**: Invoked by ticket creation pipelines. See [`applyWorkflows`](#convexlibworkflowsts-applyworkflows).

### Solopreneur Tools (`convex/solopreneur.ts`)
- **Purpose**: Provides single-operator features including business hour SLA logic, auto-responders, time entry logs, canned replies, and follow-up reminders.
- **Internal Mechanics**: Computes business-hour windows and tracks billable agent minutes.
- **Connections**: Connected to [`convex/lib/businessSla.ts`](#convexlibbusinessslats-calculatesladeadline) for deadline calculations.

### Integrations & HTTP Router (`convex/integrations.ts`, `convex/http.ts`, `convex/httpApi.ts`)
- **Purpose**: Manages API key hashing (SHA-256), outbound webhook subscriptions, and public HTTP endpoints.
- **Internal Mechanics**: Hosts REST endpoints for `/ticket-api/tickets`, inbound email processing `/email/inbound`, Stripe webhooks `/stripe/webhook`, and Meta messaging webhooks (`/whatsapp/webhook`, `/instagram/webhook`).
- **Connections**: Dispatches outbound events to [`convex/webhooks.ts`](#convexwebhooksts-deliverwebhook).

### Presence & Collision (`convex/presence.ts`)
- **Purpose**: Provides real-time collision detection to prevent agents from overwriting each other's work.
- **Internal Mechanics**: Receives periodic agent heartbeats and typing state updates over WebSocket subscriptions.
- **Connections**: Surfaces viewing and typing status banners in [`src/pages/TicketsPage.tsx`](#frontend-spa-src) and [`src/pages/ChatPage.tsx`](#frontend-spa-src).

### GDPR & Compliance (`convex/gdpr.ts`)
- **Purpose**: Executes data erasure requests in compliance with GDPR privacy requirements.
- **Internal Mechanics**: Cascades deletion across tickets, messages, chat histories, feedback logs, and customer profiles, appending a entry to `auditLog`.
- **Connections**: Invoked from `src/pages/GdprPage.tsx`.

### Frontend SPA (`src/`)
- **Purpose**: Renders the agent console, customer status portals, and embeddable live chat widget.
- **Internal Mechanics**: Built with React 18 and `react-router-dom`. Uses `useAuth.tsx` to handle session tokens and tenant switcher state.
- **Connections**: Establishes continuous WebSocket streams with Convex backend endpoints.

---

## Data Flow

### Flow 1: Inbound Ticket Creation & Automated Routing
1. **Input**: A customer submits a query via web form, inbound email, REST API (`POST /ticket-api/tickets`), or chat escalation.
2. **Processing**:
   1. The request enters `convex/lib/insertTicket.ts`.
   2. The helper validates input schema, checks tenant rate limits, and inserts a row into `tickets`.
   3. `calculateSlaDeadline` calculates the target SLA deadline based on tenant business hours.
   4. `applyWorkflows` evaluates active workflow triggers (`ticket_created`) and updates priority, agent assignment, or tags.
3. **Output**: The ticket is persisted in `tickets`. Convex reactive queries automatically push the new ticket to active agent browser sessions via WebSockets.

### Flow 2: Live Chat Message & AI Vector Deflection
1. **Input**: A visitor sends a message through the live chat widget.
2. **Processing**:
   1. Message is inserted into `chatMessages`.
   2. `convex/ai.ts` converts the text into a 1536-dimensional embedding via OpenAI `text-embedding-3-small`.
   3. Convex vector search queries `kbArticles` index `by_embedding` for matches with relevance score $\ge 0.28$.
   4. If matches are found, `gpt-4o-mini` formats a grounded response containing article links (`encodeChatShare`).
   5. If matches are below threshold, a fallback message is returned indicating agent follow-up.
3. **Output**: Bot reply is inserted into `chatMessages` and rendered instantly in the visitor's widget interface.

### Flow 3: External Webhook Delivery
1. **Input**: A ticket event occurs (e.g., status changed or message added).
2. **Processing**:
   1. The mutation schedules a background execution of `deliverWebhook` in `convex/webhooks.ts`.
   2. Payload is serialized and signed with an HMAC-SHA256 signature using the tenant's webhook secret.
   3. An HTTP POST request is sent to the target URL.
3. **Output**: Delivery status and HTTP response codes are logged in `webhookDeliveries`. On failure, retries are scheduled with exponential backoff.

### Flow 4: Stripe Webhook Billing Reconciliation
1. **Input**: Stripe issues an asynchronous HTTP webhook event to `/stripe/webhook`.
2. **Processing**:
   1. `convex/http.ts` verifies the signature using `STRIPE_WEBHOOK_SECRET`.
   2. Event payload is passed to `convex/billing.ts`.
   3. `applyPaidPlan`, `applySubscriptionUpdated`, or `applySubscriptionCanceled` updates the tenant's plan tier and subscription status.
3. **Output**: Tenant plan features and seat caps are updated in `tenants`.

---

## Dependencies

### Runtime Dependencies
- **`react` / `react-dom` (`^18.3.1`)**: Component-driven UI rendering engine.
- **`react-router-dom` (`^7.18.2`)**: Client-side router handling domain routing and URL parameters.
- **`convex` (`^1.44.0`)**: Real-time database, reactive subscription engine, serverless mutations, actions, and HTTP router.
- **`@convex-dev/auth` (`^0.0.95`) & `@auth/core` (`^0.41.1`)**: Session management, authentication state, and token validation.
- **`lucide-react` (`^0.446.0`)**: UI icon collection for status badges and navigation menus.
- **`recharts` (`^3.10.1`)**: Data visualization library for dashboard and reporting metrics.
- **`@sentry/react` (`^10.70.0`)**: Real-time front-end application error tracking.

### External Cloud Services
- **OpenAI API**: Generates embeddings (`text-embedding-3-small`) and completion drafts (`gpt-4o-mini`) for knowledge deflection and copilot features.
- **Stripe API**: Processes customer subscriptions, checkout sessions, and billing portal access.
- **Resend API**: Transactional email delivery service for ticket notifications and replies.
- **Meta Graph API**: Webhook receiver for WhatsApp and Instagram direct messages `<unclear — needs input: full OAuth token refresh flow details not provided>`.

---

## Key Functions/Classes

### `convex/ai.ts`: `copilot`
- **Purpose**: Generates AI assistance for agents handling support requests.
- **Arguments**: `tenantId`, `mode` (`"draft"` | `"summarize"` | `"similar"`), `ticketId?`, `conversationId?`.
- **Execution Trigger**: Invoked when an agent clicks Copilot actions ("Draft Reply", "Summarize Thread", "Find Similar") in `CopilotBox.tsx`.
- **Behavior**: Retrieves discussion transcripts, queries relevant knowledge base articles, and prompts OpenAI `gpt-4o-mini` to construct grounded response drafts or bulleted summaries.

### `convex/lib/businessSla.ts`: `calculateSlaDeadline`
- **Purpose**: Calculates SLA target resolution timestamps while respecting active working hours and non-working days.
- **Arguments**: `createdAtMs` (number), `priority` (`"low"` | `"medium"` | `"high"` | `"urgent"`), `hoursList` (array of working hour definitions).
- **Execution Trigger**: Called inside [`insertTicketHelper`](#convexlibinsertticketts-inserttickethelper) during ticket creation.
- **Behavior**: Traverses calendar time, advancing remaining target minutes only during configured working windows until target resolution time is calculated.

### `convex/lib/workflows.ts`: `applyWorkflows`
- **Purpose**: Applies multi-step macro rules to tickets.
- **Arguments**: `ctx` (MutationCtx), `tenantId`, `ticketId`, `trigger` (`"ticket_created"` | `"status_changed"`).
- **Execution Trigger**: Called immediately after ticket creation or status modification.
- **Behavior**: Queries `workflows` table for active rules matching the trigger and sequentially updates target ticket properties (assigned agent, priority, tags, status).

### `convex/lib/insertTicket.ts`: `insertTicketHelper`
- **Purpose**: Standardized pipeline helper for ticket ingestion across all channels.
- **Arguments**: `ctx` (MutationCtx), ticket payload data (subject, body, source, customer profile info).
- **Execution Trigger**: Called by web form handlers, REST API endpoints, inbound email parsers, and chat escalation mutations.
- **Behavior**: Creates customer profile records, inserts ticket record, computes SLA deadlines, applies workflow triggers, and records audit logs.

### `convex/webhooks.ts`: `deliverWebhook`
- **Purpose**: Sends signed HMAC payloads to external tenant endpoints.
- **Arguments**: `tenantId`, `event` (string), `payload` (object).
- **Execution Trigger**: Scheduled as a background action following system events.
- **Behavior**: Serializes event payload, signs headers using HMAC-SHA256, issues HTTP POST, and logs output in `webhookDeliveries`.

### `convex/billing.ts`: `applyPaidPlan`
- **Purpose**: Upgrades or syncs tenant subscription details following billing changes.
- **Arguments**: `stripeCustomerId` (string), `stripeSubscriptionId` (string), `planTier` (`"starter"` | `"growth"` | `"enterprise"`).
- **Execution Trigger**: Called by Stripe HTTP webhook handlers upon successful subscription purchase or renewal.
- **Behavior**: Patches target tenant record with updated tier permissions, seat caps, and renewal dates.

---

## Cross-Links
- Jump to [Architecture Overview](#overview) to review system structure.
- Review [Component Breakdown](#component-breakdown) for module implementations.
- Trace step sequences in [Data Flow](#data-flow).
- Inspect external services in [Dependencies](#dependencies).
- Examine implementation logic in [Key Functions/Classes](#key-functionsclasses).

---
---

# External Documentation

## Table of Contents
- [Getting Started](#getting-started)
  - [What Webwi Is For](#what-webwi-is-for)
  - [First 3 Steps for New Users](#first-3-steps-for-new-users)
- [Task How-Tos](#task-how-tos)
  - [1. Setting Up Your Support Workspace and Branding](#1-setting-up-your-support-workspace-and-branding)
  - [2. Managing Support Tickets](#2-managing-support-tickets)
  - [3. Using Live Chat and Escalating Chat to a Ticket](#3-using-live-chat-and-escalating-chat-to-a-ticket)
  - [4. Creating and Publishing Knowledge Base Articles](#4-creating-and-publishing-knowledge-base-articles)
  - [5. Setting Up Business Hours and Auto-Responders (Solo Mode)](#5-setting-up-business-hours-and-auto-responders-solo-mode)
  - [6. Inviting Team Members and Assigning Roles](#6-inviting-team-members-and-assigning-roles)
  - [7. Managing Subscriptions and Billing](#7-managing-subscriptions-and-billing)
- [FAQ / Troubleshooting](#faq--troubleshooting)
  - [Why is my live chat widget not appearing on my website?](#why-is-my-live-chat-widget-not-appearing-on-my-website)
  - [Why are email notifications not being sent to customers?](#why-are-email-notifications-not-being-sent-to-customers)
  - [Why is the AI Copilot not giving reply suggestions?](#why-is-the-ai-copilot-not-giving-reply-suggestions)
  - [Why is my updated billing plan not showing in my account?](#why-is-my-updated-billing-plan-not-showing-in-my-account)

---

## Getting Started

### What Webwi Is For
Webwi is an all-in-one customer support tool. It helps business owners and support teams handle customer messages from email, website forms, and live chat in one single place. It also provides automatic AI answer suggestions, a public Help Center for self-service help, and automated rules to save time.

### First 3 Steps for New Users
To set up your account, complete these initial steps:
1. **Set up your workspace**: Enter your business name, logo, and help desk web link under workspace settings.
2. **Create your first Knowledge Base article**: Add answers to common questions so customers can help themselves.
3. **Embed the chat widget or share your Help Center link**: Add the chat widget code to your website or share your Help Center link with customers.

For detailed step-by-step guidance, see [Task How-Tos](#task-how-tos).

---

## Task How-Tos

### 1. Setting Up Your Support Workspace and Branding
Customize how your customer support page and live chat widget look to match your brand.
1. Log into your account and click **Settings** in the main navigation menu.
2. Select **Integrations & Widget** from the settings options.
3. Enter your business name, upload your brand logo, and choose your primary brand color.
4. Copy the provided chat widget script code snippet.
5. Paste the code snippet into your website's HTML before the closing `</body>` tag.
6. Save your changes.

### 2. Managing Support Tickets
View, organize, and reply to customer requests sent to your support team.
1. Click **Tickets** in the main navigation bar to view your inbox.
2. Select a ticket from the list to view the message history.
3. Click inside the reply box at the bottom of the screen to write your message.
4. (Optional) Click **AI Copilot Draft** to automatically generate a suggested response based on your Help Center articles.
5. Click **Send Reply** to deliver the message to the customer.
6. Update the ticket status dropdown (e.g., set to **Resolved** or **Closed**) when finished.

### 3. Using Live Chat and Escalating Chat to a Ticket
Chat with website visitors in real time and convert complex chats into support tickets.
1. Click **Live Chat** in the main navigation bar to see incoming visitor chats.
2. Select an active conversation from the left sidebar to start chatting.
3. Type your response in the message field and press **Enter** to reply.
4. If a problem requires ongoing follow-up, click **Escalate to Ticket** at the top right of the chat panel.
5. Confirm customer contact details and click **Create Ticket**. The conversation will convert into a formal support ticket with complete chat history saved.

### 4. Creating and Publishing Knowledge Base Articles
Publish help guides so customers can quickly find answers on their own.
1. Click **Knowledge Base** in the main navigation bar.
2. Click **New Article** in the top right corner.
3. Enter an article title, select a category, and type your article content using standard text formatting.
4. Toggle the status switch from **Draft** to **Published**.
5. Click **Save Article**. Your guide will immediately appear on your public Help Center page.

### 5. Setting Up Business Hours and Auto-Responders (Solo Mode)
Set operating hours and automatic replies when you are away from your desk.
1. Click **Settings** and select **Solo / Business Hours**.
2. Turn on the **Solo Mode** switch.
3. Select your local time zone and check the days of the week your business is open.
4. Enter your daily start time and end time for working hours.
5. Type an automated message in the **Offline Auto-Responder** text box (for example: *"Thanks for reaching out! We are currently offline and will reply during business hours."*).
6. Click **Save Settings**.

### 6. Inviting Team Members and Assigning Roles
Add colleagues to your workspace and manage what permissions they have.
1. Click **Settings** and select **Team Members**.
2. Click **Invite Member**.
3. Enter your team member's email address and select their permission role:
   - **Admin**: Full access to all settings, team management, and billing.
   - **Manager**: Can manage tickets, knowledge base articles, and workflows.
   - **Senior Agent / Junior Agent**: Can view and reply to customer tickets and live chats.
   - **Read Only**: Can view reports and ticket history without making changes.
4. Click **Send Invitation**. An invitation link will be sent to their email.

### 7. Managing Subscriptions and Billing
View your active subscription plan, download invoices, or change your billing tier.
1. Click **Settings** and select **Billing & Subscription**.
2. Review your current plan tier (**Starter**, **Growth**, or **Enterprise**) and monthly user account limits.
3. Click **Upgrade Plan** or **Change Plan** to choose a different subscription tier.
4. Click **Manage Billing in Stripe** to view invoice receipts, update credit card details, or cancel your subscription.

---

## FAQ / Troubleshooting

### Why is my live chat widget not appearing on my website?
1. Check that the chat widget script is correctly placed in your website's HTML code before the `</body>` tag.
2. Confirm that your domain is added under allowed domains in **Settings > Integrations**.
3. Clear your web browser cache and refresh the page.

### Why are email notifications not being sent to customers?
1. Ensure your outbound email service credentials are configured in workspace settings.
2. Verify that the customer's email address is correctly formatted in the ticket profile sidebar.
3. Check if the customer's email provider marked the message as spam or junk. `<unclear — needs input: custom email server domain setup rules depend on external email host>`

### Why is the AI Copilot not giving reply suggestions?
1. Check that you have published at least one Knowledge Base article containing information relevant to the customer's question.
2. Confirm that the AI Copilot feature is turned on in your workspace settings.
3. If an OpenAI API key was entered manually, confirm the key is active and has available usage credits.

### Why is my updated billing plan not showing in my account?
1. Wait up to two minutes after completing checkout for payment confirmation to process.
2. Refresh your web browser page to update your account status.
3. If your account still shows the previous plan, check your payment email for a Stripe receipt to ensure payment was successful.

For additional support instructions, return to [Getting Started](#getting-started) or review [Task How-Tos](#task-how-tos).
