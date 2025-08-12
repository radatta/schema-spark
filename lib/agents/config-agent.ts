import type { CoreMessage } from "ai";
import {
    AgentRequest,
    GeneratedFile
} from "@/lib/types/generation-types";
import { BaseStreamingAgent } from "./base-streaming-agent";

export class ConfigAgent extends BaseStreamingAgent {

    constructor() {
        super();
    }

    // Override the main method to handle special JSON config cases
    async generateFile(request: AgentRequest, callbacks?: any): Promise<GeneratedFile> {
        const { fileSpec } = request;

        // Handle different config file types
        if (this.isJSONConfig(fileSpec.path)) {
            return await this.generateJSONConfig(fileSpec, request.context);
        }

        // Use streaming for non-JSON configs
        return await super.generateFile(request, callbacks);
    }

    protected async buildMessages(request: AgentRequest): Promise<CoreMessage[]> {
        const { fileSpec, previousFiles, context } = request;

        // Build context from previous files
        const contextualInfo = this.buildContext(previousFiles, fileSpec);

        return [
            {
                role: "system",
                content: this.getSystemPrompt(fileSpec)
            },
            {
                role: "user",
                content: this.getUserPrompt(fileSpec, context, contextualInfo)
            }
        ];
    }

    private isJSONConfig(path: string): boolean {
        return path.endsWith('.json') || path === 'package.json';
    }

    private async generateJSONConfig(fileSpec: any, context: any): Promise<GeneratedFile> {
        let content = '';

        if (fileSpec.path === 'package.json') {
            content = this.generatePackageJSON(context);
        } else if (fileSpec.path.includes('tsconfig')) {
            content = this.generateTSConfig();
        } else {
            content = '{}';
        }

        return {
            path: fileSpec.path,
            content,
            type: fileSpec.type,
            imports: [],
            exports: [],
            metadata: {}
        };
    }

    private generatePackageJSON(context: any): string {
        const basePackage = {
            name: context.plan.architecture.framework === 'nextjs' ? 'nextjs-generated-app' : 'generated-app',
            version: '0.1.0',
            private: true,
            scripts: {
                dev: 'next dev',
                build: 'next build',
                start: 'next start',
                lint: 'next lint'
            },
            dependencies: {} as Record<string, string>,
            devDependencies: {} as Record<string, string>
        };

        // Add dependencies from the plan
        context.plan.dependencies.forEach((dep: any) => {
            if (dep.type === 'devDependency') {
                basePackage.devDependencies[dep.package] = dep.version;
            } else {
                basePackage.dependencies[dep.package] = dep.version;
            }
        });

        return JSON.stringify(basePackage, null, 2);
    }

    private generateTSConfig(): string {
        const tsConfig = {
            compilerOptions: {
                target: 'es5',
                lib: ['dom', 'dom.iterable', 'es6'],
                allowJs: true,
                skipLibCheck: true,
                strict: true,
                noEmit: true,
                esModuleInterop: true,
                module: 'esnext',
                moduleResolution: 'bundler',
                resolveJsonModule: true,
                isolatedModules: true,
                jsx: 'preserve',
                incremental: true,
                plugins: [
                    {
                        name: 'next'
                    }
                ],
                paths: {
                    '@/*': ['./lib/*', './app/*', './components/*']
                }
            },
            include: ['next-env.d.ts', '**/*.ts', '**/*.tsx', '.next/types/**/*.ts'],
            exclude: ['node_modules']
        };

        return JSON.stringify(tsConfig, null, 2);
    }

    private buildContext(previousFiles: GeneratedFile[], fileSpec: any): string {
        const relevantFiles = previousFiles.filter(file =>
            file.type === 'config' ||
            file.type === 'type' ||
            file.path.includes('package.json')
        );

        if (relevantFiles.length === 0) {
            return "No previous config files to reference.";
        }

        return `Previous config files:
${relevantFiles.map(file => `
File: ${file.path}
Type: ${file.type}
`).join('\n')}

Current Config: ${fileSpec.path}`;
    }

