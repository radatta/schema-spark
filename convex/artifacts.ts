import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

// Upsert an artifact (create or update)
export const upsert = mutation({
    args: {
        projectId: v.id("projects"),
        path: v.string(),
        content: v.string(),
    },
    handler: async (ctx, args) => {
        const { projectId, path, content } = args;

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

        // Find existing artifact, if any
        const existingArtifact = await ctx.db
            .query("artifacts")
            .withIndex("by_project_path", (q) =>
                q.eq("projectId", projectId).eq("path", path)
            )
            .unique();

        if (existingArtifact) {
            // Update existing artifact
            return await ctx.db.patch(existingArtifact._id, {
                content,
                version: existingArtifact.version + 1,
                createdAt: Date.now(),
            });
        } else {
            // Create new artifact
            return await ctx.db.insert("artifacts", {
                projectId,
                path,
                content,
                version: 1,
                createdAt: Date.now(),
            });
        }
    },
});

// Get all artifacts for a project
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
            .query("artifacts")
            .withIndex("by_project", (q) => q.eq("projectId", projectId))
            .collect();
    },
});

// Get a specific artifact
export const get = query({
    args: {
        projectId: v.id("projects"),
        path: v.string(),
    },
    handler: async (ctx, args) => {
        const { projectId, path } = args;

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
            .query("artifacts")
            .withIndex("by_project_path", (q) =>
                q.eq("projectId", projectId).eq("path", path)
            )
            .unique();
    },
});
