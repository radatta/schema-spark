import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";

// Initialize OpenAI client
const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

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

// Utility function to validate TypeScript code
async function validateTypeScript(code: string): Promise<{
    valid: boolean;
    errors: string[];
    warnings: string[];
    codeQualityScore: number;
}> {
    try {
        const errors: string[] = [];
        const warnings: string[] = [];

        // Check for basic syntax errors
        if (!code.includes("import") && code.length > 50) {
            errors.push("Missing import statements");
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

        // Calculate code quality score (0-10 scale)
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

export async function POST(
    request: NextRequest,
    { params }: { params: { runId: string } }
) {
    try {
        const runId = params.runId as Id<"runs">;
        const body = await request.json();
        const { projectId, model = "gpt-4-turbo", _promptVersion = "v1", authToken } = body;

        if (!authToken) {
            return NextResponse.json(
                { error: "Authentication token required" },
                { status: 401 }
            );
        }

        // Initialize Convex client with auth token
        const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);
        convex.setAuth(authToken);

        // Get the run to retrieve the inputSpec
        const run = await convex.query(api.runs.get, { id: runId });
        if (!run) {
            return NextResponse.json(
                { error: "Run not found" },
                { status: 404 }
            );
        }

        const inputSpec = run.inputSpec;
        if (!inputSpec) {
            return NextResponse.json(
                { error: "No input specification found for this run" },
                { status: 400 }
            );
        }

        // Create a readable stream for Server-Sent Events
        const stream = new ReadableStream({
            async start(controller) {
                const encoder = new TextEncoder();

                // Helper function to send SSE data
                const sendEvent = (event: string, data: any) => {
                    const message = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
                    controller.enqueue(encoder.encode(message));
                };

                try {
                    // Update run status to "planning"
                    await convex.mutation(api.runs.update, {
                        id: runId,
                        status: "planning",
                        timings: { planMs: 0 },
                    });

                    sendEvent("status", { phase: "planning", message: "Planning application structure..." });

                    // Phase 1: Planning
                    const planResponse = await openai.chat.completions.create({
                        model,
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
                                content: `Create a detailed plan for: ${inputSpec}`
                            }
                        ],
                        stream: true, // Enable streaming
                    });

                    let planContent = "";
                    for await (const chunk of planResponse) {
                        const delta = chunk.choices[0]?.delta?.content || "";
                        if (delta) {
                            planContent += delta;
                            sendEvent("plan_chunk", { content: delta, accumulated: planContent });
                        }
                    }

                    sendEvent("plan_complete", { content: planContent });

                    // Update run status to "generating"
                    await convex.mutation(api.runs.update, {
                        id: runId,
                        status: "generating",
                    });

                    sendEvent("status", { phase: "generating", message: "Generating application files..." });

                    // Phase 2: Generate Schema
                    await generateSchema(sendEvent, planContent, inputSpec, model, projectId, convex);

                    // Phase 3: Generate Queries
                    await generateQueries(sendEvent, planContent, inputSpec, model, projectId, convex);

                    // Phase 4: Generate Mutations  
                    await generateMutations(sendEvent, planContent, inputSpec, model, projectId, convex);

                    // Phase 5: Generate UI
                    await generateUI(sendEvent, planContent, inputSpec, model, projectId, convex);

                    // Phase 6: Generate Project Configuration Files
                    sendEvent("status", { phase: "configuring", message: "Generating project configuration..." });
                    await generateProjectConfig(sendEvent, projectId, convex);

                    // Phase 7: Validation and Quality Check
                    sendEvent("status", { phase: "validating", message: "Validating generated code..." });
                    await performValidation(sendEvent, projectId, convex);

                    // Complete the run
                    await convex.mutation(api.runs.update, {
                        id: runId,
                        status: "completed",
                    });

                    sendEvent("complete", { message: "Generation completed successfully!" });

                } catch (error) {
                    console.error("Streaming error:", error);
                    sendEvent("error", {
                        message: error instanceof Error ? error.message : "An unknown error occurred"
                    });

                    // Update run status to failed
                    await convex.mutation(api.runs.update, {
                        id: runId,
                        status: "failed",
                        error: error instanceof Error ? error.message : "Unknown error",
                    });
                } finally {
                    controller.close();
                }
            }
        });

        return new Response(stream, {
            headers: {
                "Content-Type": "text/event-stream",
                "Cache-Control": "no-cache",
                "Connection": "keep-alive",
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Methods": "POST",
                "Access-Control-Allow-Headers": "Content-Type",
            },
        });

    } catch (error) {
        console.error("API route error:", error);
        return NextResponse.json(
            { error: "Internal server error" },
            { status: 500 }
        );
    }
}

