/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as activity from "../activity.js";
import type * as auth from "../auth.js";
import type * as email from "../email.js";
import type * as health from "../health.js";
import type * as http from "../http.js";
import type * as members from "../members.js";
import type * as model_access from "../model/access.js";
import type * as model_activity from "../model/activity.js";
import type * as model_domain from "../model/domain.js";
import type * as model_emailContent from "../model/emailContent.js";
import type * as model_errors from "../model/errors.js";
import type * as model_membership from "../model/membership.js";
import type * as model_validation from "../model/validation.js";
import type * as projects from "../projects.js";
import type * as seed from "../seed.js";
import type * as tasks from "../tasks.js";
import type * as testData from "../testData.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  activity: typeof activity;
  auth: typeof auth;
  email: typeof email;
  health: typeof health;
  http: typeof http;
  members: typeof members;
  "model/access": typeof model_access;
  "model/activity": typeof model_activity;
  "model/domain": typeof model_domain;
  "model/emailContent": typeof model_emailContent;
  "model/errors": typeof model_errors;
  "model/membership": typeof model_membership;
  "model/validation": typeof model_validation;
  projects: typeof projects;
  seed: typeof seed;
  tasks: typeof tasks;
  testData: typeof testData;
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

export declare const components: {
  betterAuth: import("@convex-dev/better-auth/_generated/component.js").ComponentApi<"betterAuth">;
};
