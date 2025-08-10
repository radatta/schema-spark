import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

// Create a new project
export const create = mutation({
    args: {
        name: v.string(),
    },
    handler: async (ctx, args) => {
        const identity = await ctx.auth.getUserIdentity();
        if (!identity) {
            throw new Error("Unauthorized");
        }

        const email = identity.email;
        if (!email) {
            throw new Error("Email is required");
        }

        // Find or create user
        let userId = await ctx.db
            .query("users")
            .withIndex("by_email", (q) => q.eq("email", email))
            .unique()
            .then((user) => user?._id);

        if (!userId) {
            // Create user if doesn't exist
            userId = await ctx.db.insert("users", {
                email,
                createdAt: Date.now(),
            });
        }

        return await ctx.db.insert("projects", {
            ownerId: userId,
            name: args.name,
            createdAt: Date.now(),
        });
    },
});

// List all projects for the current user
export const list = query({
    handler: async (ctx) => {
        const identity = await ctx.auth.getUserIdentity();
        if (!identity) {
            return [];
        }

        const email = identity.email;
        if (!email) {
            return [];
        }

        const userId = await ctx.db
            .query("users")
            .withIndex("by_email", (q) => q.eq("email", email))
            .unique()
            .then((user) => user?._id);

        if (!userId) {
            return [];
        }

        return await ctx.db
            .query("projects")
            .withIndex("by_owner", (q) => q.eq("ownerId", userId))
            .order("desc")
            .collect();
    },
});

// Get a project by ID
export const get = query({
    args: { id: v.id("projects") },
    handler: async (ctx, args) => {
        const project = await ctx.db.get(args.id);
        if (!project) {
            return null;
        }

        const identity = await ctx.auth.getUserIdentity();
        if (!identity) {
            throw new Error("Unauthorized");
        }

        const email = identity.email;
        if (!email) {
            throw new Error("Email is required");
        }

        const userId = await ctx.db
            .query("users")
            .withIndex("by_email", (q) => q.eq("email", email))
            .unique()
            .then((user) => user?._id);

        if (!userId || project.ownerId !== userId) {
            throw new Error("Unauthorized");
        }

        return project;
    },
});