// Helper function to generate schema with streaming
async function generateSchema(
    sendEvent: (event: string, data: any) => void,
    plan: string,
    inputSpec: string,
    model: string,
    projectId: Id<"projects">,
    convex: ConvexHttpClient
) {
    sendEvent("status", { phase: "schema", message: "Generating database schema..." });
    sendEvent("file_start", { filePath: "convex/schema.ts" });

    const schemaResponse = await openai.chat.completions.create({
        model,
        messages: [
            {
                role: "system",
                content: `You are an expert at designing Convex database schemas.
         Create a complete schema.ts file that defines all the tables needed for the application.
         Use proper Convex table definitions with appropriate field types and indexes.
         Include all necessary imports and exports. Only output valid compilable TypeScript code without any explanation without \`\`\`typescript\`\`\``
            },
            {
                role: "user",
                content: `Based on this plan:\n${plan}\n\nCreate a schema.ts file for: ${inputSpec}`
            }
        ],
        stream: true,
    });

    let schemaContent = "";
    const filePath = "convex/schema.ts";

    for await (const chunk of schemaResponse) {
        const delta = chunk.choices[0]?.delta?.content || "";
        if (delta) {
            schemaContent += delta;
            // Send chunk-by-chunk updates for real-time display
            sendEvent("file_chunk", {
                filePath,
                content: delta,
                accumulated: schemaContent,
                isStreaming: true
            });
        }
    }

    // Save completed schema to Convex
    await convex.mutation(api.artifacts.upsert, {
        projectId,
        path: filePath,
        content: schemaContent,
    });

    sendEvent("file_complete", { filePath, content: schemaContent });
}

// Helper function to generate queries with streaming
async function generateQueries(
    sendEvent: (event: string, data: any) => void,
    plan: string,
    inputSpec: string,
    model: string,
    projectId: Id<"projects">,
    convex: ConvexHttpClient
) {
    sendEvent("status", { phase: "queries", message: "Generating database queries..." });
    sendEvent("file_start", { filePath: "convex/queries.ts" });

    const queriesResponse = await openai.chat.completions.create({
        model,
        messages: [
            {
                role: "system",
                content: `You are an expert at creating Convex database queries.
         Create comprehensive query functions for reading data from the database.
         Use proper Convex query patterns and include all necessary imports. Only output valid compilable TypeScript code without any explanation without \`\`\`typescript\`\`\``
            },
            {
                role: "user",
                content: `Based on this plan:\n${plan}\n\nCreate query functions for: ${inputSpec}`
            }
        ],
        stream: true,
    });

    let queriesContent = "";
    const filePath = "convex/queries.ts";

    for await (const chunk of queriesResponse) {
        const delta = chunk.choices[0]?.delta?.content || "";
        if (delta) {
            queriesContent += delta;
            // Send chunk-by-chunk updates for real-time display
            sendEvent("file_chunk", {
                filePath,
                content: delta,
                accumulated: queriesContent,
                isStreaming: true
            });
        }
    }

    // Save completed queries to Convex
    await convex.mutation(api.artifacts.upsert, {
        projectId,
        path: filePath,
        content: queriesContent,
    });

    sendEvent("file_complete", { filePath, content: queriesContent });
}

