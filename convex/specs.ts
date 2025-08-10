import { mutation, query, action } from "./_generated/server";
import { v } from "convex/values";
import { api } from "./_generated/api";
import { Id } from "./_generated/dataModel";

// List all specs (golden tasks)
export const list = query({
    handler: async (ctx) => {
        const identity = await ctx.auth.getUserIdentity();
        if (!identity) {
            throw new Error("Not authenticated");
        }

        return ctx.db
            .query("specs")
            .collect();
    },
});

// Get a spec by ID
export const get = query({
    args: {
        id: v.id("specs"),
    },
    handler: async (ctx, args) => {
        const identity = await ctx.auth.getUserIdentity();
        if (!identity) {
            throw new Error("Not authenticated");
        }

        return ctx.db.get(args.id);
    },
});

// Create a new spec
export const create = mutation({
    args: {
        title: v.string(),
        inputSpec: v.string(),
        assertions: v.array(
            v.object({
                description: v.string(),
                type: v.string(),
            })
        ),
    },
    handler: async (ctx, args) => {
        const identity = await ctx.auth.getUserIdentity();
        if (!identity) {
            throw new Error("Not authenticated");
        }

        const { title, inputSpec, assertions } = args;

        return ctx.db.insert("specs", {
            title,
            inputSpec,
            assertions,
        });
    },
});

// Update an existing spec
export const update = mutation({
    args: {
        id: v.id("specs"),
        title: v.optional(v.string()),
        inputSpec: v.optional(v.string()),
        assertions: v.optional(
            v.array(
                v.object({
                    description: v.string(),
                    type: v.string(),
                })
            )
        ),
    },
    handler: async (ctx, args) => {
        const identity = await ctx.auth.getUserIdentity();
        if (!identity) {
            throw new Error("Not authenticated");
        }

        const { id, ...updates } = args;

        // Check if the spec exists
        const spec = await ctx.db.get(id);
        if (!spec) {
            throw new Error("Spec not found");
        }

        return ctx.db.patch(id, updates);
    },
});

// Delete a spec
export const remove = mutation({
    args: {
        id: v.id("specs"),
    },
    handler: async (ctx, args) => {
        const identity = await ctx.auth.getUserIdentity();
        if (!identity) {
            throw new Error("Not authenticated");
        }

        // Check if the spec exists
        const spec = await ctx.db.get(args.id);
        if (!spec) {
            throw new Error("Spec not found");
        }

        return ctx.db.delete(args.id);
    },
});

// Run a batch of evaluations against golden specs
export const runBatch = action({
    args: {
        promptVersion: v.optional(v.string()),
        model: v.optional(v.string()),
        specIds: v.array(v.id("specs")),
    },
    handler: async (ctx, args): Promise<{
        success: boolean;
        results: { specId: Id<"specs">; evalId: Id<"evals">; success: boolean }[];
    }> => {
        const { promptVersion, model, specIds } = args;

        // Default model and prompt version if not provided
        const defaultModel = "gpt-4-turbo";

        // Get the latest prompt version if not specified
        let actualPromptVersion = promptVersion;
        if (!actualPromptVersion) {
            const latestPrompt = await ctx.runQuery(api.prompts.list)
                .then(prompts => prompts[0]?.version || "v1.0.0");
            actualPromptVersion = latestPrompt;
        }

        // Run each spec
        const results = [];
        for (const specId of specIds) {
            try {
                // Get the spec
                const spec = await ctx.runQuery(api.specs.get, { id: specId });
                if (!spec) {
                    results.push({ specId, evalId: "" as Id<"evals">, success: false });
                    continue;
                }

                // Create a project for this spec
                const projectId = await ctx.runMutation(api.projects.create, {
                    name: `Eval: ${spec.title}`
                });

                // Create an initial evaluation record
                const evalId = await ctx.runMutation(api.evals.create, {
                    projectId,
                    version: actualPromptVersion,
                    status: "in_progress",
                });

                // Run the agent
                const runResult = await ctx.runAction(api.agent.run, {
                    projectId,
                    inputSpec: spec.inputSpec,
                    model: model || defaultModel,
                    promptVersion: actualPromptVersion,
                });

                if (!runResult.success) {
                    // Update eval with failure
                    await ctx.runMutation(api.evals.update, {
                        id: evalId,
                        status: "completed",
                        metrics: {
                            functionality: 0,
                            codeQuality: 0,
                            design: 0,
                            performance: 0,
                        },
                        feedback: `Agent run failed: ${runResult.error}`,
                    });

                    // Link the run to the eval
                    await ctx.runMutation(api.evals.updateRunId, {
                        id: evalId,
                        runId: runResult.runId,
                    });

                    results.push({ specId, evalId, success: false });
                    continue;
                }

                // For now, simulate evaluation metrics
                // In a real implementation, you would run actual tests against the generated code
                const metrics = {
                    functionality: Math.random() * 3 + 7, // 7-10
                    codeQuality: Math.random() * 3 + 7,  // 7-10
                    design: Math.random() * 4 + 6,       // 6-10
                    performance: Math.random() * 4 + 6,  // 6-10
                };

                // Update the evaluation with results
                await ctx.runMutation(api.evals.update, {
                    id: evalId,
                    status: "completed",
                    metrics,
                });

                // Link the run to the eval
                await ctx.runMutation(api.evals.updateRunId, {
                    id: evalId,
                    runId: runResult.runId,
                });

                results.push({ specId, evalId, success: true });
            } catch (error) {
                console.error(`Error running spec ${specId}:`, error);
                results.push({ specId, evalId: "" as Id<"evals">, success: false });
            }
        }

        return {
            success: results.some(r => r.success),
            results,
        };
    },
});
