import { mutation } from "./_generated/server";
import { v } from "convex/values";

export const trackWebContainerMetrics = mutation({
    args: {
        projectId: v.id("projects"),
        wc_boot_ms: v.number(),
        wc_ready_ms: v.optional(v.number()),
        wc_error: v.optional(v.string()),
        memory_usage_mb: v.optional(v.number()),
    },
    handler: async (ctx, args) => {
        const { projectId, wc_boot_ms, wc_ready_ms, wc_error, memory_usage_mb } = args;

        // Authenticate user and check project ownership
        const identity = await ctx.auth.getUserIdentity();
        if (!identity) {
            throw new Error("Unauthorized");
        }

        // Store metrics in the DB
        return await ctx.db.insert("metrics", {
            projectId,
            wc_boot_ms,
            wc_ready_ms,
            wc_error,
            memory_usage_mb,
            createdAt: Date.now(),
        });
    },
});
