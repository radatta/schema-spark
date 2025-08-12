import { ComponentAgent } from "./component-agent"
import { APIAgent } from "./api-agent"
import { UtilityAgent } from "./utility-agent"
import { PageAgent } from "./page-agent"
import { ConfigAgent } from "./config-agent";
import {
    GenerationContext,
    GeneratedFile,
    FileSpec,
    AgentRequest
} from "@/lib/types/generation-types";

export class GenerationOrchestrator {
    private componentAgent: ComponentAgent;
    private apiAgent: APIAgent;
    private utilityAgent: UtilityAgent;
    private pageAgent: PageAgent;
    private configAgent: ConfigAgent;

    constructor() {
        this.componentAgent = new ComponentAgent();
        this.apiAgent = new APIAgent();
        this.utilityAgent = new UtilityAgent();
        this.pageAgent = new PageAgent();
        this.configAgent = new ConfigAgent();
    }

    async generateFiles(context: GenerationContext): Promise<GeneratedFile[]> {
        const { plan } = context;

        try {
            // Use smart batching for better performance while respecting dependencies
            return await this.generateWithSmartBatching(plan.files, context);

        } catch (error) {
            throw new Error(`Failed to generate files: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    /**
     * Generate files using smart batching that respects dependencies
     */
    private async generateWithSmartBatching(
        fileSpecs: FileSpec[],
        context: GenerationContext
    ): Promise<GeneratedFile[]> {
        const generatedFiles: GeneratedFile[] = [];
        const remaining = [...fileSpecs];
        const inProgress = new Set<string>();
        const batchSize = 3; // Process 3 files concurrently max

        while (remaining.length > 0 || inProgress.size > 0) {
            // Find files that can be generated now (no unmet dependencies)
            const ready = remaining.filter(spec =>
                spec.dependencies.every(dep =>
                    generatedFiles.some(generated => generated.path === dep)
                )
            );

            // Limit concurrent generation
            const available = batchSize - inProgress.size;
            const toGenerate = ready.slice(0, available);

            // Remove ready files from remaining
            toGenerate.forEach(spec => {
                const index = remaining.indexOf(spec);
                if (index > -1) {
                    remaining.splice(index, 1);
                    inProgress.add(spec.path);
                }
            });

            // Generate batch concurrently
            const batchPromises = toGenerate.map(async (fileSpec) => {
                try {
                    // Update progress
                    if (context.onProgress) {
                        context.onProgress({
                            type: 'file_generated',
                            runId: context.runId,
                            message: `Generating ${fileSpec.path}...`,
                            data: { filePath: fileSpec.path, type: fileSpec.type },
                            progress: {
                                current: generatedFiles.length + inProgress.size,
                                total: fileSpecs.length,
                                percentage: Math.round(((generatedFiles.length + inProgress.size) / fileSpecs.length) * 100)
                            }
                        });
                    }

                    const result = await this.generateFile(fileSpec, generatedFiles, context);
                    inProgress.delete(fileSpec.path);

                    if (result && context.onProgress) {
                        // Send file completion progress
                        context.onProgress({
                            type: 'file_generated',
                            runId: context.runId,
                            message: `Generated ${fileSpec.path}`,
                            data: {
                                filePath: fileSpec.path,
                                type: fileSpec.type,
                                content: result.content,
                                size: result.content.length
                            },
                            progress: {
                                current: generatedFiles.length + 1,
                                total: fileSpecs.length,
                                percentage: Math.round(((generatedFiles.length + 1) / fileSpecs.length) * 100)
                            }
                        });
                    }

                    return result;
                } catch (error) {
                    inProgress.delete(fileSpec.path);
                    if (context.onProgress) {
                        context.onProgress({
                            type: 'error',
                            runId: context.runId,
                            message: `Failed to generate ${fileSpec.path}: ${error instanceof Error ? error.message : 'Unknown error'}`,
                            data: { filePath: fileSpec.path, error }
                        });
                    }
                    return null;
                }
            });

            // Wait for batch to complete
            if (batchPromises.length > 0) {
                const batchResults = await Promise.all(batchPromises);

                // Add successful generations
                batchResults.forEach(result => {
                    if (result) {
                        generatedFiles.push(result);
                    }
                });
            }

            // If no progress is possible, break to avoid infinite loop
            if (toGenerate.length === 0 && inProgress.size === 0 && remaining.length > 0) {
                // This shouldn't happen with proper dependency ordering, but safety check
                throw new Error(`Circular dependency detected or invalid dependency order`);
            }

            // Small delay to prevent tight loop if waiting for dependencies
            if (toGenerate.length === 0 && inProgress.size > 0) {
                await new Promise(resolve => setTimeout(resolve, 100));
            }
        }

        return generatedFiles;
    }

    private async generateFile(
        fileSpec: FileSpec,
        previousFiles: GeneratedFile[],
        context: GenerationContext
    ): Promise<GeneratedFile | null> {
        const agentRequest: AgentRequest = {
            context,
            fileSpec,
            previousFiles: previousFiles.filter(file =>
                fileSpec.dependencies.includes(file.path) ||
                this.isRelatedFile(file, fileSpec)
            )
        };

        // Set up streaming callbacks
        const streamingCallbacks = {
            onChunk: (chunk: string, accumulated: string) => {
                if (context.onProgress) {
                    context.onProgress({
                        type: 'file_chunk',
                        runId: context.runId,
                        message: `Generating ${fileSpec.path}...`,
                        data: {
                            filePath: fileSpec.path,
                            chunk: chunk,
                            accumulated: accumulated
                        }
                    });
                }
            },
            onComplete: (_content: string) => {
                // Streaming completed
            },
            onError: (_error: Error) => {
                // Handle streaming error
            }
        };

        // Route to appropriate agent based on file type
        switch (fileSpec.type) {
            case 'component':
            case 'layout':
                return await this.componentAgent.generateFile(agentRequest, streamingCallbacks);

            case 'page':
                return await this.pageAgent.generateFile(agentRequest, streamingCallbacks);

            case 'api':
            case 'api route':
                return await this.apiAgent.generateFile(agentRequest, streamingCallbacks);

            case 'utility':
            case 'hook':
            case 'hooks':
            case 'type':
            case 'types':
                return await this.utilityAgent.generateFile(agentRequest, streamingCallbacks);

            case 'config':
            case 'style':
            case 'styles':
            case 'static':
                return await this.configAgent.generateFile(agentRequest, streamingCallbacks);

            case 'documentation':
                return await this.utilityAgent.generateFile(agentRequest, streamingCallbacks);

            case 'middleware':
            case 'loading':
            case 'error':
            case 'not-found':
            case 'global-error':
            case 'route':
            case 'template':
            case 'default':
                // These special Next.js files can be handled by utility agent for now
                return await this.utilityAgent.generateFile(agentRequest, streamingCallbacks);

            default:
                return await this.utilityAgent.generateFile(agentRequest, streamingCallbacks);
        }
    }

    private isRelatedFile(file: GeneratedFile, targetSpec: FileSpec): boolean {
        // Check if files are in the same directory or have related names
        const fileParts = file.path.split('/');
        const targetParts = targetSpec.path.split('/');

        // Same directory
        if (fileParts.slice(0, -1).join('/') === targetParts.slice(0, -1).join('/')) {
            return true;
        }

        // Check for common patterns
        const fileName = fileParts[fileParts.length - 1];
        const targetFileName = targetParts[targetParts.length - 1];

        // Related component files (e.g., Button.tsx and Button.test.tsx)
        if (fileName.replace(/\.(tsx?|test\.|spec\.).*$/, '') ===
            targetFileName.replace(/\.(tsx?|test\.|spec\.).*$/, '')) {
            return true;
        }

        // Layout and page relationships
        if (file.type === 'layout' && targetSpec.type === 'page') {
            return targetSpec.path.startsWith(file.path.replace('/layout.tsx', ''));
        }

        // Component and type relationships
        if (file.type === 'type' && (targetSpec.type === 'component' || targetSpec.type === 'page')) {
            return true;
        }

        return false;
    }

    async generateBatch(
        fileSpecs: FileSpec[],
        context: GenerationContext,
        batchSize: number = 3
    ): Promise<GeneratedFile[]> {
        const results: GeneratedFile[] = [];

        // Process files in batches for better performance
        for (let i = 0; i < fileSpecs.length; i += batchSize) {
            const batch = fileSpecs.slice(i, i + batchSize);

            const batchPromises = batch.map(async (fileSpec) => {
                try {
                    return await this.generateFile(fileSpec, results, context);
                } catch (error) {
                    return null;
                }
            });

            const batchResults = await Promise.all(batchPromises);

            // Add successful generations to results
            batchResults.forEach(result => {
                if (result) {
                    results.push(result);
                }
            });

            // Update progress
            context.onProgress({
                type: 'file_generated',
                runId: context.runId,
                message: `Completed batch ${Math.floor(i / batchSize) + 1}`,
                progress: {
                    current: Math.min(i + batchSize, fileSpecs.length),
                    total: fileSpecs.length,
                    percentage: Math.round((Math.min(i + batchSize, fileSpecs.length) / fileSpecs.length) * 100)
                }
            });
        }

        return results;
    }

    async regenerateFile(
        filePath: string,
        context: GenerationContext,
        existingFiles: GeneratedFile[]
    ): Promise<GeneratedFile | null> {
        const fileSpec = context.plan.files.find(f => f.path === filePath);
        if (!fileSpec) {
            throw new Error(`File spec not found for path: ${filePath}`);
        }

        // Remove existing file from the list
        const filteredFiles = existingFiles.filter(f => f.path !== filePath);

        return await this.generateFile(fileSpec, filteredFiles, context);
    }

    getGenerationStatistics(files: GeneratedFile[]): {
        totalFiles: number;
        totalLines: number;
        filesByType: Record<string, number>;
        averageFileSize: number;
        largestFile: { path: string; size: number };
        complexity: 'low' | 'medium' | 'high';
    } {
        const totalFiles = files.length;
        const totalLines = files.reduce((sum, file) =>
            sum + file.content.split('\n').length, 0
        );

        const filesByType = files.reduce((acc, file) => {
            acc[file.type] = (acc[file.type] || 0) + 1;
            return acc;
        }, {} as Record<string, number>);

        const fileSizes = files.map(f => f.content.length);
        const averageFileSize = fileSizes.reduce((a, b) => a + b, 0) / fileSizes.length;

        const largestFile = files.reduce((largest, file) =>
            file.content.length > largest.size
                ? { path: file.path, size: file.content.length }
                : largest
            , { path: '', size: 0 });

        // Simple complexity calculation based on file count and average size
        let complexity: 'low' | 'medium' | 'high' = 'low';
        if (totalFiles > 20 || averageFileSize > 2000) complexity = 'medium';
        if (totalFiles > 50 || averageFileSize > 5000) complexity = 'high';

        return {
            totalFiles,
            totalLines,
            filesByType,
            averageFileSize,
            largestFile,
            complexity
        };
    }
}
