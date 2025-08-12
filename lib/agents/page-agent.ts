import type { CoreMessage } from "ai";
import {
    AgentRequest,
    GeneratedFile
} from "@/lib/types/generation-types";
import { BaseStreamingAgent } from "./base-streaming-agent";

export class PageAgent extends BaseStreamingAgent {

    constructor() {
        super();
    }

    protected async buildMessages(request: AgentRequest): Promise<CoreMessage[]> {
        const { fileSpec, previousFiles, context } = request;

        // Determine page type and requirements
        const pageInfo = this.analyzePageRequirements(fileSpec);

        // Build context from previous files
        const contextualInfo = this.buildContext(previousFiles, fileSpec);

        return [
            {
                role: "system",
                content: this.getSystemPrompt(pageInfo)
            },
            {
                role: "user",
                content: this.getUserPrompt(fileSpec, context, contextualInfo, pageInfo)
            }
        ];
    }

    private analyzePageRequirements(fileSpec: any): {
        isLayout: boolean;
        isErrorPage: boolean;
        isLoadingPage: boolean;
        isNotFoundPage: boolean;
        isDynamicRoute: boolean;
        needsMetadata: boolean;
        needsClientFeatures: boolean;
    } {
        const path = fileSpec.path.toLowerCase();
        const description = fileSpec.description?.toLowerCase() || '';

        return {
            isLayout: path.includes('layout.tsx'),
            isErrorPage: path.includes('error.tsx'),
            isLoadingPage: path.includes('loading.tsx'),
            isNotFoundPage: path.includes('not-found.tsx'),
            isDynamicRoute: path.includes('[') && path.includes(']'),
            needsMetadata: !path.includes('layout.tsx') && !path.includes('loading.tsx') && !path.includes('error.tsx'),
            needsClientFeatures: description.includes('interactive') ||
                description.includes('form') ||
                description.includes('button') ||
                description.includes('state') ||
                description.includes('event')
        };
    }

    private buildContext(previousFiles: GeneratedFile[], fileSpec: any): string {
        const relevantFiles = previousFiles.filter(file =>
            file.type === 'component' ||
            file.type === 'utility' ||
            file.type === 'hook' ||
            file.type === 'type' ||
            file.path.includes('layout') ||
            file.path.includes('globals.css')
        );

        if (relevantFiles.length === 0) {
            return "No previous files to reference for page context.";
        }

        return `Available components and utilities:
${relevantFiles.map(file => `
File: ${file.path}
Type: ${file.type}
Exports: ${file.exports.join(', ')}
${file.metadata?.isClientComponent ? '(Client Component)' : '(Server Component)'}
`).join('\n')}

Current Page: ${fileSpec.path}`;
    }

    private getSystemPrompt(pageInfo: any): string {
        let prompt = `You are an expert Next.js developer specializing in creating optimized, SEO-friendly pages using the App Router.

Your task is to generate a Next.js page component that follows App Router conventions and best practices.

Base Requirements:
- Use Next.js 14+ App Router patterns
- Implement proper TypeScript typing
- Use Tailwind CSS for styling with responsive design
- Follow semantic HTML structure for accessibility
- Include proper error boundaries where needed
- Implement loading states appropriately
- Use Server Components by default unless client features are needed
- Include proper metadata for SEO when applicable
- Follow React 18+ patterns and conventions`;

        if (pageInfo.isLayout) {
            prompt += `

Layout Component Requirements:
- Accept children prop with proper typing
- Set up global layout structure (header, nav, footer, etc.)
- Include font configuration and global styles
- Implement proper HTML document structure
- Set up providers (context, theme, etc.) if needed
- Include metadata for the application
- Ensure responsive design across all screen sizes`;
        }

        if (pageInfo.isErrorPage) {
            prompt += `

Error Page Requirements:
- Accept error and reset props with proper typing
- Display user-friendly error messages
- Include error recovery options (retry button, navigation)
- Log errors appropriately for debugging
- Provide helpful navigation back to working pages
- Use proper error page styling and layout`;
        }

        if (pageInfo.isLoadingPage) {
            prompt += `

Loading Page Requirements:
- Create visually appealing loading indicators
- Match the design system and branding
- Include skeleton loaders that match content structure
- Provide smooth transitions when content loads
- Consider accessibility for screen readers
- Use appropriate loading animations`;
        }

        if (pageInfo.isNotFoundPage) {
            prompt += `

404 Not Found Page Requirements:
- Create helpful and branded 404 page
- Include navigation options to return to main content
- Use engaging copy and visuals
- Provide search functionality if applicable
- Include popular or related content suggestions
- Maintain consistent branding and design`;
        }

        if (pageInfo.isDynamicRoute) {
            prompt += `

Dynamic Route Requirements:
- Use proper Next.js params typing
- Handle invalid or missing parameters
- Implement proper data fetching patterns
- Include loading and error states for dynamic content
- Use generateStaticParams if applicable for static generation
- Handle edge cases and validation`;
        }

        if (pageInfo.needsMetadata) {
            prompt += `

Metadata Requirements:
- Export metadata object or generateMetadata function
- Include title, description, and OpenGraph data
- Set up proper keywords and meta tags
- Include Twitter Card metadata
- Use dynamic metadata for dynamic routes
- Optimize for search engines and social sharing`;
        }

        if (pageInfo.needsClientFeatures) {
            prompt += `

Client Component Requirements:
- Add "use client" directive at the top
- Use appropriate React hooks (useState, useEffect, etc.)
- Implement proper event handlers
- Handle form submissions and validations
- Manage local component state effectively
- Include proper error handling for client-side operations`;
        }

        prompt += `

Return only valid, compilable TypeScript/JSX code without any markdown formatting.`;

        return prompt;
    }

