/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";
import type * as agent from "../agent.js";
import type * as artifacts from "../artifacts.js";
import type * as envs from "../envs.js";
import type * as evals from "../evals.js";
import type * as internal_ from "../internal.js";
import type * as metrics from "../metrics.js";
import type * as projects from "../projects.js";
import type * as prompts from "../prompts.js";
import type * as runs from "../runs.js";
import type * as specs from "../specs.js";

/**
 * A utility for referencing Convex functions in your app's API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
declare const fullApi: ApiFromModules<{
  agent: typeof agent;
  artifacts: typeof artifacts;
  envs: typeof envs;
  evals: typeof evals;
  internal: typeof internal_;
  metrics: typeof metrics;
  projects: typeof projects;
  prompts: typeof prompts;
  runs: typeof runs;
  specs: typeof specs;
}>;
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;
