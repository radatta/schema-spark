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
        const { plan, onProgress } = context;
        const generatedFiles: GeneratedFile[] = [];
        const totalFiles = plan.files.length;

        try {
            // Process files in the order specified by the plan
            for (let i = 0; i < plan.generationOrder.length; i++) {
                const filePath = plan.generationOrder[i];
                const fileSpec = plan.files.find(f => f.path === filePath);

                if (!fileSpec) {
                    console.warn(`File spec not found for path: ${filePath}`);
                    continue;
                }

                // Update progress
                onProgress({
                    type: 'file_generated',
                    runId: context.runId,
                    message: `Generating ${fileSpec.path}...`,
                    data: { filePath: fileSpec.path, type: fileSpec.type },
                    progress: {
                        current: i + 1,
                        total: totalFiles,
                        percentage: Math.round(((i + 1) / totalFiles) * 100)
                    }
                });

                try {
                    console.log(`Starting generation for: ${fileSpec.path} (${fileSpec.type})`);
                    const generatedFile = await this.generateFile(fileSpec, generatedFiles, context);
                    if (generatedFile) {
                        console.log(`Successfully generated: ${fileSpec.path}`);
                        generatedFiles.push(generatedFile);

                        // Send file completion progress
                        onProgress({
                            type: 'file_generated',
                            runId: context.runId,
                            message: `Generated ${fileSpec.path}`,
                            data: {
                                filePath: fileSpec.path,
                                type: fileSpec.type,
                                content: generatedFile.content,
                                size: generatedFile.content.length
                            },
                            progress: {
                                current: i + 1,
                                total: totalFiles,
                                percentage: Math.round(((i + 1) / totalFiles) * 100)
                            }
                        });
                    } else {
                        console.log(`No file generated for: ${fileSpec.path}`);
                    }
                } catch (fileError) {
                    console.error(`Error generating ${fileSpec.path}:`, fileError);
                    onProgress({
                        type: 'error',
                        runId: context.runId,
                        message: `Failed to generate ${fileSpec.path}: ${fileError instanceof Error ? fileError.message : 'Unknown error'}`,
                        data: { filePath: fileSpec.path, error: fileError }
                    });

                    // Continue with other files even if one fails
                    continue;
                }
            }

            console.log(`Generation complete! Generated ${generatedFiles.length} files out of ${totalFiles} requested`);
            return generatedFiles;

        } catch (error) {
            console.error("Generation orchestration error:", error);
            throw new Error(`Failed to generate files: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
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

        try {
            console.log(`Routing to agent for file type: ${fileSpec.type}`);
            // Route to appropriate agent based on file type
            switch (fileSpec.type) {
                case 'component':
                case 'layout':
                    console.log(`Using ComponentAgent for: ${fileSpec.path}`);
                    return await this.componentAgent.generateFile(agentRequest);

                case 'page':
                    console.log(`Using PageAgent for: ${fileSpec.path}`);
                    return await this.pageAgent.generateFile(agentRequest);

                case 'api':
                case 'api route':
                    console.log(`Using APIAgent for: ${fileSpec.path}`);
                    return await this.apiAgent.generateFile(agentRequest);

                case 'utility':
                case 'hook':
                case 'hooks':
                case 'type':
                case 'types':
                    console.log(`Using UtilityAgent for: ${fileSpec.path}`);
                    return await this.utilityAgent.generateFile(agentRequest);

                case 'config':
                case 'style':
                case 'styles':
                case 'static':
                    console.log(`Using ConfigAgent for: ${fileSpec.path}`);
                    return await this.configAgent.generateFile(agentRequest);

                case 'documentation':
                    console.log(`Using UtilityAgent for documentation: ${fileSpec.path}`);
                    return await this.utilityAgent.generateFile(agentRequest);

                case 'middleware':
                case 'loading':
                case 'error':
                case 'not-found':
                case 'global-error':
                case 'route':
                case 'template':
                case 'default':
                    console.log(`Using UtilityAgent (fallback) for: ${fileSpec.path}`);
                    // These special Next.js files can be handled by utility agent for now
                    return await this.utilityAgent.generateFile(agentRequest);

                default:
                    console.warn(`Unknown file type: ${fileSpec.type as string}, using UtilityAgent`);
                    return await this.utilityAgent.generateFile(agentRequest);
            }
        } catch (error) {
            console.error(`Agent failed to generate ${fileSpec.path}:`, error);
            throw error;
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
            console.log(`Processing batch ${Math.floor(i / batchSize) + 1} of ${Math.ceil(fileSpecs.length / batchSize)}`);

            const batchPromises = batch.map(async (fileSpec) => {
                try {
                    return await this.generateFile(fileSpec, results, context);
                } catch (error) {
                    console.error(`Batch generation error for ${fileSpec.path}:`, error);
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

        console.log(`Batch processing complete! Generated ${results.length} files`);

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
