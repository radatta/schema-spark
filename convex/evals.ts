import { mutation, query, action } from "./_generated/server";
import { v } from "convex/values";
import { api } from "./_generated/api";

// Get all evaluations for a specific project
export const byProject = query({
    args: {
        projectId: v.id("projects"),
    },
    handler: async (ctx, args) => {
        const identity = await ctx.auth.getUserIdentity();
        if (!identity) {
            throw new Error("Not authenticated");
        }

        const user = await ctx.db
            .query("users")
            .withIndex("by_email", (q) =>
                q.eq("email", identity.email || "")
            )
            .first();

        if (!user) {
            throw new Error("User not found");
        }

        // Get the project to verify ownership
        const project = await ctx.db.get(args.projectId);
        if (!project || project.ownerId !== user._id) {
            throw new Error("Project not found or access denied");
        }

        // Return all evaluations for this project
        return ctx.db
            .query("evals")
            .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
            .order("desc")
            .collect();
    },
});

// Run a batch of evaluations
export const runBatch = action({
    args: {
        promptVersion: v.optional(v.string()),
        model: v.optional(v.string()),
        specIds: v.array(v.id("specs")),
    },
    handler: async (ctx, args) => {
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
                    results.push({ specId, success: false });
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

                    results.push({ specId, success: false });
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

                results.push({ specId, success: true });
            } catch (error) {
                console.error(`Error running spec ${specId}:`, error);
                results.push({ specId, success: false });
            }
        }

        return {
            success: results.some(r => r.success),
            results,
        };
    },
});

// Get a specific evaluation by ID
export const get = query({
    args: {
        id: v.id("evals"),
    },
    handler: async (ctx, args) => {
        const identity = await ctx.auth.getUserIdentity();
        if (!identity) {
            throw new Error("Not authenticated");
        }

        const evalData = await ctx.db.get(args.id);
        if (!evalData) {
            throw new Error("Evaluation not found");
        }

        // Check if user has access to this evaluation
        const user = await ctx.db
            .query("users")
            .withIndex("by_email", (q) =>
                q.eq("email", identity.email || "")
            )
            .first();

        if (!user) {
            throw new Error("User not found");
        }

        const project = await ctx.db.get(evalData.projectId);
        if (!project || project.ownerId !== user._id) {
            throw new Error("Project not found or access denied");
        }

        return evalData;
    },
});

// Create a new evaluation
export const create = mutation({
    args: {
        projectId: v.id("projects"),
        runId: v.optional(v.id("runs")),
        version: v.string(),
        status: v.string(), // "pending" | "in_progress" | "completed"
        metrics: v.optional(
            v.object({
                functionality: v.number(),
                codeQuality: v.number(),
                design: v.number(),
                performance: v.number(),
            })
        ),
        feedback: v.optional(v.string()),
    },
    handler: async (ctx, args) => {
        const identity = await ctx.auth.getUserIdentity();
        if (!identity) {
            throw new Error("Not authenticated");
        }

        const user = await ctx.db
            .query("users")
            .withIndex("by_email", (q) =>
                q.eq("email", identity.email || "")
            )
            .first();

        if (!user) {
            throw new Error("User not found");
        }

        // Check if user has access to this project
        const project = await ctx.db.get(args.projectId);
        if (!project || project.ownerId !== user._id) {
            throw new Error("Project not found or access denied");
        }

        // Create the evaluation
        return ctx.db.insert("evals", {
            projectId: args.projectId,
            runId: args.runId,
            version: args.version,
            status: args.status,
            metrics: args.metrics,
            feedback: args.feedback,
            createdAt: Date.now(),
        });
    },
});

// Update an evaluation
export const update = mutation({
    args: {
        id: v.id("evals"),
        status: v.optional(v.string()),
        metrics: v.optional(
            v.object({
                functionality: v.number(),
                codeQuality: v.number(),
                design: v.number(),
                performance: v.number(),
            })
        ),
        feedback: v.optional(v.string()),
    },
    handler: async (ctx, args) => {
        const identity = await ctx.auth.getUserIdentity();
        if (!identity) {
            throw new Error("Not authenticated");
        }

        // Get the evaluation
        const evalData = await ctx.db.get(args.id);
        if (!evalData) {
            throw new Error("Evaluation not found");
        }

        // Verify user owns the project
        const user = await ctx.db
            .query("users")
            .withIndex("by_email", (q) =>
                q.eq("email", identity.email || "")
            )
            .first();

        if (!user) {
            throw new Error("User not found");
        }

        const project = await ctx.db.get(evalData.projectId);
        if (!project || project.ownerId !== user._id) {
            throw new Error("Project not found or access denied");
        }

        // Update fields that are provided
        const updates: any = {};
        if (args.status !== undefined) {
            updates.status = args.status;
        }
        if (args.metrics !== undefined) {
            updates.metrics = args.metrics;
        }
        if (args.feedback !== undefined) {
            updates.feedback = args.feedback;
        }

        // Update the evaluation
        return ctx.db.patch(args.id, updates);
    },
});

