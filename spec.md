# Schema Spark

> Spec-to-App Mini Agent with Convex, Next.js, and LLM Ops

## Overview

Build a web app mvp where a user inputs a natural-language app spec (e.g., “Todos with title, done; add/edit/filter; save per user”). An agent plans, generates, validates, and persists a minimal full-stack app using Next.js (frontend) and Convex (backend). The system provides evals, observability, and benchmarking across multiple golden tasks and models.

## Primary Goals

* Turn a short app spec into:
  * Convex data model (schema.ts)
  * Convex queries/mutations/actions for CRUD
  * React/Next UI (components/pages/hooks)
* Persist generated artifacts as versioned “files” in Convex
* Preview and run the generated app in-browser
* Provide evals and observability (latency, token usage, pass rate, error types)
* Compare multiple prompts/models with a leaderboard

## Non-Goals (MVP)

* Real VM isolation or full dev environment execution
* Complex UI theming beyond basic components
* Full E2E testing; MVP focuses on smoke and logic checks

## Tech Stack

* Frontend: Next.js (App Router), TypeScript, shadcn/ui, Monaco Editor (code viewer/diffs)
* Backend: Convex (schema, queries, mutations, actions)
* Auth: Clerk
* LLM Provider: OpenAI SDK interface; pluggable provider abstraction
* Optional Observability: Sentry (frontend) if time permits

### Data Model (Convex)

* users: { id, email, createdAt }
* projects: { id, ownerId, name, createdAt }
* artifacts: { id, projectId, path, content, version, createdAt }
* runs: { id, projectId, status: “planning” | “generating” | “validating” | “completed” | “failed”, model, promptVersion, tokenUsage, cost, timings: {planMs, genMs, validateMs}, error, createdAt }
* evals: { id, runId, specId, pass: boolean, failures: string[], metrics: {latencyMs, tokenUsage, cost}, createdAt }
* specs (golden tasks): { id, title, inputSpec, assertions: Assertion[] }
* prompts: { id, name, version, template, notes, createdAt }

### Key Concepts

* Artifact: a virtual file (path + content) representing generated code, stored in Convex.
* Run: a single end-to-end agent execution for a project (from spec to validation).
* Spec/Golden Task: a canonical short description with a test bundle used for evals.
* Prompt Versioning: prompt templates are versioned and referenced by runs.

### User Flows

1. Create Project

* User logs in, creates a project, and inputs a natural-language spec.
* Click “Generate App.”

2. Agent Run (Plan → Generate → Validate → Persist)

* Plan: Determine data entities, fields, and basic UI routes.
* Generate:
  * convex/schema.ts
  * convex/queries.ts, convex/mutations.ts (or split per entity)
  * app routes/pages, basic components, hooks for calls
* Validate:
  * TypeScript compile check (tsc in-worker)
  * Minimal logic tests (CRUD sequence, shape checks)
* Persist artifacts and run summary to Convex.
* Expose a preview route (e.g., /preview?projectId=…).

3. Preview and Iterate

* Show generated UI; allow re-run with revised spec.
* Display artifact diffs between runs; accept/reject diffs.

4. Evals and Leaderboard

* Batch-run golden specs across selected models/prompts.
* Show pass rate, average latency, token usage, and cost by model/prompt.

### Convex Functions (Examples)

* mutations/projects.create(name)
* mutations/artifacts.upsert({ projectId, path, content }) → auto-increment version
* mutations/runs.create({ projectId, model, promptVersion })
* mutations/runs.update({ id, …partial })
* queries/artifacts.byProject(projectId)
* queries/runs.byProject(projectId)
* queries/evals.byPromptAndModel({ promptVersion, model })
* actions/agent.run({ projectId, inputSpec, model, promptVersion })
* actions/evals.runBatch({ promptVersion, model, specIds })

## Agent Pipeline Details

* Planning Prompt: derive entities, fields, UI pages, and API endpoints
* Generation Prompt(s): emit code for:
  * Convex schema.ts (entities + indexes)
  * CRUD mutations/queries
  * Next pages and components
* Validation:
  * Static checks: TypeScript compile and basic lint
  * Runtime checks: call Convex functions in a minimal in-memory or mocked context
* Self-Heal (stretch): on failure, feed error logs back into a patch prompt; retry N times

## Golden Specs (Initial Set)

* Todos: fields {title:string, done:boolean}; list, add, toggle, filter; user-scoped
* Notes: {title, body}; create, edit, delete; list sorted by updatedAt
* Bookmarks: {url, title, tags[]}; add, delete, filter by tag
* Polls: {question, options[], votes}; create, vote (one per user), show results
* Contacts: {name, email, phone}; create, edit, search by name

### Assertions (per Spec)

* Schema defines required fields and types
* CRUD mutations succeed and return expected shapes
* Queries filter/sort correctly
* UI renders list view without runtime errors
* Basic flow sequence passes (e.g., create → query → update → query)

### Observability & Metrics

* Per-step timings: planMs, genMs, validateMs
* Token usage and cost estimation per provider call
* Pass/fail counts by spec; failure reasons aggregated
* Prompt diff view: show prompt changes and metric deltas

## UI Pages

* /: Dashboard of projects and recent runs
* /projects/[id]: Project details, artifacts list, run history
* /preview: Renders generated app for a project
* /evals: Table/leaderboard with filters (model, promptVersion, spec)
* /prompts: Prompt registry with versions and diff viewer

## Acceptance Criteria (MVP)

* Users can create a project, input a spec, and generate an app
* Convex stores all artifacts with versioning
* Preview route renders the generated UI without crashing for at least 3 golden specs
* Evals run for at least 3 specs against at least 2 models; pass/fail and latency recorded
* Leaderboard displays pass rate and average latency per model/prompt combo
* Prompt versions are tracked and selectable for runs/evals

## Stretch Goals

* Self-healing retries with patch prompts and capped budget
* Simple Playwright-like UI smoke tests with screenshot on failure
* Cost guardrails per run
* Edit-in-place diff approval flow for artifacts

## Developer Experience

* Monorepo:
  * app/: Next.js UI
  * convex/: schema, queries, mutations, actions
  * agent/: planning/generation/validation utils
  * evals/: golden specs + test runners
  * ops/: prompt versions, metrics helpers
* Scripts:
  * dev: start Next + Convex
  * eval: run batch evals
  * seed: load golden specs
* README with setup, architecture diagram, and demo GIF

## Security & Permissions

* User-scoped data access; enforce ownerId on projects/artifacts/runs
* Prevent reading/writing artifacts across users
* Rate-limit agent.run per user to avoid cost spikes

## Risks and Mitigations

* LLM hallucinations: validate via TypeScript compile, basic runtime checks; constrain prompts; provide schema examples
* Cost creep: track token usage; add per-run budget limit; batch evals with small contexts
* Complexity creep: restrict to minimal CRUD apps for MVP; keep golden specs tight

## Demo Script (2–3 minutes)

1. Create project → paste “Todos” spec → Generate
2. Show artifacts, preview running app, complete a CRUD flow
3. Run evals across two models; open leaderboard
4. Show prompt v1 vs v2 diff and improved pass rate
