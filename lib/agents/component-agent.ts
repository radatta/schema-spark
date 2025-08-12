import type { CoreMessage } from "ai";
import {
    AgentRequest,
    GeneratedFile
} from "@/lib/types/generation-types";
import { BaseStreamingAgent } from "./base-streaming-agent";

export class ComponentAgent extends BaseStreamingAgent {

    constructor() {
        super();
    }

    protected async buildMessages(request: AgentRequest): Promise<CoreMessage[]> {
        const { fileSpec, previousFiles, context } = request;

        // Determine if this should be a client component
        const needsClientComponent = this.requiresClientComponent(fileSpec, context.specification);

        // Build context from previous files
        const contextualInfo = this.buildContext(previousFiles, fileSpec);

        return [
            {
                role: "system",
                content: this.getSystemPrompt(needsClientComponent)
            },
            {
                role: "user",
                content: this.getUserPrompt(fileSpec, context, contextualInfo)
            }
        ];
    }

    private requiresClientComponent(fileSpec: any, specification: string): boolean {
        const clientIndicators = [
            'interactive', 'button', 'form', 'input', 'onclick', 'onchange',
            'state', 'usestate', 'useeffect', 'event', 'handler',
            'modal', 'dropdown', 'toggle', 'animation', 'drag'
        ];

        const description = fileSpec.description?.toLowerCase() || '';
        const spec = specification?.toLowerCase() || '';
        const path = fileSpec.path.toLowerCase();

        return clientIndicators.some(indicator =>
            description.includes(indicator) ||
            spec.includes(indicator) ||
            path.includes(indicator)
        ) || fileSpec.type === 'component' && !path.includes('server');
    }

    private buildContext(previousFiles: GeneratedFile[], _currentSpec: any): string {
        const relevantFiles = previousFiles.filter(file =>
            file.type === 'type' ||
            file.type === 'utility' ||
            file.type === 'hook' ||
            file.path.includes('layout') ||
            file.path.includes('globals.css')
        );

        if (relevantFiles.length === 0) {
            return "No previous files to reference.";
        }

        return `Previous files for context:
${relevantFiles.map(file => `
File: ${file.path}
Type: ${file.type}
Exports: ${file.exports.join(', ')}
${file.metadata?.componentProps ? `Props: ${file.metadata.componentProps.map(p => `${p.name}: ${p.type}`).join(', ')}` : ''}
`).join('\n')}`;
    }

    private getSystemPrompt(isClientComponent: boolean): string {
        return `You are an expert React and Next.js developer specializing in creating modern, performant components.

Your task is to generate a ${isClientComponent ? 'client' : 'server'} component that follows Next.js 14+ best practices.

Key Requirements:
${isClientComponent ? '- Add "use client" directive at the top if this component needs client-side features' : '- This is a server component by default (no "use client" directive needed)'}
- Use TypeScript with proper type definitions
- Follow React 18+ patterns and best practices
- Use Tailwind CSS for styling with responsive design
- Implement proper error boundaries and loading states where appropriate
- Use semantic HTML for accessibility
- Follow the component naming convention (PascalCase)
- Include proper TypeScript interfaces for props
- Use modern React patterns (hooks, functional components)
- Ensure components are reusable and maintainable

Component Structure:
1. Import statements (React, Next.js, utilities, types)
2. TypeScript interface for props (if applicable)
3. Component function with proper typing
4. JSX return with semantic HTML and Tailwind classes
5. Export statement

Styling Guidelines:
- Use Tailwind CSS utility classes
- Implement responsive design (sm:, md:, lg:, xl:)
- Follow a consistent color scheme
- Use proper spacing and typography
- Ensure accessibility with proper contrast and focus states

${isClientComponent ? `
Client Component Features:
- useState for local state management
- useEffect for side effects
- Event handlers for user interactions
- Form handling and validation
- Browser APIs if needed
` : `
Server Component Features:
- Async/await for data fetching if needed
- No client-side hooks (useState, useEffect, etc.)
- Can directly access databases or APIs
- Better performance and SEO
`}

Return only valid, compilable TypeScript/JSX code without any markdown formatting.`;
    }

    private getUserPrompt(fileSpec: any, context: any, contextualInfo: string): string {
        return `Generate a React component for the following specification:

File Path: ${fileSpec.path}
Component Type: ${fileSpec.type}
Description: ${fileSpec.description}
Dependencies: ${fileSpec.dependencies.join(', ')}

Application Context:
${context?.specification || 'No specification provided'}

Architecture:
- Framework: ${context?.plan?.architecture?.framework || 'Next.js'}
- Styling: ${context?.plan?.architecture?.styling || 'Tailwind CSS'}
- State Management: ${context?.plan?.architecture?.stateManagement || 'React useState'}
- UI Library: ${context?.plan?.architecture?.uiLibrary || 'None'}

${contextualInfo}

Requirements:
1. Create a functional, reusable component
2. Use proper TypeScript typing for all props and state
3. Implement responsive design with Tailwind CSS
4. Follow Next.js best practices and conventions
5. Include proper error handling and loading states if applicable
6. Ensure accessibility compliance
7. Use semantic HTML elements
8. Include helpful comments for complex logic

Return your response as valid JSON in this exact format:
{
  "content": "// Complete component code here - ensure newlines are properly escaped as \\n",
  "imports": ["react", "next/link"],
  "exports": ["ComponentName"],
  "dependencies": ["@/components/ui/button"],
  "metadata": {
    "isClientComponent": true,
    "hasAsyncOperations": false,
    "stateVariables": ["count", "isLoading"],
    "componentProps": [
      {
        "name": "title",
        "type": "string",
        "required": true
      }
    ]
  },
  "errors": []
}

IMPORTANT: Return ONLY valid JSON. Ensure all newlines, tabs, and quotes in the component code are properly escaped within the JSON string. Do not wrap the JSON in markdown code blocks.`;
    }
}
