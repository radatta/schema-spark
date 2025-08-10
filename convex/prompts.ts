import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

// List all prompt templates
export const list = query({
    handler: async (ctx) => {
        const identity = await ctx.auth.getUserIdentity();
        if (!identity) {
            throw new Error("Not authenticated");
        }

        return ctx.db
            .query("prompts")
            .order("desc")
            .collect();
    },
});

// Get a prompt template by ID
export const get = query({
    args: {
        id: v.id("prompts"),
    },
    handler: async (ctx, args) => {
        const identity = await ctx.auth.getUserIdentity();
        if (!identity) {
            throw new Error("Not authenticated");
        }

        return ctx.db.get(args.id);
    },
});

// Get a prompt template by version
export const getByVersion = query({
    args: {
        version: v.string(),
    },
    handler: async (ctx, args) => {
        const identity = await ctx.auth.getUserIdentity();
        if (!identity) {
            throw new Error("Not authenticated");
        }

        return ctx.db
            .query("prompts")
            .withIndex("by_version", (q) => q.eq("version", args.version))
            .unique();
    },
});

// Create a new prompt template
export const create = mutation({
    args: {
        name: v.string(),
        version: v.string(),
        template: v.string(),
        notes: v.optional(v.string()),
    },
    handler: async (ctx, args) => {
        const identity = await ctx.auth.getUserIdentity();
        if (!identity) {
            throw new Error("Not authenticated");
        }

        const { name, version, template, notes } = args;

        // Check if version already exists
        const existingVersion = await ctx.db
            .query("prompts")
            .withIndex("by_version", (q) => q.eq("version", version))
            .unique();

        if (existingVersion) {
            throw new Error(`Prompt version ${version} already exists`);
        }

        return ctx.db.insert("prompts", {
            name,
            version,
            template,
            notes,
            createdAt: Date.now(),
        });
    },
});

// Update an existing prompt template
export const update = mutation({
    args: {
        id: v.id("prompts"),
        name: v.optional(v.string()),
        template: v.optional(v.string()),
        notes: v.optional(v.string()),
    },
    handler: async (ctx, args) => {
        const identity = await ctx.auth.getUserIdentity();
        if (!identity) {
            throw new Error("Not authenticated");
        }

        const { id, ...updates } = args;

        // Get the prompt to make sure it exists
        const prompt = await ctx.db.get(id);
        if (!prompt) {
            throw new Error("Prompt not found");
        }

        // We don't allow changing the version as it's used as an identifier
        return ctx.db.patch(id, updates);
    },
});

// Delete a prompt template
export const remove = mutation({
    args: {
        id: v.id("prompts"),
    },
    handler: async (ctx, args) => {
        const identity = await ctx.auth.getUserIdentity();
        if (!identity) {
            throw new Error("Not authenticated");
        }

        // Check if this prompt exists
        const prompt = await ctx.db.get(args.id);
        if (!prompt) {
            throw new Error("Prompt not found");
        }

        return ctx.db.delete(args.id);
    },
});