// Helper function to generate mutations with streaming
async function generateMutations(
    sendEvent: (event: string, data: any) => void,
    plan: string,
    inputSpec: string,
    model: string,
    projectId: Id<"projects">,
    convex: ConvexHttpClient
) {
    sendEvent("status", { phase: "mutations", message: "Generating database mutations..." });
    sendEvent("file_start", { filePath: "convex/mutations.ts" });

    const mutationsResponse = await openai.chat.completions.create({
        model,
        messages: [
            {
                role: "system",
                content: `You are an expert at creating Convex database mutations.
         Create comprehensive mutation functions for writing data to the database.
         Use proper Convex mutation patterns and include all necessary imports. Only output valid compilable TypeScript code without any explanation without \`\`\`typescript\`\`\``
            },
            {
                role: "user",
                content: `Based on this plan:\n${plan}\n\nCreate mutation functions for: ${inputSpec}`
            }
        ],
        stream: true,
    });

    let mutationsContent = "";
    const filePath = "convex/mutations.ts";

    for await (const chunk of mutationsResponse) {
        const delta = chunk.choices[0]?.delta?.content || "";
        if (delta) {
            mutationsContent += delta;
            // Send chunk-by-chunk updates for real-time display
            sendEvent("file_chunk", {
                filePath,
                content: delta,
                accumulated: mutationsContent,
                isStreaming: true
            });
        }
    }

    // Save completed mutations to Convex
    await convex.mutation(api.artifacts.upsert, {
        projectId,
        path: filePath,
        content: mutationsContent,
    });

    sendEvent("file_complete", { filePath, content: mutationsContent });
}

// Helper function to generate UI with streaming
async function generateUI(
    sendEvent: (event: string, data: any) => void,
    plan: string,
    inputSpec: string,
    model: string,
    projectId: Id<"projects">,
    convex: ConvexHttpClient
) {
    sendEvent("status", { phase: "ui", message: "Generating user interface..." });
    sendEvent("file_start", { filePath: "app/page.tsx" });

    const uiResponse = await openai.chat.completions.create({
        model,
        messages: [
            {
                role: "system",
                content: `You are an expert React and Next.js developer.
         Create a complete React component that implements the user interface for the application.
         Use modern React patterns, TypeScript, and Tailwind CSS for styling. If it is a client component, mark it as such with "use client" at the top.
         Include proper Convex integration for data fetching and mutations. Only output valid compilable TypeScript code without any explanation without \`\`\`typescript\`\`\``
            },
            {
                role: "user",
                content: `Based on this plan:\n${plan}\n\nCreate the main UI component for: ${inputSpec}`
            }
        ],
        stream: true,
    });

    let uiContent = "";
    const filePath = "app/page.tsx";

    for await (const chunk of uiResponse) {
        const delta = chunk.choices[0]?.delta?.content || "";
        if (delta) {
            uiContent += delta;
            // Send chunk-by-chunk updates for real-time display
            sendEvent("file_chunk", {
                filePath,
                content: delta,
                accumulated: uiContent,
                isStreaming: true
            });
        }
    }

    // Save completed UI to Convex
    await convex.mutation(api.artifacts.upsert, {
        projectId,
        path: filePath,
        content: uiContent,
    });

    sendEvent("file_complete", { filePath, content: uiContent });
}

// Generate project configuration files
async function generateProjectConfig(
    sendEvent: (event: string, data: any) => void,
    projectId: Id<"projects">,
    convex: any
) {
    // Generate package.json
    const packageJsonPath = "package.json";
    sendEvent("file_start", { filePath: packageJsonPath });

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

    // Send package.json in chunks for streaming effect
    const packageChunks = packageJsonContent.match(/.{1,50}/g) || [packageJsonContent];
    let accumulatedPackage = "";

    for (const chunk of packageChunks) {
        accumulatedPackage += chunk;
        sendEvent("file_chunk", {
            filePath: packageJsonPath,
            content: chunk,
            accumulated: accumulatedPackage,
            isStreaming: true
        });
        // Small delay for streaming effect
        await new Promise(resolve => setTimeout(resolve, 50));
    }

    await convex.mutation(api.artifacts.upsert, {
        projectId,
        path: packageJsonPath,
        content: packageJsonContent,
    });

    sendEvent("file_complete", { filePath: packageJsonPath, content: packageJsonContent });

    // Generate tsconfig.json
    const tsconfigPath = "tsconfig.json";
    sendEvent("file_start", { filePath: tsconfigPath });

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

    // Send tsconfig.json in chunks for streaming effect
    const tsconfigChunks = tsconfigContent.match(/.{1,50}/g) || [tsconfigContent];
    let accumulatedTsconfig = "";

    for (const chunk of tsconfigChunks) {
        accumulatedTsconfig += chunk;
        sendEvent("file_chunk", {
            filePath: tsconfigPath,
            content: chunk,
            accumulated: accumulatedTsconfig,
            isStreaming: true
        });
        // Small delay for streaming effect
        await new Promise(resolve => setTimeout(resolve, 50));
    }

    await convex.mutation(api.artifacts.upsert, {
        projectId,
        path: tsconfigPath,
        content: tsconfigContent,
    });

    sendEvent("file_complete", { filePath: tsconfigPath, content: tsconfigContent });

    // Generate README.md
    const readmePath = "README.md";
    sendEvent("file_start", { filePath: readmePath });

    const readmeContent = `# Generated Application

This is an automatically generated Next.js application with Convex backend.

## Getting Started

1. Install dependencies:
   \`\`\`bash
   npm install
   \`\`\`

2. Set up your Convex development environment:
   \`\`\`bash
   npx convex dev
   \`\`\`

3. Run the development server:
   \`\`\`bash
   npm run dev
   \`\`\`

4. Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## Project Structure

- \`app/\` - Next.js app directory with pages and components
- \`convex/\` - Convex backend functions (queries, mutations, schema)
- \`package.json\` - Project dependencies and scripts
- \`tsconfig.json\` - TypeScript configuration

## Learn More

- [Next.js Documentation](https://nextjs.org/docs)
- [Convex Documentation](https://docs.convex.dev/)
`;

    // Send README.md in chunks for streaming effect
    const readmeChunks = readmeContent.match(/.{1,80}/g) || [readmeContent];
    let accumulatedReadme = "";

    for (const chunk of readmeChunks) {
        accumulatedReadme += chunk;
        sendEvent("file_chunk", {
            filePath: readmePath,
            content: chunk,
            accumulated: accumulatedReadme,
            isStreaming: true
        });
        // Small delay for streaming effect
        await new Promise(resolve => setTimeout(resolve, 60));
    }

    await convex.mutation(api.artifacts.upsert, {
        projectId,
        path: readmePath,
        content: readmeContent,
    });

    sendEvent("file_complete", { filePath: readmePath, content: readmeContent });
}

