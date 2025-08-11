import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

// Get the environment settings for a project
export const getByProject = query({
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

        // Get the environment settings, or return defaults if not found
        const env = await ctx.db
            .query("envs")
            .withIndex("by_project", (q) => q.eq("projectId", projectId))
            .unique();

        if (env) {
            return env;
        }

        // Return default values if no settings exist
        return {
            nodeVersion: "18",
            startCommand: "npm run dev",
        };
    },
});

// Create or update environment settings for a project
export const upsert = mutation({
    args: {
        projectId: v.id("projects"),
        nodeVersion: v.string(),
        startCommand: v.string(),
    },
    handler: async (ctx, args) => {
        const { projectId, nodeVersion, startCommand } = args;

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

        // Find existing environment settings, if any
        const existingEnv = await ctx.db
            .query("envs")
            .withIndex("by_project", (q) => q.eq("projectId", projectId))
            .unique();

        if (existingEnv) {
            // Update existing settings
            return await ctx.db.patch(existingEnv._id, {
                nodeVersion,
                startCommand,
            });
        } else {
            // Create new settings
            return await ctx.db.insert("envs", {
                projectId,
                nodeVersion,
                startCommand,
                createdAt: Date.now(),
            });
        }
    },
});
