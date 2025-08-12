import { action } from "./_generated/server";
import { v } from "convex/values";
import { api } from "./_generated/api";
import { Id } from "./_generated/dataModel";
import OpenAI from "openai";

// Calculate token usage cost
function calculateCost(model: string, tokens: number): number {
    // Pricing rates per 1K tokens (as of August 2025)
    const rates: Record<string, { input: number; output: number }> = {
        "gpt-4-turbo": { input: 0.01, output: 0.03 },
        "gpt-4o": { input: 0.01, output: 0.03 },
        "gpt-4-vision": { input: 0.01, output: 0.03 },
        "gpt-4": { input: 0.03, output: 0.06 },
        "gpt-3.5-turbo": { input: 0.001, output: 0.002 },
    };

    // Default to gpt-4-turbo rates if model not found
    const rate = rates[model] || rates["gpt-4-turbo"];

    // Assuming a 1:3 ratio of input to output tokens
    const inputTokens = Math.floor(tokens * 0.25);
    const outputTokens = tokens - inputTokens;

    return (inputTokens / 1000 * rate.input) + (outputTokens / 1000 * rate.output);
}

// Utility function to detect potential security issues in code
function detectSecurityIssues(code: string): { issues: string[]; severity: 'low' | 'medium' | 'high' } {
    const issues: string[] = [];

    // Check for SQL injection vulnerabilities
    if ((code.includes("query(") || code.includes("execute(")) &&
        code.includes("${") && !code.includes("parameterized")) {
        issues.push("Potential SQL injection vulnerability: String interpolation in database query");
    }

    // Check for hardcoded credentials
    const credentialPatterns = [
        /['"](?:password|pwd|passwd)['"]:\s*['"][^'"]+['"]/i,
        /['"](?:api[_-]?key|apikey)['"]:\s*['"][^'"]+['"]/i,
        /['"](?:auth[_-]?token|token)['"]:\s*['"][^'"]+['"]/i,
        /['"](?:secret)['"]:\s*['"][^'"]+['"]/i,
    ];

    for (const pattern of credentialPatterns) {
        if (pattern.test(code)) {
            issues.push("Potential hardcoded credentials detected");
            break; // Only report this issue once
        }
    }

    // Check for unsafe code evaluation
    if (code.includes("eval(") || code.includes("new Function(")) {
        issues.push("Unsafe code evaluation detected: Use of eval() or new Function()");
    }

    // Check for direct use of user input without validation
    if ((code.includes("req.body") || code.includes("req.params") || code.includes("req.query")) &&
        !code.includes("validate") && !code.includes("sanitize")) {
        issues.push("Potential insufficient input validation: Using request parameters without validation");
    }

    // Check for missing authorization in mutations/queries
    if ((code.includes("mutation") || code.includes("query")) &&
        code.includes("handler") && !code.includes("auth") && !code.includes("ctx.auth")) {
        issues.push("Potential missing authorization check in Convex function");
    }

    // Determine severity based on issue count and types
    let severity: 'low' | 'medium' | 'high' = 'low';
    if (issues.length === 0) {
        return { issues, severity: 'low' };
    } else if (issues.length >= 3) {
        severity = 'high';
    } else if (issues.some(issue =>
        issue.includes("SQL injection") ||
        issue.includes("hardcoded credentials") ||
        issue.includes("Unsafe code evaluation"))) {
        severity = 'high';
    } else if (issues.length >= 2) {
        severity = 'medium';
    }

    return { issues, severity };
}

// Utility function to remove markdown code block wrappers
function removeMarkdownCodeBlocks(content: string): string {
    // Remove ```typescript, ```tsx, ```javascript, etc. from the beginning
    content = content.replace(/^```(\w+)?\s*\n/, '');
    // Remove ``` from the end
    content = content.replace(/\n```\s*$/, '');
    return content;
}

// Utility function to validate TypeScript code
async function validateTypeScript(code: string): Promise<{
    valid: boolean;
    errors: string[];
    warnings: string[];
    codeQualityScore: number;
}> {
    try {
        // In a production environment, we would use a proper TypeScript compiler
        // For this MVP, we'll do some basic validation checks

        const errors: string[] = [];
        const warnings: string[] = [];

        // Check for basic syntax errors
        if (!code.includes("import") && code.length > 50) {
            errors.push("Missing import statements");
        }

        if (code.includes("undefined is not a function") || code.includes("cannot read property")) {
            errors.push("Potential runtime error detected");
        }

        // Check for unmatched brackets/parentheses
        const openBrackets = (code.match(/{/g) || []).length;
        const closeBrackets = (code.match(/}/g) || []).length;
        if (openBrackets !== closeBrackets) {
            errors.push(`Unmatched brackets: ${openBrackets} opening vs ${closeBrackets} closing`);
        }

        const openParens = (code.match(/\(/g) || []).length;
        const closeParens = (code.match(/\)/g) || []).length;
        if (openParens !== closeParens) {
            errors.push(`Unmatched parentheses: ${openParens} opening vs ${closeParens} closing`);
        }

        // Check for common TypeScript patterns
        if (code.includes("defineTable") && !code.includes("index")) {
            errors.push("Schema may be missing indexes");
        }

        if (code.includes("mutation") && !code.includes("args")) {
            errors.push("Mutation missing args definition");
        }

        // Check for TypeScript-specific patterns
        if (code.includes("function") && !code.includes(": ") && !code.includes("=>")) {
            warnings.push("Functions may be missing return type annotations");
        }

        if (code.includes("useState") && !code.includes("<")) {
            warnings.push("React useState hooks may be missing type parameters");
        }

        // Check for error handling
        if (code.includes("try") && !code.includes("catch")) {
            errors.push("Try block without catch");
        }

        // Check for proper async/await usage
        const asyncCount = (code.match(/async/g) || []).length;
        const awaitCount = (code.match(/await/g) || []).length;
        if (asyncCount > 0 && awaitCount === 0) {
            warnings.push("Async function without await usage");
        }

        // Check for potential security issues
        if (code.includes("eval(") || code.includes("new Function(")) {
            errors.push("Potentially unsafe code evaluation detected");
        }

        // Check for proper error throwing
        if (code.includes("throw ") && !code.includes("throw new Error")) {
            warnings.push("Throwing non-Error objects");
        }

        // Calculate code quality score (0-10 scale)
        // Formula: 10 - (errors * 2) - (warnings * 0.5), minimum 0
        const errorPenalty = errors.length * 2;
        const warningPenalty = warnings.length * 0.5;
        const codeQualityScore = Math.max(0, Math.min(10, 10 - errorPenalty - warningPenalty));

        return {
            valid: errors.length === 0,
            errors,
            warnings,
            codeQualityScore
        };
    } catch (error) {
        return {
            valid: false,
            errors: [`Validation error: ${error instanceof Error ? error.message : String(error)}`],
            warnings: [],
            codeQualityScore: 0
        };
    }
}

// Utility function to check for hallucinations in generated code
function checkForHallucinations(code: string, _context: string): {
    detected: boolean;
    issues: string[];
    severity: 'none' | 'low' | 'medium' | 'high';
    confidenceScore: number;
} {
    const issues: string[] = [];

    // Check for references to non-existent libraries
    const suspiciousImports = [
        "convex-react-ui",
        "convex-components",
        "next-convex",
        "react-convex-hooks",
        "convex-dashboard",
        "convex-admin",
        "convex-analytics",
        "convex-storage",
        "next-convex-hooks",
        "convex-auth-utils",
        "convex-storage-s3",
        "next-convex-ssr"
    ];

    for (const lib of suspiciousImports) {
        if (code.includes(`from "${lib}"`) || code.includes(`from '${lib}'`)) {
            issues.push(`Reference to non-existent library: ${lib}`);
        }
    }

    // Check for inconsistent table names
    const tableMatches = Array.from(code.matchAll(/defineTable\(\s*{([^}]*)}/g));
    const tableNames = tableMatches.map(match => {
        const tableDefBlock = match[0];
        // Extract the name from something like: users: defineTable({
        const nameMatch = tableDefBlock.match(/(\w+):\s*defineTable/);
        return nameMatch ? nameMatch[1] : null;
    }).filter(Boolean) as string[];

    // Check if these table names are actually used in queries/mutations
    for (const tableName of tableNames) {
        if (tableName && !code.includes(`"${tableName}"`) && !code.includes(`'${tableName}'`)) {
            issues.push(`Table "${tableName}" is defined but may not be used`);
        }
    }

    // Check for non-existent Convex API patterns
    const suspiciousConvexPatterns = [
        "ctx.db.findMany",
        "ctx.db.findOne",
        "ctx.db.findFirst",
        "ctx.db.update(",
        "ctx.db.delete(",
        "ctx.db.transaction",
        "db.where(",
        "ctx.db.raw(",
        "convex.httpAction",
        "convex.cronJob"
    ];

    for (const pattern of suspiciousConvexPatterns) {
        if (code.includes(pattern)) {
            issues.push(`Suspicious Convex API usage: "${pattern}"`);
        }
    }

    // Check for non-existent React/Next.js patterns
    const suspiciousReactNextPatterns = [
        "useStaticProps",
        "useServerState",
        "getInitialData",
        "useNextContext",
        "withNextData"
    ];

    for (const pattern of suspiciousReactNextPatterns) {
        if (code.includes(pattern)) {
            issues.push(`Suspicious React/Next.js API usage: "${pattern}"`);
        }
    }

    // Check for made-up UI components
    const suspiciousUIComponents = [
        "<ConvexCard",
        "<ConvexLayout",
        "<ConvexContainer",
        "<ConvexDataTable",
        "<ConvexChart",
        "<ConvexDashboard",
        "<ConvexForm",
        "<NextConvexForm",
        "<ConvexUI.",
        "<ConvexView"
    ];

    for (const component of suspiciousUIComponents) {
        if (code.includes(component)) {
            issues.push(`Reference to non-existent UI component: "${component}"`);
        }
    }

    // Determine severity based on number and type of issues
    let severity: 'none' | 'low' | 'medium' | 'high' = 'none';
    if (issues.length === 0) {
        severity = 'none';
    } else if (issues.length <= 2) {
        severity = 'low';
    } else if (issues.length <= 5) {
        severity = 'medium';
    } else {
        severity = 'high';
    }

    // Calculate confidence score (0-1) inversely proportional to issue count
    // More issues = lower confidence in the code
    const confidenceScore = Math.max(0, 1 - (issues.length * 0.1));

    return {
        detected: issues.length > 0,
        issues,
        severity,
        confidenceScore
    };
}

// Run the agent to generate a complete app from a spec
export const run = action({
    args: {
        projectId: v.id("projects"),
        inputSpec: v.string(),
        model: v.string(),
        promptVersion: v.string(),
        runId: v.optional(v.id("runs")), // Optional existing run ID
    },
    handler: async (ctx, args): Promise<{ success: boolean; runId: Id<"runs">; error?: string; metrics?: any }> => {
        const { projectId, model, promptVersion, inputSpec, runId: existingRunId } = args;

        // Tracking metrics
        const metrics = {
            tokenUsage: {
                planning: 0,
                schema: 0,
                queries: 0,
                mutations: 0,
                ui: 0,
                total: 0
            },
            timings: {
                planMs: 0,
                genMs: 0,
                validateMs: 0,
                total: 0
            },
            validation: {
                schemaErrors: [] as string[],
                queriesErrors: [] as string[],
                mutationsErrors: [] as string[],
                uiErrors: [] as string[],
                schemaWarnings: [] as string[],
                queriesWarnings: [] as string[],
                mutationsWarnings: [] as string[],
                uiWarnings: [] as string[],
                hallucinationIssues: [] as string[],
                securityIssues: [] as string[]
            },
            quality: {
                schemaScore: 0,
                queriesScore: 0,
                mutationsScore: 0,
                uiScore: 0,
                overallScore: 0,
                hallucinationSeverity: 'none' as 'none' | 'low' | 'medium' | 'high',
                securityRisk: 'low' as 'low' | 'medium' | 'high',
                confidenceScore: 1 // 0-1 scale, higher is better
            },
            cost: 0,
            estimatedCompletionTime: 0, // in milliseconds
            modelDetails: {
                name: model,
                version: promptVersion,
                usageBreakdown: {
                    promptTokens: 0,
                    completionTokens: 0
                }
            }
        };

        // Create a new run in the database or use existing one
        const runId = existingRunId || await ctx.runMutation(api.runs.create, {
            projectId,
            model,
            promptVersion,
        });

        const runStartTime = Date.now();

        try {
            // Initialize OpenAI client
            const openai = new OpenAI({
                apiKey: process.env.OPENAI_API_KEY,
            });

            // Update run to "planning"
            await ctx.runMutation(api.runs.update, {
                id: runId,
                status: "planning",
                timings: { planMs: 0 },
            });

            // Start the planning phase
            const planStartTime = Date.now();

            // Plan the application structure based on the input spec
            const planResponse = await openai.chat.completions.create({
                model: model || "gpt-4-turbo",
                messages: [
                    {
                        role: "system",
                        content: `You are an expert full-stack developer who specializes in creating applications with Next.js, React, and Convex.
                     Your task is to plan the structure of an application based on the given specification.
                     Outline the main components, database schema, and API endpoints that will be needed.
                     Be concise but comprehensive.`
                    },
                    {
                        role: "user",
                        content: `Please plan an application with the following specification:\n\n${inputSpec}`
                    }
                ],
                temperature: 0.7,
            });

            const plan = planResponse.choices[0]?.message?.content || "No plan generated";
            const planEndTime = Date.now();
            const planDuration = planEndTime - planStartTime;

            // Update metrics
            metrics.tokenUsage.planning = planResponse.usage?.total_tokens || 0;
            metrics.tokenUsage.total += metrics.tokenUsage.planning;
            metrics.timings.planMs = planDuration;

            // Update run to "generating"
            await ctx.runMutation(api.runs.update, {
                id: runId,
                status: "generating",
                timings: { planMs: planDuration },
                tokenUsage: metrics.tokenUsage.total,
            });

            // Start the code generation phase
            const genStartTime = Date.now();

            // Generate the schema file
            const schemaResponse = await openai.chat.completions.create({
                model: model || "gpt-4-turbo",
                messages: [
                    {
                        role: "system",
                        content: `You are an expert Convex developer. Create a schema.ts file for a Convex database based on the plan.
                     Include all necessary tables with appropriate fields and indexes.
                     Only output valid TypeScript code without any explanation.`
                    },
                    {
                        role: "user",
                        content: `Create a schema.ts file for this application plan:\n\n${plan}`
                    }
                ],
                temperature: 0.2,
            });

            const schemaContent = schemaResponse.choices[0]?.message?.content ||
                `import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  // Default schema if generation failed
  items: defineTable({
    name: v.string(),
    description: v.optional(v.string()),
    createdAt: v.number(),
    userId: v.id("users"),
  })
  .index("by_user", ["userId"]),
});`;

            // Update metrics
            metrics.tokenUsage.schema = schemaResponse.usage?.total_tokens || 0;
            metrics.tokenUsage.total += metrics.tokenUsage.schema;

            // Validate schema code
            const schemaValidation = await validateTypeScript(schemaContent);
            metrics.validation.schemaErrors = schemaValidation.errors;
            metrics.validation.schemaWarnings = schemaValidation.warnings;
            metrics.quality.schemaScore = schemaValidation.codeQualityScore;

            // Check for hallucinations in schema
            const schemaHallucinationCheck = checkForHallucinations(schemaContent, plan);
            if (schemaHallucinationCheck.detected) {
                metrics.validation.hallucinationIssues.push(
                    ...schemaHallucinationCheck.issues.map(issue => `Schema: ${issue}`)
                );
                // Update hallucination metrics if this is worse than current severity
                const severityRank = {
                    'none': 0,
                    'low': 1,
                    'medium': 2,
                    'high': 3
                };

                if (severityRank[schemaHallucinationCheck.severity] > severityRank[metrics.quality.hallucinationSeverity]) {
                    metrics.quality.hallucinationSeverity = schemaHallucinationCheck.severity;
                }

                // Update confidence score (take the minimum)
                metrics.quality.confidenceScore = Math.min(
                    metrics.quality.confidenceScore,
                    schemaHallucinationCheck.confidenceScore
                );
            }

            // Create the schema artifact
            await ctx.runMutation(api.artifacts.upsert, {
                projectId,
                path: "convex/schema.ts",
                content: removeMarkdownCodeBlocks(schemaContent),
            });

            // Generate API queries file
            const queriesResponse = await openai.chat.completions.create({
                model: model || "gpt-4-turbo",
                messages: [
                    {
                        role: "system",
                        content: `You are an expert Convex developer. Create a queries.ts file with Convex query functions
                     based on the schema and application plan. Include all necessary imports and type safety.
                     Only output valid TypeScript code without any explanation.`
                    },
                    {
                        role: "user",
                        content: `Create query functions for this application plan:\n\n${plan}\n\nWith this schema:\n\n${schemaContent}`
                    }
                ],
                temperature: 0.2,
            });

            const queriesContent = queriesResponse.choices[0]?.message?.content ||
                `import { query } from "./_generated/server";
import { v } from "convex/values";

// Default queries if generation failed
export const list = query({
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];
    
    const user = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", identity.email))
      .unique();
      
    if (!user) return [];
    
    return await ctx.db
      .query("items")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();
  },
});`;

            // Update metrics
            metrics.tokenUsage.queries = queriesResponse.usage?.total_tokens || 0;
            metrics.tokenUsage.total += metrics.tokenUsage.queries;

            // Validate queries code
            const queriesValidation = await validateTypeScript(queriesContent);
            metrics.validation.queriesErrors = queriesValidation.errors;
            metrics.validation.queriesWarnings = queriesValidation.warnings;
            metrics.quality.queriesScore = queriesValidation.codeQualityScore;

            // Check for hallucinations in queries
            const queriesHallucinationCheck = checkForHallucinations(queriesContent, schemaContent);
            if (queriesHallucinationCheck.detected) {
                metrics.validation.hallucinationIssues.push(
                    ...queriesHallucinationCheck.issues.map(issue => `Queries: ${issue}`)
                );

                // Update hallucination metrics if this is worse than current severity
                const severityRank = {
                    'none': 0,
                    'low': 1,
                    'medium': 2,
                    'high': 3
                };

                if (severityRank[queriesHallucinationCheck.severity] > severityRank[metrics.quality.hallucinationSeverity]) {
                    metrics.quality.hallucinationSeverity = queriesHallucinationCheck.severity;
                }

                // Update confidence score (take the minimum)
                metrics.quality.confidenceScore = Math.min(
                    metrics.quality.confidenceScore,
                    queriesHallucinationCheck.confidenceScore
                );
            }

            // Create the queries artifact
            await ctx.runMutation(api.artifacts.upsert, {
                projectId,
                path: "convex/queries.ts",
                content: removeMarkdownCodeBlocks(queriesContent),
            });

            // Generate API mutations file
            const mutationsResponse = await openai.chat.completions.create({
                model: model || "gpt-4-turbo",
                messages: [
                    {
                        role: "system",
                        content: `You are an expert Convex developer. Create a mutations.ts file with Convex mutation functions
                     based on the schema and application plan. Include all necessary imports and type safety.
                     Only output valid TypeScript code without any explanation.`
                    },
                    {
                        role: "user",
                        content: `Create mutation functions for this application plan:\n\n${plan}\n\nWith this schema:\n\n${schemaContent}`
                    }
                ],
                temperature: 0.2,
            });

            const mutationsContent = mutationsResponse.choices[0]?.message?.content ||
                `import { mutation } from "./_generated/server";
import { v } from "convex/values";

// Default mutations if generation failed
export const create = mutation({
  args: {
    name: v.string(),
    description: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");
    
    const user = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", identity.email))
      .unique();
      
    if (!user) throw new Error("User not found");
    
    return await ctx.db.insert("items", {
      name: args.name,
      description: args.description,
      userId: user._id,
      createdAt: Date.now(),
    });
  },
});`;

            // Update metrics
            metrics.tokenUsage.mutations = mutationsResponse.usage?.total_tokens || 0;
            metrics.tokenUsage.total += metrics.tokenUsage.mutations;

            // Validate mutations code
            const mutationsValidation = await validateTypeScript(mutationsContent);
            metrics.validation.mutationsErrors = mutationsValidation.errors;
            metrics.validation.mutationsWarnings = mutationsValidation.warnings;
            metrics.quality.mutationsScore = mutationsValidation.codeQualityScore;

            // Check for hallucinations in mutations
            const mutationsHallucinationCheck = checkForHallucinations(mutationsContent, schemaContent);
            if (mutationsHallucinationCheck.detected) {
                metrics.validation.hallucinationIssues.push(
                    ...mutationsHallucinationCheck.issues.map(issue => `Mutations: ${issue}`)
                );

                // Update hallucination metrics if this is worse than current severity
                const severityRank = {
                    'none': 0,
                    'low': 1,
                    'medium': 2,
                    'high': 3
                };

                if (severityRank[mutationsHallucinationCheck.severity] > severityRank[metrics.quality.hallucinationSeverity]) {
                    metrics.quality.hallucinationSeverity = mutationsHallucinationCheck.severity;
                }

                // Update confidence score (take the minimum)
                metrics.quality.confidenceScore = Math.min(
                    metrics.quality.confidenceScore,
                    mutationsHallucinationCheck.confidenceScore
                );
            }

            // Create the mutations artifact
            await ctx.runMutation(api.artifacts.upsert, {
                projectId,
                path: "convex/mutations.ts",
                content: removeMarkdownCodeBlocks(mutationsContent),
            });

            // Generate main UI component
            const uiResponse = await openai.chat.completions.create({
                model: model || "gpt-4-turbo",
                messages: [
                    {
                        role: "system",
                        content: `You are an expert Next.js and React developer. Create a main page component for a Next.js app
                     that uses the Convex backend. Include all necessary imports, proper typing, and React hooks.
                     The component should be fully functional and use modern React patterns.
                     Only output valid TypeScript/JSX code without any explanation.`
                    },
                    {
                        role: "user",
                        content: `Create a main page component for this application plan:\n\n${plan}\n\nWith these backend files:
                     Schema:\n${schemaContent}\n
                     Queries:\n${queriesContent}\n
                     Mutations:\n${mutationsContent}`
                    }
                ],
                temperature: 0.2,
            });

            const uiComponentContent = uiResponse.choices[0]?.message?.content ||
                `'use client';

import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";

export default function MainPage() {
  const items = useQuery(api.queries.list);
  const createItem = useMutation(api.mutations.create);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    
    await createItem({ name, description: description || undefined });
    setName("");
    setDescription("");
  };
  
  return (
    <div className="max-w-4xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-6">Generated Application</h1>
      
      <form onSubmit={handleSubmit} className="mb-8 space-y-4">
        <div>
          <label className="block mb-1">Name</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full p-2 border rounded"
          />
        </div>
        <div>
          <label className="block mb-1">Description</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full p-2 border rounded"
          />
        </div>
        <button 
          type="submit"
          className="px-4 py-2 bg-blue-500 text-white rounded"
        >
          Create Item
        </button>
      </form>
      
      <div>
        <h2 className="text-xl font-semibold mb-4">Items</h2>
        {items?.length === 0 && (
          <p className="text-gray-500">No items yet</p>
        )}
        <ul className="space-y-2">
          {items?.map((item) => (
            <li key={item._id} className="p-4 border rounded">
              <h3 className="font-medium">{item.name}</h3>
              {item.description && (
                <p className="text-gray-600 mt-1">{item.description}</p>
              )}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}`;

            // Update metrics
            metrics.tokenUsage.ui = uiResponse.usage?.total_tokens || 0;
            metrics.tokenUsage.total += metrics.tokenUsage.ui;

            // Validate UI code
            const uiValidation = await validateTypeScript(uiComponentContent);
            metrics.validation.uiErrors = uiValidation.errors;
            metrics.validation.uiWarnings = uiValidation.warnings;
            metrics.quality.uiScore = uiValidation.codeQualityScore;

            // Check for hallucinations in UI
            const uiHallucinationCheck = checkForHallucinations(
                uiComponentContent,
                `${schemaContent}\n${queriesContent}\n${mutationsContent}`
            );
            if (uiHallucinationCheck.detected) {
                metrics.validation.hallucinationIssues.push(
                    ...uiHallucinationCheck.issues.map(issue => `UI: ${issue}`)
                );

                // Update hallucination metrics if this is worse than current severity
                const severityRank = {
                    'none': 0,
                    'low': 1,
                    'medium': 2,
                    'high': 3
                };

                if (severityRank[uiHallucinationCheck.severity] > severityRank[metrics.quality.hallucinationSeverity]) {
                    metrics.quality.hallucinationSeverity = uiHallucinationCheck.severity;
                }

                // Update confidence score (take the minimum)
                metrics.quality.confidenceScore = Math.min(
                    metrics.quality.confidenceScore,
                    uiHallucinationCheck.confidenceScore
                );
            }

            // Create the UI component artifact
            await ctx.runMutation(api.artifacts.upsert, {
                projectId,
                path: "app/main/page.tsx",
                content: removeMarkdownCodeBlocks(uiComponentContent),
            });

            // Generate package.json file for the project
            const packageJsonContent = JSON.stringify({
                name: "webcontainer-project",
                version: "1.0.0",
                private: true,
                scripts: {
                    dev: "next dev",
                    build: "next build",
                    lint: "eslint . --ext .js,.jsx,.ts,.tsx"
                },
                dependencies: {
                    "next": "^14.0.0",
                    "react": "^18.2.0",
                    "react-dom": "^18.2.0",
                    "convex": "^1.0.0",
                },
                devDependencies: {
                    "@types/node": "^20.0.0",
                    "@types/react": "^18.2.0",
                    "typescript": "^5.0.0",
                    "eslint": "^8.0.0"
                }
            }, null, 2);

            // Create the package.json artifact
            await ctx.runMutation(api.artifacts.upsert, {
                projectId,
                path: "package.json",
                content: packageJsonContent,
            });

            // Generate tsconfig.json file for TypeScript configuration
            const tsconfigContent = JSON.stringify({
                compilerOptions: {
                    lib: [
                        "dom",
                        "dom.iterable",
                        "esnext"
                    ],
                    allowJs: true,
                    skipLibCheck: true,
                    strict: false,
                    noEmit: true,
                    incremental: true,
                    module: "esnext",
                    esModuleInterop: true,
                    moduleResolution: "node",
                    resolveJsonModule: true,
                    isolatedModules: true,
                    jsx: "preserve",
                    plugins: [
                        {
                            name: "next"
                        }
                    ]
                },
                include: [
                    "next-env.d.ts",
                    ".next/types/**/*.ts",
                    "**/*.ts",
                    "**/*.tsx"
                ],
                exclude: [
                    "node_modules"
                ]
            }, null, 2);

            // Create the tsconfig.json artifact
            await ctx.runMutation(api.artifacts.upsert, {
                projectId,
                path: "tsconfig.json",
                content: tsconfigContent,
            });


            const genEndTime = Date.now();
            const genDuration = genEndTime - genStartTime;
            metrics.timings.genMs = genDuration;

            // Update run to "validating"
            await ctx.runMutation(api.runs.update, {
                id: runId,
                status: "validating",
                timings: { planMs: metrics.timings.planMs, genMs: metrics.timings.genMs },
                tokenUsage: metrics.tokenUsage.total,
            });

            // Start validation
            const validateStartTime = Date.now();

            // Calculate code quality score based on validation results
            let totalErrors = 0;
            let totalWarnings = 0;

            // Properly type the iteration over validation fields
            type ErrorKey = 'schemaErrors' | 'queriesErrors' | 'mutationsErrors' | 'uiErrors' | 'hallucinationIssues';
            type WarningKey = 'schemaWarnings' | 'queriesWarnings' | 'mutationsWarnings' | 'uiWarnings';

            const errorKeys: ErrorKey[] = [
                'schemaErrors', 'queriesErrors', 'mutationsErrors', 'uiErrors', 'hallucinationIssues'
            ];

            const warningKeys: WarningKey[] = [
                'schemaWarnings', 'queriesWarnings', 'mutationsWarnings', 'uiWarnings'
            ];

            for (const key of errorKeys) {
                totalErrors += metrics.validation[key].length;
            }

            for (const key of warningKeys) {
                totalWarnings += metrics.validation[key].length;
            }

            // Score from 0-10 with 10 being perfect
            const qualityScore = Math.max(0, 10 - Math.min(10, totalErrors * 0.5 + totalWarnings * 0.1));
            metrics.quality.overallScore = qualityScore;

            // Estimate token usage breakdown based on typical ratios
            const promptTokenRatio = 0.3; // 30% of tokens are typically prompt tokens
            metrics.modelDetails.usageBreakdown.promptTokens = Math.round(metrics.tokenUsage.total * promptTokenRatio);
            metrics.modelDetails.usageBreakdown.completionTokens = metrics.tokenUsage.total - metrics.modelDetails.usageBreakdown.promptTokens;

            // Estimate total completion time (already tracked in timings)
            metrics.estimatedCompletionTime = metrics.timings.planMs + metrics.timings.genMs + metrics.timings.validateMs;

            // Perform runtime validation checks
            // In a full implementation, we would:
            // 1. Spin up a temporary environment
            // 2. Run the TypeScript compiler on the generated code
            // 3. Execute a sequence of API calls to test basic functionality
            // For this MVP, we'll simulate this with a basic check

            let validationPassed = true;
            const validationErrors: string[] = [];

            // Check for critical errors in generated code
            if (metrics.validation.schemaErrors.length > 0) {
                validationPassed = false;
                validationErrors.push(`Schema validation failed: ${metrics.validation.schemaErrors.join(", ")}`);
            }

            if (metrics.validation.hallucinationIssues.length > 3) {
                validationPassed = false;
                validationErrors.push(`Too many potential hallucinations detected: ${metrics.validation.hallucinationIssues.length}`);
            }

            // Check for security issues
            const allGeneratedCode = `${schemaContent}\n${queriesContent}\n${mutationsContent}\n${uiComponentContent}`;
            const securityCheck = detectSecurityIssues(allGeneratedCode);
            metrics.validation.securityIssues.push(...securityCheck.issues);
            metrics.quality.securityRisk = securityCheck.severity;

            if (securityCheck.severity === 'high') {
                validationPassed = false;
                validationErrors.push(`High security risk detected: ${securityCheck.issues.join(", ")}`);
            }

            // Check for severe type inconsistencies between artifacts
            const schemaTableMatch = schemaContent.match(/(\w+):\s*defineTable/g);
            const tableNames = schemaTableMatch
                ? schemaTableMatch.map(match => match.replace(/:\s*defineTable.*$/, '').trim())
                : [];

            for (const tableName of tableNames) {
                if (!queriesContent.includes(`"${tableName}"`) && !queriesContent.includes(`'${tableName}'`)) {
                    validationPassed = false;
                    validationErrors.push(`Table "${tableName}" defined in schema but not used in queries`);
                }

                if (!mutationsContent.includes(`"${tableName}"`) && !mutationsContent.includes(`'${tableName}'`)) {
                    validationPassed = false;
                    validationErrors.push(`Table "${tableName}" defined in schema but not used in mutations`);
                }
            }

            const validateEndTime = Date.now();
            const validateDuration = validateEndTime - validateStartTime;
            metrics.timings.validateMs = validateDuration;
            metrics.timings.total = metrics.timings.planMs + metrics.timings.genMs + metrics.timings.validateMs;

            // Calculate cost using the more accurate model-specific pricing
            metrics.cost = calculateCost(model || "gpt-4-turbo", metrics.tokenUsage.total);

            // Update run with final status and metrics
            const finalStatus = validationPassed ? "completed" : "failed";
            const errorMessage = validationPassed ? undefined : validationErrors.join("; ");

            await ctx.runMutation(api.runs.update, {
                id: runId,
                status: finalStatus,
                timings: {
                    planMs: metrics.timings.planMs,
                    genMs: metrics.timings.genMs,
                    validateMs: metrics.timings.validateMs
                },
                tokenUsage: metrics.tokenUsage.total,
                cost: metrics.cost,
                error: errorMessage,
            });

            return {
                success: validationPassed,
                runId,
                error: errorMessage,
                metrics: {
                    tokenUsage: metrics.tokenUsage,
                    timings: metrics.timings,
                    cost: metrics.cost,
                    qualityScore: metrics.quality.overallScore,
                    validationIssues: validationErrors,
                    hallucinationIssues: metrics.validation.hallucinationIssues,
                    securityIssues: metrics.validation.securityIssues,
                    quality: {
                        schemaScore: metrics.quality.schemaScore,
                        queriesScore: metrics.quality.queriesScore,
                        mutationsScore: metrics.quality.mutationsScore,
                        uiScore: metrics.quality.uiScore,
                        overallScore: metrics.quality.overallScore,
                        hallucinationSeverity: metrics.quality.hallucinationSeverity,
                        securityRisk: metrics.quality.securityRisk,
                        confidenceScore: metrics.quality.confidenceScore
                    },
                    warnings: {
                        schema: metrics.validation.schemaWarnings,
                        queries: metrics.validation.queriesWarnings,
                        mutations: metrics.validation.mutationsWarnings,
                        ui: metrics.validation.uiWarnings
                    },
                    modelDetails: metrics.modelDetails
                }
            };

        } catch (error) {
            // Calculate the elapsed time if an error occurred
            const errorTime = Date.now();
            const totalRunTime = errorTime - runStartTime;

            // Update metrics with what we have so far
            metrics.timings.total = totalRunTime;

            // Estimate cost of tokens used up to the error
            metrics.cost = calculateCost(model || "gpt-4-turbo", metrics.tokenUsage.total);

            // Update run to "failed" with detailed error and available metrics
            const errorMessage = error instanceof Error ? error.message : String(error);

            await ctx.runMutation(api.runs.update, {
                id: runId,
                status: "failed",
                error: errorMessage,
                timings: {
                    planMs: metrics.timings.planMs,
                    genMs: metrics.timings.genMs,
                    validateMs: metrics.timings.validateMs
                },
                tokenUsage: metrics.tokenUsage.total,
                cost: metrics.cost,
            });

            return {
                success: false,
                runId,
                error: errorMessage,
                metrics: {
                    tokenUsage: metrics.tokenUsage,
                    timings: metrics.timings,
                    cost: metrics.cost,
                    qualityScore: 0, // Zero score for failed runs
                    errorContext: error instanceof Error ? error.stack : undefined,
                    securityIssues: metrics.validation.securityIssues,
                    quality: {
                        schemaScore: metrics.quality.schemaScore,
                        queriesScore: metrics.quality.queriesScore,
                        mutationsScore: metrics.quality.mutationsScore,
                        uiScore: metrics.quality.uiScore,
                        overallScore: 0, // Zero score for failed runs
                        hallucinationSeverity: metrics.quality.hallucinationSeverity,
                        securityRisk: metrics.quality.securityRisk,
                        confidenceScore: 0 // Zero confidence for failed runs
                    },
                    modelDetails: metrics.modelDetails
                }
            };
        }
    },
});
