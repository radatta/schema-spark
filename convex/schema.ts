import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema(
  {
    users: defineTable({
      email: v.string(),
      createdAt: v.number(),
    }).index("by_email", ["email"]),

    projects: defineTable({
      ownerId: v.id("users"),
      name: v.string(),
      createdAt: v.number(),
    }).index("by_owner", ["ownerId"]),

    artifacts: defineTable({
      projectId: v.id("projects"),
      path: v.string(),
      content: v.string(),
      version: v.number(),
      createdAt: v.number(),
    }).index("by_project", ["projectId"])
      .index("by_project_path", ["projectId", "path"]),

    runs: defineTable({
      projectId: v.id("projects"),
      status: v.string(), // "planning" | "generating" | "validating" | "completed" | "failed"
      model: v.string(),
      promptVersion: v.string(),
      tokenUsage: v.optional(v.number()),
      cost: v.optional(v.number()),
      timings: v.optional(v.object({
        planMs: v.optional(v.number()),
        genMs: v.optional(v.number()),
        validateMs: v.optional(v.number()),
      })),
      error: v.optional(v.string()),
      createdAt: v.number(),
    }).index("by_project", ["projectId"]),

    evals: defineTable({
      projectId: v.id("projects"),
      runId: v.optional(v.id("runs")),
      version: v.string(),
      status: v.string(), // "pending" | "in_progress" | "completed"
      metrics: v.optional(v.object({
        functionality: v.number(),
        codeQuality: v.number(),
        design: v.number(),
        performance: v.number(),
      })),
      feedback: v.optional(v.string()),
      createdAt: v.number(),
    }).index("by_project", ["projectId"])
      .index("by_run", ["runId"]),

    specs: defineTable({
      title: v.string(),
      inputSpec: v.string(),
      assertions: v.array(v.object({
        description: v.string(),
        type: v.string(),
      })),
    }),

    prompts: defineTable({
      name: v.string(),
      version: v.string(),
      template: v.string(),
      notes: v.optional(v.string()),
      createdAt: v.number(),
    }).index("by_version", ["version"]),
  },
  { schemaValidation: true }
);
