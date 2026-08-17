/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as auth from "../auth.js";
import type * as billing from "../billing.js";
import type * as chat from "../chat.js";
import type * as dashboard from "../dashboard.js";
import type * as email from "../email.js";
import type * as gdpr from "../gdpr.js";
import type * as http from "../http.js";
import type * as httpApi from "../httpApi.js";
import type * as integrations from "../integrations.js";
import type * as knowledge from "../knowledge.js";
import type * as lib_auth from "../lib/auth.js";
import type * as lib_cors from "../lib/cors.js";
import type * as lib_permissions from "../lib/permissions.js";
import type * as lib_rateLimit from "../lib/rateLimit.js";
import type * as lib_routing from "../lib/routing.js";
import type * as lib_secrets from "../lib/secrets.js";
import type * as lib_shape from "../lib/shape.js";
import type * as lib_validators from "../lib/validators.js";
import type * as lib_workspace from "../lib/workspace.js";
import type * as public_ from "../public.js";
import type * as solopreneur from "../solopreneur.js";
import type * as team from "../team.js";
import type * as tenants from "../tenants.js";
import type * as tickets from "../tickets.js";
import type * as users from "../users.js";
import type * as webhooks from "../webhooks.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  auth: typeof auth;
  billing: typeof billing;
  chat: typeof chat;
  dashboard: typeof dashboard;
  email: typeof email;
  gdpr: typeof gdpr;
  http: typeof http;
  httpApi: typeof httpApi;
  integrations: typeof integrations;
  knowledge: typeof knowledge;
  "lib/auth": typeof lib_auth;
  "lib/cors": typeof lib_cors;
  "lib/permissions": typeof lib_permissions;
  "lib/rateLimit": typeof lib_rateLimit;
  "lib/routing": typeof lib_routing;
  "lib/secrets": typeof lib_secrets;
  "lib/shape": typeof lib_shape;
  "lib/validators": typeof lib_validators;
  "lib/workspace": typeof lib_workspace;
  public: typeof public_;
  solopreneur: typeof solopreneur;
  team: typeof team;
  tenants: typeof tenants;
  tickets: typeof tickets;
  users: typeof users;
  webhooks: typeof webhooks;
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