// Update the runId for an evaluation
export const updateRunId = mutation({
    args: {
        id: v.id("evals"),
        runId: v.id("runs"),
    },
    handler: async (ctx, args) => {
        const identity = await ctx.auth.getUserIdentity();
        if (!identity) {
            throw new Error("Not authenticated");
        }

        // Get the evaluation
        const evalData = await ctx.db.get(args.id);
        if (!evalData) {
            throw new Error("Evaluation not found");
        }

        // Verify user owns the project
        const user = await ctx.db
            .query("users")
            .withIndex("by_email", (q) =>
                q.eq("email", identity.email || "")
            )
            .first();

        if (!user) {
            throw new Error("User not found");
        }

        const project = await ctx.db.get(evalData.projectId);
        if (!project || project.ownerId !== user._id) {
            throw new Error("Project not found or access denied");
        }

        // Update the runId
        return ctx.db.patch(args.id, { runId: args.runId });
    },
});



// Get leaderboard data grouped by model and prompt version
export const getLeaderboard = query({
    args: {
        promptVersion: v.optional(v.string()),
        model: v.optional(v.string()),
    },
    handler: async (ctx, args) => {
        const identity = await ctx.auth.getUserIdentity();
        if (!identity) {
            throw new Error("Not authenticated");
        }

        // Get all evaluations
        let evalsQuery = ctx.db.query("evals").filter((q) =>
            q.eq(q.field("status"), "completed")
        );

        // Apply filters if provided
        if (args.promptVersion) {
            evalsQuery = evalsQuery.filter((q) =>
                q.eq(q.field("version"), args.promptVersion)
            );
        }

        const allEvals = await evalsQuery.collect();

        // Get all runs for these evals to get model info
        const runIds = allEvals
            .filter(e => e.runId !== undefined)
            .map(e => e.runId!);

        if (runIds.length === 0) {
            return [];
        }

        const runs = await Promise.all(
            runIds.map(runId => ctx.db.get(runId))
        );

        // Filter by model if provided
        let filteredRuns = runs.filter(r => r !== null) as any[];
        if (args.model) {
            filteredRuns = filteredRuns.filter(r => r.model === args.model);
        }

        if (filteredRuns.length === 0) {
            return [];
        }

        // Match runs back to evals
        const runToEval = new Map();
        allEvals.forEach(e => {
            if (e.runId) {
                runToEval.set(e.runId, e);
            }
        });

        // Group results by model and prompt version
        const groups = new Map();
        filteredRuns.forEach(run => {
            const evalData = runToEval.get(run._id);
            if (!evalData || !evalData.metrics) return;

            const key = `${run.model}|${run.promptVersion}`;
            if (!groups.has(key)) {
                groups.set(key, {
                    model: run.model,
                    promptVersion: run.promptVersion,
                    evals: [],
                    totalLatency: 0,
                    totalTokenUsage: 0,
                    totalCost: 0,
                    metrics: {
                        functionality: 0,
                        codeQuality: 0,
                        design: 0,
                        performance: 0,
                    },
                    passed: 0,
                    total: 0,
                });
            }

            const group = groups.get(key);
            group.evals.push(evalData);
            group.total++;

            // Calculate metrics
            if (evalData.metrics) {
                group.metrics.functionality += evalData.metrics.functionality;
                group.metrics.codeQuality += evalData.metrics.codeQuality;
                group.metrics.design += evalData.metrics.design;
                group.metrics.performance += evalData.metrics.performance;
            }

            // Calculate run stats
            if (run.timings) {
                const totalTime =
                    (run.timings.planMs || 0) +
                    (run.timings.genMs || 0) +
                    (run.timings.validateMs || 0);
                group.totalLatency += totalTime;
            }

            group.totalTokenUsage += run.tokenUsage || 0;
            group.totalCost += run.cost || 0;

            // Count passed evaluations
            const allMetricsAboveThreshold =
                evalData.metrics &&
                evalData.metrics.functionality >= 7 &&
                evalData.metrics.codeQuality >= 7 &&
                evalData.metrics.design >= 6 &&
                evalData.metrics.performance >= 6;

            if (allMetricsAboveThreshold) {
                group.passed++;
            }
        });

        // Calculate averages and format results
        return Array.from(groups.values()).map(group => {
            const count = group.evals.length;
            return {
                model: group.model,
                promptVersion: group.promptVersion,
                evalCount: count,
                passRate: group.passed / group.total,
                avgMetrics: {
                    functionality: group.metrics.functionality / count,
                    codeQuality: group.metrics.codeQuality / count,
                    design: group.metrics.design / count,
                    performance: group.metrics.performance / count,
                },
                avgLatency: group.totalLatency / count,
                avgTokenUsage: group.totalTokenUsage / count,
                avgCost: group.totalCost / count,
            };
        }).sort((a, b) => b.passRate - a.passRate);
    },
});