    private getSystemPrompt(fileSpec: any): string {
        const fileName = fileSpec.path.split('/').pop();

        let basePrompt = `You are an expert developer specializing in configuration files for modern web applications.

Your task is to generate a ${fileName} configuration file that follows best practices.

General Requirements:
- Use proper syntax for the configuration format
- Include comprehensive and well-documented settings
- Follow security best practices
- Optimize for development and production environments
- Include helpful comments where appropriate
- Use environment variables for sensitive data
- Follow the latest standards and conventions`;

        if (fileName === 'next.config.js' || fileName === 'next.config.mjs') {
            basePrompt += `

Next.js Configuration Requirements:
- Use modern Next.js configuration patterns
- Include experimental features if beneficial
- Set up proper output configuration
- Configure image optimization settings
- Set up webpack customizations if needed
- Include proper TypeScript support
- Configure environment variables handling
- Set up proper redirects and rewrites if needed
- Include security headers configuration
- Configure bundle analyzer for optimization`;

        } else if (fileName === 'tailwind.config.js' || fileName === 'tailwind.config.ts') {
            basePrompt += `

Tailwind CSS Configuration Requirements:
- Configure content paths for all relevant files
- Set up custom theme extensions (colors, fonts, spacing)
- Include responsive breakpoints
- Configure plugins for additional functionality
- Set up dark mode support if applicable
- Include custom utilities and components
- Configure preflight and base styles
- Set up proper purging for production builds
- Include animation and transition configurations`;

        } else if (fileName === 'postcss.config.js') {
            basePrompt += `

PostCSS Configuration Requirements:
- Include Tailwind CSS plugin
- Add autoprefixer for vendor prefixes
- Include other useful PostCSS plugins
- Configure for both development and production
- Set up proper plugin ordering
- Include source map configuration`;

        } else if (fileName?.includes('eslint')) {
            basePrompt += `

ESLint Configuration Requirements:
- Extend Next.js recommended rules
- Include TypeScript ESLint rules
- Set up proper parser and environment
- Configure rules for React hooks
- Include accessibility rules
- Set up import/export rules
- Configure formatting rules
- Include custom rule overrides where needed`;

        } else if (fileSpec.type === 'style') {
            basePrompt += `

Style Configuration Requirements:
- Set up global styles and CSS variables
- Include Tailwind CSS imports
- Configure font imports and setup
- Set up proper CSS reset or normalize
- Include responsive design utilities
- Configure dark mode styles if needed
- Set up custom component styles
- Include print styles if applicable`;
        }

        basePrompt += `

Return only valid configuration code without any markdown formatting.`;

        return basePrompt;
    }

    private getUserPrompt(fileSpec: any, context: any, contextualInfo: string): string {
        return `Generate a configuration file for the following specification:

File Path: ${fileSpec.path}
Config Type: ${fileSpec.type}
Description: ${fileSpec.description}
Dependencies: ${fileSpec.dependencies.join(', ')}

Application Context:
${context?.specification || 'No specification provided'}

Architecture:
- Framework: ${context?.plan?.architecture?.framework || 'Next.js'}
- Styling: ${context?.plan?.architecture?.styling || 'Tailwind CSS'}
- TypeScript: ${context?.plan?.architecture?.typescript || true}
- App Router: ${context?.plan?.architecture?.appRouter || true}

${contextualInfo}

Requirements:
1. Create a comprehensive configuration file that ${fileSpec.description}
2. Include all necessary settings for development and production
3. Follow best practices and security guidelines
4. Use appropriate defaults and optimizations
5. Include helpful comments for complex configurations
6. Ensure compatibility with the chosen architecture
7. Configure for optimal performance and developer experience
8. Include proper error handling and validation where applicable
9. Set up environment-specific configurations
10. Make the configuration production-ready and maintainable

Return your response as valid JSON in this exact format:
{
  "content": "// Complete configuration file content here",
  "imports": ["next"],
  "exports": ["default"],
  "dependencies": [],
  "metadata": {
    "configType": "next.config.js",
    "hasAsyncOperations": false
  },
  "errors": []
}

Return ONLY valid JSON that matches this structure. The configuration should be optimized for the specified architecture and use case.`;
    }
}
