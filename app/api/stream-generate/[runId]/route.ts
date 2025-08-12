import { NextRequest, NextResponse } from "next/server";
import { PlanningAgent } from "@/lib/agents/planning-agent";
import { GenerationOrchestrator } from "@/lib/agents/generation-orchestrator";
import { ValidationService } from "@/lib/validation/code-validator";
import { FileManager } from "@/lib/utils/file-manager";
import { GenerationRequest } from "@/lib/types/generation-types";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";

export async function POST(
    request: NextRequest,
    { params }: { params: { runId: string } }
) {
    const runId = params.runId;

    try {
        const body = await request.json() as GenerationRequest;
        const { projectId, specification, projectType = 'nextjs', preferences = {}, authToken } = body;

        if (!projectId) {
            return NextResponse.json({ error: 'Project ID is required' }, { status: 400 });
        }

        // Initialize Convex client for server-side operations  
        const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL!;
        const convex = new ConvexHttpClient(convexUrl);
        if (authToken) {
            convex.setAuth(authToken);
        }

        // Function to save file to Convex
        const saveFileToConvex = async (filePath: string, content: string) => {
            try {
                await convex.mutation(api.artifacts.upsert, {
                    projectId: projectId as Id<"projects">,
                    path: filePath,
                    content: content,
                });
                console.log(`✅ Saved ${filePath} to Convex`);
            } catch (error) {
                console.error(`❌ Failed to save ${filePath} to Convex:`, error);
            }
        };

        // Create response stream
        const encoder = new TextEncoder();
        const stream = new ReadableStream({
            async start(controller) {
                try {
                    // Send immediate connection test
                    console.log('Stream started, sending initial ping...');
                    const testEvent = `event: connection_test\ndata: ${JSON.stringify({
                        message: 'Stream connected successfully',
                        runId,
                        timestamp: new Date().toISOString()
                    })}\n\n`;
                    console.log('Sending SSE event:', JSON.stringify(testEvent));
                    controller.enqueue(encoder.encode(testEvent));

                    // Small delay to ensure client receives the test
                    await new Promise(resolve => setTimeout(resolve, 100));

                    // Phase 1: Planning
                    console.log('Sending planning start event...');
                    controller.enqueue(encoder.encode(`event: status\ndata: ${JSON.stringify({
                        phase: 'planning',
                        message: 'Analyzing requirements and creating file plan...'
                    })}\n\n`));

                    const planningAgent = new PlanningAgent();
                    const filePlan = await planningAgent.createPlan({
                        specification,
                        projectType,
                        preferences
                    });

                    console.log('Sending planning complete event...');
                    controller.enqueue(encoder.encode(`event: plan_complete\ndata: ${JSON.stringify({
                        type: 'plan_complete',
                        data: {
                            content: JSON.stringify(filePlan, null, 2)
                        }
                    })}\n\n`));

                    // Phase 2: Generation
                    controller.enqueue(encoder.encode(`event: status\ndata: ${JSON.stringify({
                        type: 'status',
                        data: {
                            phase: 'generating',
                            message: 'Beginning file generation...'
                        }
                    })}\n\n`));

                    const orchestrator = new GenerationOrchestrator();
                    const generationContext = {
                        runId,
                        specification,
                        plan: filePlan,
                        onProgress: (progress: any) => {
                            console.log('Sending progress event:', progress.type, progress.message);

                            // Map progress types to SSE event types
                            let eventType = 'status';
                            let eventData = progress;

                            if (progress.type === 'file_generated') {
                                if (progress.message.includes('Generating')) {
                                    eventType = 'file_start';
                                    eventData = { filePath: progress.data.filePath };
                                } else if (progress.message.includes('Generated')) {
                                    eventType = 'file_complete';
                                    eventData = {
                                        filePath: progress.data.filePath,
                                        content: progress.data.content
                                    };

                                    // Save completed file to Convex (fire and forget)
                                    saveFileToConvex(progress.data.filePath, progress.data.content).catch(err =>
                                        console.error('Failed to save file to Convex:', err)
                                    );
                                }
                            } else {
                                eventData = {
                                    phase: progress.type.replace('_', ''),
                                    message: progress.message
                                };
                            }

                            controller.enqueue(encoder.encode(`event: ${eventType}\ndata: ${JSON.stringify(eventData)}\n\n`));
                        }
                    };

                    const generatedFiles = await orchestrator.generateFiles(generationContext);
                    console.log(`Orchestrator completed. Generated ${generatedFiles.length} files`);

                    // Phase 3: Validation
                    console.log('Starting validation phase...');
                    controller.enqueue(encoder.encode(`event: status\ndata: ${JSON.stringify({
                        phase: 'validating',
                        message: 'Validating generated code...'
                    })}\n\n`));

                    const validator = new ValidationService();
                    const _validationResults = await validator.validateProject(generatedFiles);
                    console.log('Validation completed');

                    // Phase 4: Assembly
                    console.log('Starting assembly phase...');
                    const fileManager = new FileManager();
                    const _projectStructure = await fileManager.createProjectStructure(
                        generatedFiles,
                        filePlan.architecture
                    );
                    console.log('Assembly completed');

                    // Mark run as completed in Convex
                    try {
                        await convex.mutation(api.runs.update, {
                            id: runId as Id<"runs">,
                            status: "completed"
                        });
                        console.log('✅ Run marked as completed in Convex');
                    } catch (error) {
                        console.error('❌ Failed to update run status:', error);
                    }

                    // Final completion
                    console.log('Generation process completed successfully');
                    controller.enqueue(encoder.encode(`event: complete\ndata: ${JSON.stringify({
                        message: 'Next.js application generated successfully!'
                    })}\n\n`));

                } catch (error) {
                    console.error('Generation process failed:', error);

                    // Mark run as failed in Convex
                    try {
                        await convex.mutation(api.runs.update, {
                            id: runId as Id<"runs">,
                            status: "failed",
                            error: error instanceof Error ? error.message : 'Unknown error'
                        });
                        console.log('✅ Run marked as failed in Convex');
                    } catch (updateError) {
                        console.error('❌ Failed to update run status:', updateError);
                    }

                    controller.enqueue(encoder.encode(`event: error\ndata: ${JSON.stringify({
                        message: error instanceof Error ? error.message : 'Unknown error'
                    })}\n\n`));
                } finally {
                    console.log('Closing stream...');
                    controller.close();
                }
            }
        });

        return new NextResponse(stream, {
            headers: {
                'Content-Type': 'text/event-stream',
                'Cache-Control': 'no-cache',
                'Connection': 'keep-alive',
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'POST',
                'Access-Control-Allow-Headers': 'Content-Type',
            },
        });

    } catch (error) {
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Unknown error' },
            { status: 500 }
        );
    }
}
