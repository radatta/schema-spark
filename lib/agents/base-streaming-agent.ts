import { google } from "@ai-sdk/google";
import { generateText, streamObject } from "ai";
import type { CoreMessage } from "ai";
import { z } from "zod";
import { SmartChunker } from "../utils/smart-chunker";
import {
    AgentRequest,
    GeneratedFile,
    FileGenerationSchema
} from "@/lib/types/generation-types";

export interface StreamingCallbacks {
    onChunk?: (chunk: string, accumulated: string) => void;
    onComplete?: (content: string) => void;
    onError?: (error: Error) => void;
}

export abstract class BaseStreamingAgent {
    protected model = google("gemini-2.5-flash");

    constructor() {
        // Vercel AI SDK automatically uses GOOGLE_GENERATIVE_AI_API_KEY environment variable
    }

    /**
     * Generate a file with streaming support using streamObject
     */
    async generateFile(request: AgentRequest, callbacks?: StreamingCallbacks): Promise<GeneratedFile> {
        const { fileSpec } = request;

        try {
            // Get the messages for this specific agent type
            const messages = await this.buildMessages(request);

            // Use streamObject for structured data generation with proper streaming
            const { partialObjectStream, object } = streamObject({
                model: this.model,
                messages,
                schema: FileGenerationSchema,
            });

            const chunker = new SmartChunker();
            let lastContent = '';

            // Stream partial objects as they're being generated
            for await (const partialObject of partialObjectStream) {
                if (partialObject.content && partialObject.content !== lastContent) {
                    const newContent = partialObject.content.slice(lastContent.length);
                    lastContent = partialObject.content;

                    // Add to chunker and check if we should send a chunk
                    const chunkResult = chunker.addContent(newContent);
                    if (chunkResult.shouldSend && callbacks?.onChunk) {
                        callbacks.onChunk(chunkResult.content, lastContent);
                    }
                }
            }

            // Send any remaining content
            const finalChunk = chunker.getRemaining();
            if (finalChunk.shouldSend && callbacks?.onChunk) {
                callbacks.onChunk(finalChunk.content, lastContent);
            }

            // Wait for the complete object
            const validatedGeneration = await object;

            // Notify completion
            if (callbacks?.onComplete) {
                callbacks.onComplete(validatedGeneration.content);
            }

            // Convert escaped newlines in content to actual newlines for proper display
            const processedContent = validatedGeneration.content.replace(/\\n/g, '\n');

            return {
                path: fileSpec.path,
                content: processedContent,
                type: fileSpec.type,
                imports: validatedGeneration.imports || [],
                exports: validatedGeneration.exports || [],
                metadata: validatedGeneration.metadata || {}
            };

        } catch (error) {
            if (callbacks?.onError) {
                callbacks.onError(error instanceof Error ? error : new Error('Unknown error'));
            }
            throw error;
        }
    }    /**
     * Generate a file without streaming (backward compatibility)
     */
    async generateFileSync(request: AgentRequest): Promise<GeneratedFile> {
        const { fileSpec } = request;

        try {
            const messages = await this.buildMessages(request);

            const { text } = await generateText({
                model: this.model,
                messages,
            });

            // Clean the response to handle markdown code blocks
            let cleanedResponse = text.trim();

            // Remove markdown code block markers if present
            if (cleanedResponse.startsWith('```json')) {
                cleanedResponse = cleanedResponse.replace(/^```json\s*/, '').replace(/\s*```$/, '');
            } else if (cleanedResponse.startsWith('```')) {
                cleanedResponse = cleanedResponse.replace(/^```\s*/, '').replace(/\s*```$/, '');
            }

            try {
                const generationData = JSON.parse(cleanedResponse);
                const validatedGeneration = FileGenerationSchema.parse(generationData);

                // Convert escaped newlines in content to actual newlines for proper display
                const processedContent = validatedGeneration.content.replace(/\\n/g, '\n');

                return {
                    path: fileSpec.path,
                    content: processedContent,
                    type: fileSpec.type,
                    imports: validatedGeneration.imports,
                    exports: validatedGeneration.exports,
                    metadata: validatedGeneration.metadata
                };
            } catch (parseError) {
                // Clean up control characters and try again
                let fixedContent = cleanedResponse;

                // Remove problematic characters
                fixedContent = fixedContent.split('\u0000').join('');
                fixedContent = fixedContent.split('\u0008').join('');
                fixedContent = fixedContent.split('\u000C').join('');

                // Replace unescaped control characters
                fixedContent = fixedContent.replace(/\n/g, '\\n');
                fixedContent = fixedContent.replace(/\t/g, '\\t');
                fixedContent = fixedContent.replace(/\r/g, '\\r');

                const generationData = JSON.parse(fixedContent);
                const validatedGeneration = FileGenerationSchema.parse(generationData);

                // Convert escaped newlines in content to actual newlines for proper display
                const processedContent = validatedGeneration.content.replace(/\\n/g, '\n');

                return {
                    path: fileSpec.path,
                    content: processedContent,
                    type: fileSpec.type,
                    imports: validatedGeneration.imports,
                    exports: validatedGeneration.exports,
                    metadata: validatedGeneration.metadata
                };
            }

        } catch (error) {
            throw new Error(`Failed to generate file: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    /**
     * Build messages for the AI model - must be implemented by each agent
     */
    protected abstract buildMessages(request: AgentRequest): Promise<CoreMessage[]>;
}