// Perform validation on all generated files
async function performValidation(
    sendEvent: (event: string, data: any) => void,
    projectId: Id<"projects">,
    convex: any
) {
    try {
        // Get all artifacts for this project
        const artifacts = await convex.query(api.artifacts.byProject, { projectId });

        let totalErrors = 0;
        let totalWarnings = 0;
        const validationResults: any[] = [];
        const securityIssues: string[] = [];

        sendEvent("validation_start", { message: "Starting code validation..." });

        for (const artifact of artifacts) {
            if (artifact.path.endsWith('.ts') || artifact.path.endsWith('.tsx')) {
                sendEvent("validation_file", { filePath: artifact.path, message: "Validating..." });

                // Validate TypeScript
                const validation = await validateTypeScript(artifact.content);
                totalErrors += validation.errors.length;
                totalWarnings += validation.warnings.length;

                // Check for security issues
                const security = detectSecurityIssues(artifact.content);
                securityIssues.push(...security.issues.map(issue => `${artifact.path}: ${issue}`));

                validationResults.push({
                    path: artifact.path,
                    valid: validation.valid,
                    errors: validation.errors,
                    warnings: validation.warnings,
                    qualityScore: validation.codeQualityScore,
                    securitySeverity: security.severity,
                    securityIssues: security.issues
                });

                sendEvent("validation_file_complete", {
                    filePath: artifact.path,
                    valid: validation.valid,
                    errors: validation.errors.length,
                    warnings: validation.warnings.length,
                    qualityScore: validation.codeQualityScore
                });
            }
        }

        // Calculate overall quality score
        const avgQualityScore = validationResults.length > 0
            ? validationResults.reduce((sum, result) => sum + result.qualityScore, 0) / validationResults.length
            : 10;

        const overallValid = totalErrors === 0;
        const securityRisk = securityIssues.length === 0 ? 'low' :
            securityIssues.length <= 2 ? 'medium' : 'high';

        sendEvent("validation_complete", {
            valid: overallValid,
            totalErrors,
            totalWarnings,
            qualityScore: avgQualityScore,
            securityRisk,
            securityIssues: securityIssues.slice(0, 5), // Limit to 5 issues for display
            files: validationResults.length
        });

        // Update run with validation metrics
        await convex.mutation(api.runs.update, {
            id: projectId, // Note: This should probably be runId, but we'll keep it as is for now
            tokenUsage: 0, // We don't track tokens in streaming version yet
        });

    } catch (error) {
        console.error("Validation error:", error);
        sendEvent("validation_error", {
            message: error instanceof Error ? error.message : "Validation failed"
        });
    }
}
