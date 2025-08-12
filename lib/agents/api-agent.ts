import OpenAI from "openai";
import {
    AgentRequest,
    GeneratedFile,
    FileGenerationSchema
} from "@/lib/types/generation-types";

export class APIAgent {
    private openai: OpenAI;

    constructor() {
        this.openai = new OpenAI({
            apiKey: process.env.OPENAI_API_KEY,
        });
    }

    async generateFile(request: AgentRequest): Promise<GeneratedFile> {
        const { fileSpec, previousFiles, context } = request;

        try {
            // Build context from previous files (types, utilities, etc.)
            const contextualInfo = this.buildContext(previousFiles, fileSpec);

            const completion = await this.openai.chat.completions.create({
                model: "gpt-4-turbo",
                messages: [
                    {
                        role: "system",
                        content: this.getSystemPrompt()
                    },
                    {
                        role: "user",
                        content: this.getUserPrompt(fileSpec, context, contextualInfo)
                    }
                ]
            });

            const response = completion.choices[0].message.content;
            if (!response) {
                throw new Error("No response from OpenAI");
            }

            console.log("API Agent OpenAI Response:", response);

            const generationData = JSON.parse(response);
            const validatedGeneration = FileGenerationSchema.parse(generationData);

            return {
                path: fileSpec.path,
                content: validatedGeneration.content,
                type: fileSpec.type,
                imports: validatedGeneration.imports,
                exports: validatedGeneration.exports,
                metadata: {
                    apiEndpoints: validatedGeneration.metadata?.apiEndpoints,
                    hasAsyncOperations: validatedGeneration.metadata?.hasAsyncOperations
                }
            };

        } catch (error) {
            console.error(`API generation error for ${fileSpec.path}:`, error);
            throw new Error(`Failed to generate API route: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    private buildContext(previousFiles: GeneratedFile[], fileSpec: any): string {
        const relevantFiles = previousFiles.filter(file =>
            file.type === 'type' ||
            file.type === 'utility' ||
            file.path.includes('schema') ||
            file.path.includes('database') ||
            file.path.includes('validation')
        );

        if (relevantFiles.length === 0) {
            return "No previous files to reference for API context.";
        }

        return `Previous files for API context:
${relevantFiles.map(file => `
File: ${file.path}
Type: ${file.type}
Exports: ${file.exports.join(', ')}
${file.metadata?.apiEndpoints ? `Endpoints: ${file.metadata.apiEndpoints.join(', ')}` : ''}
`).join('\n')}

Current API Route: ${fileSpec.path}`;
    }

    private getSystemPrompt(): string {
        return `You are an expert Next.js API developer specializing in creating robust, secure API routes.

Your task is to generate API route handlers that follow Next.js 14+ App Router conventions.

Key Requirements:
- Use Next.js App Router API route patterns (route.ts files)
- Export named functions for HTTP methods (GET, POST, PUT, DELETE, PATCH)
- Use NextRequest and NextResponse from 'next/server'
- Implement proper error handling with appropriate HTTP status codes
- Use TypeScript with proper type definitions
- Implement request validation using Zod schemas
- Follow RESTful API design principles
- Include proper CORS handling if needed
- Implement rate limiting and security measures where appropriate
- Use async/await for database operations
- Return structured JSON responses

API Route Structure:
1. Import statements (Next.js, validation, types, utilities)
2. Type definitions for request/response
3. Validation schemas using Zod
4. HTTP method handlers (GET, POST, etc.)
5. Proper error handling and status codes
6. Export statements

Error Handling:
- Use try-catch blocks for all async operations
- Return appropriate HTTP status codes (200, 201, 400, 401, 404, 500)
- Provide meaningful error messages
- Log errors for debugging
- Validate input data before processing

Security Considerations:
- Validate all incoming data
- Sanitize user inputs
- Implement authentication checks where needed
- Use HTTPS-only cookies for sensitive data
- Implement rate limiting for public endpoints

Response Format:
- Consistent JSON structure
- Include relevant metadata (timestamps, pagination, etc.)
- Proper HTTP status codes
- Error responses with actionable messages

Return only valid, compilable TypeScript code without any markdown formatting.`;
    }

    private getUserPrompt(fileSpec: any, context: any, contextualInfo: string): string {
        const pathSegments = fileSpec.path.split('/');
        const isDynamicRoute = pathSegments.some((segment: string) => segment.startsWith('[') && segment.endsWith(']'));
        const httpMethods = this.inferHTTPMethods(fileSpec.description);

        return `Generate a Next.js API route handler for the following specification:

File Path: ${fileSpec.path}
API Type: ${fileSpec.type}
Description: ${fileSpec.description}
Dependencies: ${fileSpec.dependencies.join(', ')}
${isDynamicRoute ? 'This is a dynamic route with parameters.' : 'This is a static route.'}
Expected HTTP Methods: ${httpMethods.join(', ')}

Application Context:
${context?.specification || 'No specification provided'}

Architecture:
- Framework: ${context?.plan?.architecture?.framework || 'Next.js'}
- State Management: ${context?.plan?.architecture?.stateManagement || 'React useState'}

${contextualInfo}

Requirements:
1. Create API route handlers for the specified HTTP methods
2. Use proper TypeScript typing for requests and responses
3. Implement comprehensive input validation using Zod
4. Include proper error handling with meaningful messages
5. Follow RESTful API conventions
6. Implement appropriate security measures
7. Use proper HTTP status codes
8. Include request/response logging where appropriate
9. Handle edge cases and validation errors gracefully
10. Return consistent JSON response formats

Return your response as valid JSON in this exact format:
{
  "content": "// Complete API route code here",
  "imports": ["next", "zod"],
  "exports": ["GET", "POST"],
  "dependencies": ["@/lib/validation"],
  "metadata": {
    "apiEndpoints": ["/api/users", "/api/users/[id]"],
    "hasAsyncOperations": true
  },
  "errors": []
}

Return ONLY valid JSON that matches this structure. The API route should be production-ready and secure.`;
    }

    private inferHTTPMethods(description: string): string[] {
        const desc = description.toLowerCase();
        const methods: string[] = [];

        if (desc.includes('get') || desc.includes('fetch') || desc.includes('read') || desc.includes('list')) {
            methods.push('GET');
        }
        if (desc.includes('post') || desc.includes('create') || desc.includes('add') || desc.includes('submit')) {
            methods.push('POST');
        }
        if (desc.includes('put') || desc.includes('update') || desc.includes('edit') || desc.includes('modify')) {
            methods.push('PUT');
        }
        if (desc.includes('delete') || desc.includes('remove')) {
            methods.push('DELETE');
        }
        if (desc.includes('patch')) {
            methods.push('PATCH');
        }

        // Default to GET if no specific method is detected
        return methods.length > 0 ? methods : ['GET'];
    }
}
