import OpenAI from "openai";
import {
    AgentRequest,
    GeneratedFile,
    FileGenerationSchema
} from "@/lib/types/generation-types";

export class UtilityAgent {
    private openai: OpenAI;

    constructor() {
        this.openai = new OpenAI({
            apiKey: process.env.OPENAI_API_KEY,
        });
    }

    async generateFile(request: AgentRequest): Promise<GeneratedFile> {
        const { fileSpec, previousFiles, context } = request;

        try {
            // Build context from previous files
            const contextualInfo = this.buildContext(previousFiles, fileSpec);

            const completion = await this.openai.chat.completions.create({
                model: "gpt-4-turbo",
                messages: [
                    {
                        role: "system",
                        content: this.getSystemPrompt(fileSpec.type)
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

            console.log("Utility Agent OpenAI Response:", response);

            const generationData = JSON.parse(response);
            const validatedGeneration = FileGenerationSchema.parse(generationData);

            return {
                path: fileSpec.path,
                content: validatedGeneration.content,
                type: fileSpec.type,
                imports: validatedGeneration.imports,
                exports: validatedGeneration.exports,
                metadata: {
                    hasAsyncOperations: validatedGeneration.metadata?.hasAsyncOperations,
                    isClientComponent: validatedGeneration.metadata?.isClientComponent
                }
            };

        } catch (error) {
            console.error(`Utility generation error for ${fileSpec.path}:`, error);
            throw new Error(`Failed to generate utility: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    private buildContext(previousFiles: GeneratedFile[], fileSpec: any): string {
        const relevantFiles = previousFiles.filter(file =>
            file.type === 'type' ||
            file.type === 'utility' ||
            file.type === 'config' ||
            (fileSpec.type === 'hook' && file.type === 'hook')
        );

        if (relevantFiles.length === 0) {
            return "No previous files to reference for utility context.";
        }

        return `Previous files for utility context:
${relevantFiles.map(file => `
File: ${file.path}
Type: ${file.type}
Exports: ${file.exports.join(', ')}
`).join('\n')}

Current Utility: ${fileSpec.path}`;
    }

    private getSystemPrompt(fileType: string): string {
        const basePrompt = `You are an expert TypeScript developer specializing in creating robust, reusable utilities and helper functions.

Your task is to generate ${fileType} files that follow modern TypeScript and React best practices.

General Requirements:
- Use TypeScript with strict typing
- Follow functional programming principles where appropriate
- Include comprehensive JSDoc comments
- Implement proper error handling
- Use modern ES6+ features
- Ensure code is testable and maintainable
- Follow naming conventions (camelCase for functions, PascalCase for types)
- Include input validation where appropriate
- Return only valid, compilable TypeScript code without markdown formatting`;

        switch (fileType) {
            case 'utility':
                return `${basePrompt}

Utility Function Guidelines:
- Create pure functions without side effects
- Handle edge cases and invalid inputs gracefully
- Use proper TypeScript generics for reusability
- Include performance optimizations where applicable
- Follow single responsibility principle
- Export functions as named exports
- Include type guards for runtime type checking
- Use appropriate data structures for efficiency

Common Utility Categories:
- String manipulation and validation
- Array and object operations
- Date/time formatting and calculations
- URL and API helpers
- Data transformation and formatting
- Validation and sanitization functions
- Mathematical calculations
- Browser API wrappers`;

            case 'hook':
                return `${basePrompt}

Custom Hook Guidelines:
- Use "use" prefix for hook names
- Follow React hooks rules (call hooks at top level)
- Use appropriate React hooks (useState, useEffect, etc.)
- Implement proper cleanup in useEffect
- Return objects for multiple values, arrays for simple pairs
- Include dependency arrays for useEffect and useMemo
- Handle loading and error states appropriately
- Use TypeScript generics for type safety
- Include proper memoization for performance

Custom Hook Categories:
- Data fetching and API hooks
- Local storage and persistence hooks
- Form handling and validation hooks
- Event listener and DOM hooks
- State management hooks
- Timer and interval hooks
- Async operation hooks`;

            case 'type':
                return `${basePrompt}

TypeScript Type Definition Guidelines:
- Use interfaces for object shapes that can be extended
- Use type aliases for unions, primitives, and computed types
- Include generic parameters for reusable types
- Use proper utility types (Partial, Pick, Omit, etc.)
- Create discriminated unions for state management
- Include JSDoc comments for complex types
- Use const assertions for immutable data
- Export all types that might be used elsewhere
- Follow consistent naming conventions

Type Definition Categories:
- API request/response types
- Component prop interfaces
- State and context types
- Event handler types
- Configuration and option types
- Utility and helper types
- Database and model types`;

            case 'middleware':
                return `${basePrompt}

Next.js Middleware Guidelines:
- Use Next.js middleware conventions
- Export middleware function as default
- Include matcher config for specific routes
- Handle authentication and authorization
- Implement proper request/response modifications
- Use NextRequest and NextResponse types
- Include proper error handling
- Implement rate limiting if needed
- Handle CORS and security headers
- Use proper redirect and rewrite logic

Middleware Categories:
- Authentication middleware
- Route protection middleware
- Request logging middleware
- Rate limiting middleware
- Internationalization middleware
- Security header middleware`;

            case 'documentation':
                return `You are an expert technical writer specializing in creating comprehensive project documentation.

Your task is to generate well-structured, informative documentation files for modern web applications.

Documentation Requirements:
- Write clear, concise, and comprehensive content
- Use proper Markdown formatting and syntax
- Include all essential project information
- Follow documentation best practices
- Structure content logically with proper headings
- Include setup and installation instructions
- Add usage examples and code snippets where appropriate
- Include contribution guidelines if applicable
- Add licensing information
- Use professional but accessible language
- Include links to relevant resources
- Format code blocks with proper syntax highlighting

For README.md files specifically:
- Start with a clear project title and description
- Include a table of contents for longer documents
- Add badges for build status, version, etc. if applicable
- Include installation and setup instructions
- Add usage examples and API documentation
- Include screenshots or demos if applicable
- Add contribution guidelines and development setup
- Include licensing and acknowledgments
- Use proper emoji and formatting for readability
- Structure sections logically (Overview, Installation, Usage, etc.)

Return your response as valid JSON in this exact format:
{
  "content": "# Project Title\\n\\nProject description here...",
  "imports": [],
  "exports": [],
  "dependencies": [],
  "metadata": {
    "hasAsyncOperations": false
  },
  "errors": []
}

Return ONLY valid JSON. The content should be properly escaped Markdown.`;

            default:
                return basePrompt;
        }
    }

    private getUserPrompt(fileSpec: any, context: any, contextualInfo: string): string {
        // Special handling for documentation files
        if (fileSpec.type === 'documentation') {
            return `Generate a comprehensive ${fileSpec.path} documentation file for the following project:

File Path: ${fileSpec.path}
Description: ${fileSpec.description}

Project Specification:
${context?.specification || 'A modern web application'}

Architecture Details:
- Framework: ${context?.plan?.architecture?.framework || 'Next.js'}
- TypeScript: ${context?.plan?.architecture?.typescript || true}
- Styling: ${context?.plan?.architecture?.styling || 'Tailwind CSS'}
- State Management: ${context?.plan?.architecture?.stateManagement || 'React useState'}
- App Router: ${context?.plan?.architecture?.appRouter || true}

${contextualInfo}

Documentation Requirements:
1. Create a professional README.md that clearly explains the project
2. Include a compelling project title and description
3. Add clear installation and setup instructions
4. Include usage examples and getting started guide
5. Explain the project structure and key features
6. Add development workflow and contribution guidelines
7. Include proper formatting with headers, code blocks, and lists
8. Use appropriate Markdown syntax and styling
9. Make it helpful for both users and developers
10. Include any relevant badges, links, or additional resources

The documentation should be well-structured, informative, and professional.

Return your response as valid JSON in this exact format:
{
  "content": "# Project Title\\n\\nA comprehensive description...",
  "imports": [],
  "exports": [],
  "dependencies": [],
  "metadata": {
    "hasAsyncOperations": false
  },
  "errors": []
}

Return ONLY valid JSON with properly escaped Markdown content.`;
        }

        // Original logic for other file types
        return `Generate a ${fileSpec.type} file for the following specification:

File Path: ${fileSpec.path}
File Type: ${fileSpec.type}
Description: ${fileSpec.description}
Dependencies: ${fileSpec.dependencies.join(', ')}

Application Context:
${context?.specification || 'No specification provided'}

Architecture:
- Framework: ${context?.plan?.architecture?.framework || 'Next.js'}
- TypeScript: ${context?.plan?.architecture?.typescript || true}
- State Management: ${context?.plan?.architecture?.stateManagement || 'React useState'}

${contextualInfo}

Requirements:
1. Create ${fileSpec.type === 'hook' ? 'a custom React hook' : fileSpec.type === 'type' ? 'TypeScript type definitions' : 'utility functions'} that ${fileSpec.description}
2. Use proper TypeScript typing throughout
3. Include comprehensive error handling
4. Follow modern JavaScript/TypeScript patterns
5. Ensure code is reusable and maintainable
6. Include helpful JSDoc comments
7. Handle edge cases appropriately
8. Export functions/types using named exports
9. ${fileSpec.type === 'hook' ? 'Follow React hooks conventions and rules' : ''}
10. Make the code production-ready and well-documented

Return your response as valid JSON in this exact format:
{
  "content": "// Complete utility/hook/type code here",
  "imports": ["react", "zod"],
  "exports": ["useCustomHook", "UtilityFunction"],
  "dependencies": ["@/lib/utils"],
  "metadata": {
    "hasAsyncOperations": true,
    "isClientComponent": false
  },
  "errors": []
}

Return ONLY valid JSON that matches this structure. The ${fileSpec.type} should be robust, efficient, and follow best practices.`;
    }
}
