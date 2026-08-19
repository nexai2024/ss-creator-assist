/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as ai from "../ai.js";
import type * as attachments from "../attachments.js";
import type * as auth from "../auth.js";
import type * as billing from "../billing.js";
import type * as campaigns from "../campaigns.js";
import type * as chat from "../chat.js";
import type * as dashboard from "../dashboard.js";
import type * as email from "../email.js";
import type * as gdpr from "../gdpr.js";
import type * as http from "../http.js";
import type * as httpApi from "../httpApi.js";
import type * as inbound from "../inbound.js";
import type * as integrations from "../integrations.js";
import type * as knowledge from "../knowledge.js";
import type * as lib_auth from "../lib/auth.js";
import type * as lib_businessSla from "../lib/businessSla.js";
import type * as lib_chatContent from "../lib/chatContent.js";
import type * as lib_cors from "../lib/cors.js";
import type * as lib_hosts from "../lib/hosts.js";
import type * as lib_insertTicket from "../lib/insertTicket.js";
import type * as lib_notifyTicket from "../lib/notifyTicket.js";
import type * as lib_openai from "../lib/openai.js";
import type * as lib_permissions from "../lib/permissions.js";
import type * as lib_rateLimit from "../lib/rateLimit.js";
import type * as lib_retrieve from "../lib/retrieve.js";
import type * as lib_routing from "../lib/routing.js";
import type * as lib_secrets from "../lib/secrets.js";
import type * as lib_shape from "../lib/shape.js";
import type * as lib_stripeCatalog from "../lib/stripeCatalog.js";
import type * as lib_stripePlans from "../lib/stripePlans.js";
import type * as lib_ticketEmail from "../lib/ticketEmail.js";
import type * as lib_validators from "../lib/validators.js";
import type * as lib_workflows from "../lib/workflows.js";
import type * as lib_workspace from "../lib/workspace.js";
import type * as presence from "../presence.js";
import type * as public_ from "../public.js";
import type * as reports from "../reports.js";
import type * as solopreneur from "../solopreneur.js";
import type * as team from "../team.js";
import type * as tenants from "../tenants.js";
import type * as tickets from "../tickets.js";
import type * as users from "../users.js";
import type * as webhooks from "../webhooks.js";
import type * as workflows from "../workflows.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  ai: typeof ai;
  attachments: typeof attachments;
  auth: typeof auth;
  billing: typeof billing;
  campaigns: typeof campaigns;
  chat: typeof chat;
  dashboard: typeof dashboard;
  email: typeof email;
  gdpr: typeof gdpr;
  http: typeof http;
  httpApi: typeof httpApi;
  inbound: typeof inbound;
  integrations: typeof integrations;
  knowledge: typeof knowledge;
  "lib/auth": typeof lib_auth;
  "lib/businessSla": typeof lib_businessSla;
  "lib/chatContent": typeof lib_chatContent;
  "lib/cors": typeof lib_cors;
  "lib/hosts": typeof lib_hosts;
  "lib/insertTicket": typeof lib_insertTicket;
  "lib/notifyTicket": typeof lib_notifyTicket;
  "lib/openai": typeof lib_openai;
  "lib/permissions": typeof lib_permissions;
  "lib/rateLimit": typeof lib_rateLimit;
  "lib/retrieve": typeof lib_retrieve;
  "lib/routing": typeof lib_routing;
  "lib/secrets": typeof lib_secrets;
  "lib/shape": typeof lib_shape;
  "lib/stripeCatalog": typeof lib_stripeCatalog;
  "lib/stripePlans": typeof lib_stripePlans;
  "lib/ticketEmail": typeof lib_ticketEmail;
  "lib/validators": typeof lib_validators;
  "lib/workflows": typeof lib_workflows;
  "lib/workspace": typeof lib_workspace;
  presence: typeof presence;
  public: typeof public_;
  reports: typeof reports;
  solopreneur: typeof solopreneur;
  team: typeof team;
  tenants: typeof tenants;
  tickets: typeof tickets;
  users: typeof users;
  webhooks: typeof webhooks;
  workflows: typeof workflows;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