    private getUserPrompt(fileSpec: any, context: any, contextualInfo: string, pageInfo: any): string {
        let prompt = `Generate a Next.js page component for the following specification:

File Path: ${fileSpec.path}
Page Type: ${fileSpec.type}
Description: ${fileSpec.description}
Dependencies: ${fileSpec.dependencies.join(', ')}

Page Characteristics:
- Layout Component: ${pageInfo.isLayout}
- Error Page: ${pageInfo.isErrorPage}
- Loading Page: ${pageInfo.isLoadingPage}
- 404 Page: ${pageInfo.isNotFoundPage}
- Dynamic Route: ${pageInfo.isDynamicRoute}
- Needs Metadata: ${pageInfo.needsMetadata}
- Client Features: ${pageInfo.needsClientFeatures}

Application Context:
${context?.specification || 'No specification provided'}

Architecture:
- Framework: ${context?.plan?.architecture?.framework || 'Next.js'}
- Styling: ${context?.plan?.architecture?.styling || 'Tailwind CSS'}
- State Management: ${context?.plan?.architecture?.stateManagement || 'React useState'}
- App Router: ${context?.plan?.architecture?.appRouter || true}

${contextualInfo}`;

        if (pageInfo.isDynamicRoute) {
            const paramName = this.extractParamName(fileSpec.path);
            prompt += `

Dynamic Route Information:
- Parameter: ${paramName}
- Use proper TypeScript typing for params
- Handle parameter validation and edge cases`;
        }

        prompt += `

Requirements:
1. Create a ${pageInfo.isLayout ? 'layout' : pageInfo.isErrorPage ? 'error' : pageInfo.isLoadingPage ? 'loading' : 'page'} component that ${fileSpec.description}
2. Use proper TypeScript typing for all props and parameters
3. Implement responsive design with Tailwind CSS
4. Follow Next.js App Router conventions
5. Include proper SEO optimization${pageInfo.needsMetadata ? ' with metadata export' : ''}
6. Use semantic HTML for accessibility
7. Include appropriate loading and error states
8. ${pageInfo.needsClientFeatures ? 'Use client-side features with "use client" directive' : 'Use Server Component by default'}
9. Implement proper data fetching patterns if needed
10. Follow modern React and Next.js best practices

Return your response as valid JSON in this exact format:
{
  "content": "// Complete page component code here",
  "imports": ["react", "next/link"],
  "exports": ["default", "metadata"],
  "dependencies": ["@/components/ui/button"],
  "metadata": {
    "isClientComponent": false,
    "hasAsyncOperations": true,
    "stateVariables": ["searchQuery"]
  },
  "errors": []
}

IMPORTANT: Return ONLY valid JSON. Ensure all newlines, tabs, and quotes in the page code are properly escaped within the JSON string. Do not wrap the JSON in markdown code blocks.`;

        return prompt;
    }

    private extractParamName(path: string): string {
        const match = path.match(/\[([^\]]+)\]/);
        return match ? match[1] : 'id';
    }
}
