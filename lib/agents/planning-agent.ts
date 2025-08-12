import { google } from "@ai-sdk/google";
import { generateText } from "ai";
import {
    FilePlan,
    FilePlanSchema,
    PlanningContext,
    FileSpec,
    PackageDependency
} from "@/lib/types/generation-types";

export class PlanningAgent {
    private model = google("gemini-2.5-flash");

    constructor() {
        // Vercel AI SDK automatically uses GOOGLE_GENERATIVE_AI_API_KEY environment variable
    }

    async createPlan(context: PlanningContext): Promise<FilePlan> {
        try {
            const { specification, projectType, preferences } = context;

            // Generate the initial plan using Gemini with Zod validation
            const { text } = await generateText({
                model: this.model,
                messages: [
                    {
                        role: "system",
                        content: this.getSystemPrompt(projectType)
                    },
                    {
                        role: "user",
                        content: this.getUserPrompt(specification, preferences)
                    }
                ]
            });

            // Clean the response to handle markdown code blocks
            let cleanedResponse = text.trim();

            // Remove markdown code block markers if present
            if (cleanedResponse.startsWith('```json')) {
                cleanedResponse = cleanedResponse.replace(/^```json\s*/, '').replace(/\s*```$/, '');
            } else if (cleanedResponse.startsWith('```')) {
                cleanedResponse = cleanedResponse.replace(/^```\s*/, '').replace(/\s*```$/, '');
            }

            // Parse and validate the response using Zod
            const planData = JSON.parse(cleanedResponse);
            const validatedPlan = FilePlanSchema.parse(planData);            // Post-process the plan to ensure dependencies are correctly ordered
            const optimizedPlan = this.optimizePlan(validatedPlan);

            return optimizedPlan;

        } catch (error) {
            throw new Error(`Failed to create plan: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    private getSystemPrompt(projectType: string): string {
        return `You are an expert Next.js architect and developer specializing in creating comprehensive, production-ready applications.

Your task is to analyze a user specification and create a detailed file-by-file plan for a ${projectType} application.

Key Requirements:
1. Use Next.js 14+ with App Router (unless specified otherwise)
2. TypeScript by default for type safety
3. Tailwind CSS for styling (unless different preference specified)
4. Component-based architecture with proper separation of concerns
5. Proper file organization following Next.js conventions
6. Include all necessary configuration files
7. Consider SEO, performance, and accessibility
8. Use modern React patterns (Server Components, hooks, etc.)

File Types to Use (exact values):
- page: App Router pages (page.tsx)
- layout: Layout components (layout.tsx)
- loading: Loading pages (loading.tsx)
- error: Error pages (error.tsx)
- component: Reusable UI components
- utility: Helper functions and utilities
- type: TypeScript type definitions
- hook: Custom React hooks
- api: Server-side API endpoints
- config: Configuration files (next.config.js, tailwind.config.js, etc.)
- middleware: Next.js middleware
- style: Global styles and CSS modules
- static: Static files (robots.txt, images, etc.)

Architecture Decisions:
- Choose appropriate state management (useState, Zustand, etc.)
- Decide on UI library integration if needed
- Plan API structure and data flow
- Consider authentication and authorization if applicable
- Plan for responsive design and mobile support

Dependency Management:
- Include all necessary packages with specific versions
- Categorize as dependencies, devDependencies, or peerDependencies
- Provide clear reasons for each dependency
- Consider bundle size and performance impact

Generation Order:
- Start with documentation (README.md) and core configuration files
- Then utilities, types, and hooks  
- Follow with components and layouts
- End with pages and API routes
- Ensure proper dependency resolution order`;
    }

    private getUserPrompt(specification: string, preferences: any): string {
        const prefsText = preferences ? `
User Preferences:
- Styling: ${preferences.styling || 'tailwind'}
- State Management: ${preferences.stateManagement || 'useState'}
- UI Library: ${preferences.uiLibrary || 'none'}
- TypeScript: ${preferences.typescript !== false ? 'enabled' : 'disabled'}
- ESLint: ${preferences.eslint !== false ? 'enabled' : 'disabled'}
- Prettier: ${preferences.prettier !== false ? 'enabled' : 'disabled'}
` : '';

        return `Create a comprehensive file plan for the following application:

${specification}

${prefsText}

Please provide your response as valid JSON that matches this structure:
{
  "files": [
    {
      "path": "README.md",
      "type": "static",
      "description": "Project documentation and setup instructions",
      "dependencies": [],
      "priority": 0
    },
    {
      "path": "package.json",
      "type": "config", 
      "description": "Project dependencies and configuration",
      "dependencies": ["README.md"],
      "priority": 1
    },
    {
      "path": "app/page.tsx",
      "type": "page",
      "description": "Main landing page component",
      "dependencies": ["components/ui/button.tsx"],
      "priority": 6
    }
  ],
  "architecture": {
    "framework": "Next.js 14",
    "styling": "Tailwind CSS",
    "stateManagement": "React useState/useContext",
    "routing": "App Router",
    "typescript": true,
    "appRouter": true
  },
  "dependencies": [
    {
      "package": "next",
      "version": "^14.0.0",
      "reason": "Next.js framework for React applications",
      "type": "dependency"
    },
    {
      "package": "react",
      "version": "^18.0.0", 
      "reason": "React library for building user interfaces",
      "type": "dependency"
    },
    {
      "package": "tailwindcss",
      "version": "^3.0.0",
      "reason": "Utility-first CSS framework",
      "type": "devDependency"
    }
  ],
  "generationOrder": ["config files", "types", "components", "pages", "api routes"]
}

Requirements:
1. A complete list of files with their types, descriptions, dependencies, and generation priority (0-10, where 0 = highest priority)
2. Architecture decisions explaining the chosen technologies and patterns
3. All required package dependencies with versions and reasons
4. The optimal generation order considering file dependencies

Priority Guidelines:
- 0-1: Core documentation and configuration (README.md, package.json)
- 2-3: Foundation files (types, utilities, global styles)
- 4-5: Components and layouts
- 6-7: Pages and complex features
- 8-10: API routes and specialized functionality

IMPORTANT: Use only the exact file type values listed above (page, component, api, etc.). Do not use variations like "api route" or plural forms.

Focus on:
- Clean, maintainable code structure
- Performance optimization
- SEO and accessibility considerations
- Responsive design
- Modern Next.js patterns and best practices
- Type safety throughout the application
- Proper error handling and loading states

Return ONLY valid JSON that matches the structure above.`;
    }

    private optimizePlan(plan: FilePlan): FilePlan {
        // Sort files by priority (1 = highest priority, generated first)
        const sortedFiles = [...plan.files].sort((a, b) => a.priority - b.priority);

        // Create dependency graph and optimize generation order
        const optimizedOrder = this.calculateOptimalOrder(sortedFiles);

        // Ensure core Next.js files are included
        const enhancedFiles = this.ensureCoreFiles(sortedFiles);

        // Validate and enhance dependencies
        const enhancedDependencies = this.enhanceDependencies(plan.dependencies, enhancedFiles);

        return {
            ...plan,
            files: enhancedFiles,
            dependencies: enhancedDependencies,
            generationOrder: optimizedOrder
        };
    }

    private calculateOptimalOrder(files: FileSpec[]): string[] {
        // Build dependency graph
        const graph = new Map<string, string[]>();
        const inDegree = new Map<string, number>();

        // Initialize graph
        files.forEach(file => {
            graph.set(file.path, []);
            inDegree.set(file.path, 0);
        });

        // Add dependencies
        files.forEach(file => {
            file.dependencies.forEach(dep => {
                if (graph.has(dep)) {
                    graph.get(dep)!.push(file.path);
                    inDegree.set(file.path, (inDegree.get(file.path) || 0) + 1);
                }
            });
        });

        // Topological sort with priority consideration
        const queue: Array<{ path: string; priority: number }> = [];
        const result: string[] = [];

        // Start with files that have no dependencies, sorted by priority
        files.forEach(file => {
            if (inDegree.get(file.path) === 0) {
                queue.push({ path: file.path, priority: file.priority });
            }
        });

        // Sort queue by priority
        queue.sort((a, b) => a.priority - b.priority);

        while (queue.length > 0) {
            const current = queue.shift()!;
            result.push(current.path);

            // Update dependencies
            graph.get(current.path)!.forEach(dependent => {
                const newInDegree = (inDegree.get(dependent) || 0) - 1;
                inDegree.set(dependent, newInDegree);

                if (newInDegree === 0) {
                    const file = files.find(f => f.path === dependent);
                    if (file) {
                        queue.push({ path: dependent, priority: file.priority });
                        queue.sort((a, b) => a.priority - b.priority);
                    }
                }
            });
        }

        return result;
    }

    private ensureCoreFiles(files: FileSpec[]): FileSpec[] {
        const paths = new Set(files.map(f => f.path));
        const coreFiles: FileSpec[] = [];

        // Ensure README.md exists first (priority 0 - very early)
        if (!paths.has('README.md')) {
            coreFiles.push({
                path: 'README.md',
                type: 'documentation',
                description: 'Project documentation and setup instructions',
                dependencies: [],
                priority: 0 // Highest priority - generated first
            });
        }

        // Ensure root layout exists
        if (!paths.has('app/layout.tsx')) {
            coreFiles.push({
                path: 'app/layout.tsx',
                type: 'layout',
                description: 'Root layout component for the application',
                dependencies: [],
                priority: 1
            });
        }

        // Ensure globals.css exists if using Tailwind
        if (!paths.has('app/globals.css')) {
            coreFiles.push({
                path: 'app/globals.css',
                type: 'style',
                description: 'Global styles and Tailwind CSS imports',
                dependencies: [],
                priority: 1
            });
        }

        // Ensure next.config.js exists
        if (!paths.has('next.config.js')) {
            coreFiles.push({
                path: 'next.config.js',
                type: 'config',
                description: 'Next.js configuration file',
                dependencies: [],
                priority: 1
            });
        }

        // Ensure package.json exists and comes after README.md
        if (!paths.has('package.json')) {
            coreFiles.push({
                path: 'package.json',
                type: 'config',
                description: 'Project dependencies and configuration',
                dependencies: ['README.md'], // Always depend on README.md
                priority: 1
            });
        }

        return [...coreFiles, ...files];
    }

    private enhanceDependencies(dependencies: PackageDependency[], files: FileSpec[]): PackageDependency[] {
        const deps = new Map(dependencies.map(d => [d.package, d]));

        // Ensure core Next.js dependencies
        if (!deps.has('next')) {
            deps.set('next', {
                package: 'next',
                version: '^14.0.0',
                reason: 'Next.js framework',
                type: 'dependency'
            });
        }

        if (!deps.has('react')) {
            deps.set('react', {
                package: 'react',
                version: '^18.2.0',
                reason: 'React library',
                type: 'dependency'
            });
        }

        if (!deps.has('react-dom')) {
            deps.set('react-dom', {
                package: 'react-dom',
                version: '^18.2.0',
                reason: 'React DOM library',
                type: 'dependency'
            });
        }

        // Add TypeScript dependencies if TypeScript files exist
        const hasTypeScript = files.some(f => f.path.endsWith('.ts') || f.path.endsWith('.tsx'));
        if (hasTypeScript) {
            if (!deps.has('typescript')) {
                deps.set('typescript', {
                    package: 'typescript',
                    version: '^5.0.0',
                    reason: 'TypeScript compiler',
                    type: 'devDependency'
                });
            }

            if (!deps.has('@types/react')) {
                deps.set('@types/react', {
                    package: '@types/react',
                    version: '^18.2.0',
                    reason: 'React type definitions',
                    type: 'devDependency'
                });
            }

            if (!deps.has('@types/node')) {
                deps.set('@types/node', {
                    package: '@types/node',
                    version: '^20.0.0',
                    reason: 'Node.js type definitions',
                    type: 'devDependency'
                });
            }
        }

        // Add Tailwind CSS if style files indicate its use
        const hasTailwind = files.some(f =>
            f.type === 'style' && (f.path.includes('tailwind') || f.description.toLowerCase().includes('tailwind'))
        );
        if (hasTailwind) {
            if (!deps.has('tailwindcss')) {
                deps.set('tailwindcss', {
                    package: 'tailwindcss',
                    version: '^3.4.0',
                    reason: 'Utility-first CSS framework',
                    type: 'devDependency'
                });
            }

            if (!deps.has('autoprefixer')) {
                deps.set('autoprefixer', {
                    package: 'autoprefixer',
                    version: '^10.4.0',
                    reason: 'PostCSS plugin for vendor prefixes',
                    type: 'devDependency'
                });
            }

            if (!deps.has('postcss')) {
                deps.set('postcss', {
                    package: 'postcss',
                    version: '^8.4.0',
                    reason: 'CSS transformation tool',
                    type: 'devDependency'
                });
            }
        }

        return Array.from(deps.values());
    }
}
