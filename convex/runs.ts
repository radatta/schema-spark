import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

// Create a new run
export const create = mutation({
    args: {
        projectId: v.id("projects"),
        model: v.string(),
        promptVersion: v.string(),
    },
    handler: async (ctx, args) => {
        const { projectId, model, promptVersion } = args;

        // Authenticate user and check project ownership
        const identity = await ctx.auth.getUserIdentity();
        if (!identity) {
            throw new Error("Unauthorized");
        }

        const email = identity.email;
        if (!email) {
            throw new Error("Email is required");
        }

        const project = await ctx.db.get(projectId);
        if (!project) {
            throw new Error("Project not found");
        }

        const userId = await ctx.db
            .query("users")
            .withIndex("by_email", (q) => q.eq("email", email))
            .unique()
            .then((user) => user?._id);

        if (!userId || project.ownerId !== userId) {
            throw new Error("Unauthorized");
        }

        return await ctx.db.insert("runs", {
            projectId,
            status: "planning", // Start in planning state
            model,
            promptVersion,
            createdAt: Date.now(),
        });
    },
});

// Update a run
export const update = mutation({
    args: {
        id: v.id("runs"),
        status: v.optional(v.string()),
        tokenUsage: v.optional(v.number()),
        cost: v.optional(v.number()),
        timings: v.optional(v.object({
            planMs: v.optional(v.number()),
            genMs: v.optional(v.number()),
            validateMs: v.optional(v.number()),
        })),
        error: v.optional(v.string()),
    },
    handler: async (ctx, args) => {
        const { id, ...updateData } = args;

        const run = await ctx.db.get(id);
        if (!run) {
            throw new Error("Run not found");
        }

        // Authenticate user and check project ownership
        const identity = await ctx.auth.getUserIdentity();
        if (!identity) {
            throw new Error("Unauthorized");
        }

        const email = identity.email;
        if (!email) {
            throw new Error("Email is required");
        }

        const project = await ctx.db.get(run.projectId);
        if (!project) {
            throw new Error("Project not found");
        }

        const userId = await ctx.db
            .query("users")
            .withIndex("by_email", (q) => q.eq("email", email))
            .unique()
            .then((user) => user?._id);

        if (!userId || project.ownerId !== userId) {
            throw new Error("Unauthorized");
        }

        // Update the run
        return await ctx.db.patch(id, updateData);
    },
});

// Get all runs for a project
export const byProject = query({
    args: { projectId: v.id("projects") },
    handler: async (ctx, args) => {
        const { projectId } = args;

        // Authenticate user and check project ownership
        const identity = await ctx.auth.getUserIdentity();
        if (!identity) {
            throw new Error("Unauthorized");
        }

        const email = identity.email;
        if (!email) {
            throw new Error("Email is required");
        }

        const project = await ctx.db.get(projectId);
        if (!project) {
            throw new Error("Project not found");
        }

        const userId = await ctx.db
            .query("users")
            .withIndex("by_email", (q) => q.eq("email", email))
            .unique()
            .then((user) => user?._id);

        if (!userId || project.ownerId !== userId) {
            throw new Error("Unauthorized");
        }

        return await ctx.db
            .query("runs")
            .withIndex("by_project", (q) => q.eq("projectId", projectId))
            .order("desc")
            .collect();
    },
});

// Get a specific run
export const get = query({
    args: { id: v.id("runs") },
    handler: async (ctx, args) => {
        const run = await ctx.db.get(args.id);
        if (!run) {
            return null;
        }

        // Authenticate user and check project ownership
        const identity = await ctx.auth.getUserIdentity();
        if (!identity) {
            throw new Error("Unauthorized");
        }

        const email = identity.email;
        if (!email) {
            throw new Error("Email is required");
        }

        const project = await ctx.db.get(run.projectId);
        if (!project) {
            throw new Error("Project not found");
        }

        const userId = await ctx.db
            .query("users")
            .withIndex("by_email", (q) => q.eq("email", email))
            .unique()
            .then((user) => user?._id);

        if (!userId || project.ownerId !== userId) {
            throw new Error("Unauthorized");
        }

        return run;
    },
});
