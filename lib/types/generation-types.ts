import { z } from "zod";

// Core generation request types
export interface GenerationRequest {
    projectId?: string; // Add projectId for Convex saving
    specification: string;
    projectType?: 'nextjs' | 'react' | 'vue' | 'vanilla';
    preferences?: {
        styling?: 'tailwind' | 'css-modules' | 'styled-components' | 'scss';
        stateManagement?: 'useState' | 'zustand' | 'redux' | 'context';
        uiLibrary?: 'shadcn' | 'mui' | 'chakra' | 'none';
        typescript?: boolean;
        eslint?: boolean;
        prettier?: boolean;
    };
    authToken?: string; // Add authToken for Convex auth
}

export interface GenerationResponse {
    files: GeneratedFile[];
    structure: ProjectStructure;
    validation: ValidationResults;
    dependencies: PackageDependency[];
}

// Zod schemas for structured outputs
export const FileSchema = z.object({
    path: z.string(),
    type: z.enum([
        'component',
        'utility',
        'config',
        'style',
        'styles',  // plural version
        'api',
        'api route', // api route with space
        'type',
        'types',   // plural version
        'hook',
        'hooks',   // plural version
        'page',
        'layout',
        'middleware',
        'loading',
        'error',
        'not-found',
        'global-error',
        'route',
        'template',
        'default',
        'static',   // for static files like robots.txt
        'documentation'  // for README.md and other docs
    ]),
    description: z.string(),
    dependencies: z.array(z.string()),
    priority: z.number().min(0).max(10), // Allow 0-10 for more flexibility
    template: z.string().optional(),
});

export const ArchitectureSchema = z.object({
    framework: z.string(),
    styling: z.string(),
    stateManagement: z.string(),
    routing: z.string(),
    typescript: z.boolean().default(true),
    appRouter: z.boolean().default(true),
    uiLibrary: z.string().optional(),
    dataFetching: z.string().optional(),
    reasoning: z.string().optional(),
});

export const PackageDependencySchema = z.object({
    package: z.string(),
    version: z.string(),
    reason: z.string(),
    type: z.enum(['dependency', 'devDependency', 'peerDependency']).default('dependency'),
});

export const FilePlanSchema = z.object({
    files: z.array(FileSchema),
    architecture: ArchitectureSchema,
    dependencies: z.array(PackageDependencySchema),
    generationOrder: z.array(z.string()),
});

export const FileGenerationSchema = z.object({
    content: z.string(),
    imports: z.array(z.string()),
    exports: z.array(z.string()),
    dependencies: z.array(z.string()),
    metadata: z.object({
        isClientComponent: z.boolean().optional(),
        hasAsyncOperations: z.boolean().optional(),
        apiEndpoints: z.array(z.string()).optional(),
        stateVariables: z.array(z.string()).optional(),
    }).optional(),
    errors: z.array(z.string()).optional(),
});

// TypeScript interfaces derived from Zod schemas
export type FileSpec = z.infer<typeof FileSchema>;
export type Architecture = z.infer<typeof ArchitectureSchema>;
export type PackageDependency = z.infer<typeof PackageDependencySchema>;
export type FilePlan = z.infer<typeof FilePlanSchema>;
export type FileGeneration = z.infer<typeof FileGenerationSchema>;

// Generation context types
export interface GenerationContext {
    runId: string;
    specification: string;
    plan: FilePlan;
    onProgress: (progress: ProgressEvent) => void;
}

export interface PlanningContext {
    specification: string;
    projectType: string;
    preferences: GenerationRequest['preferences'];
}

// File generation types
export interface GeneratedFile {
    path: string;
    content: string;
    type: FileSpec['type'];
    imports: string[];
    exports: string[];
    metadata?: {
        isClientComponent?: boolean;
        hasAsyncOperations?: boolean;
        apiEndpoints?: string[];
        stateVariables?: string[];
        componentProps?: Array<{
            name: string;
            type: string;
            required: boolean;
        }>;
    };
}

// Project structure types
export interface ProjectStructure {
    name: string;
    version: string;
    description: string;
    scripts: Record<string, string>;
    dependencies: Record<string, string>;
    devDependencies: Record<string, string>;
    directories: Directory[];
    configFiles: ConfigFile[];
}

export interface Directory {
    path: string;
    files: string[];
    subdirectories: Directory[];
}

export interface ConfigFile {
    name: string;
    content: string;
    description: string;
}

// Validation types
export interface ValidationResults {
    isValid: boolean;
    totalErrors: number;
    totalWarnings: number;
    qualityScore: number;
    securityRisk: 'low' | 'medium' | 'high';
    files: FileValidation[];
    dependencies: DependencyValidation[];
    suggestions: string[];
}

export interface FileValidation {
    path: string;
    isValid: boolean;
    errors: ValidationIssue[];
    warnings: ValidationWarning[];
    qualityScore: number;
    metrics: CodeMetrics;
}

export interface ValidationIssue {
    line?: number;
    column?: number;
    message: string;
    code?: string;
    severity: 'error' | 'warning' | 'info';
}

export interface ValidationWarning {
    line?: number;
    column?: number;
    message: string;
    code?: string;
    suggestion?: string;
}

export interface DependencyValidation {
    package: string;
    version: string;
    isValid: boolean;
    hasVulnerabilities: boolean;
    alternatives?: string[];
}

export interface CodeMetrics {
    linesOfCode: number;
    complexity: number;
    maintainability: number;
    testCoverage?: number;
}

// Progress tracking types
export interface ProgressEvent {
    type: 'planning_start' | 'planning_complete' | 'generation_start' | 'file_generated' | 'file_chunk' |
    'validation_start' | 'validation_complete' | 'generation_complete' | 'error';
    runId: string;
    message: string;
    data?: any;
    progress?: {
        current: number;
        total: number;
        percentage: number;
    };
}

// Agent communication types
export interface AgentRequest {
    context: GenerationContext;
    fileSpec: FileSpec;
    previousFiles: GeneratedFile[];
}

export interface AgentResponse {
    success: boolean;
    file?: GeneratedFile;
    error?: string;
    dependencies?: string[];
}

// Template types
export interface Template {
    id: string;
    name: string;
    description: string;
    content: string;
    variables: TemplateVariable[];
}

export interface TemplateVariable {
    name: string;
    type: 'string' | 'boolean' | 'array' | 'object';
    required: boolean;
    default?: any;
    description?: string;
}

// Error types
export class GenerationError extends Error {
    constructor(
        message: string,
        public code: string,
        public details?: any
    ) {
        super(message);
        this.name = 'GenerationError';
    }
}

export class ValidationError extends Error {
    constructor(
        message: string,
        public file: string,
        public line?: number,
        public column?: number
    ) {
        super(message);
        this.name = 'ValidationError';
    }
}

// Next.js specific types
export interface NextJSConfig {
    appRouter: boolean;
    srcDirectory: boolean;
    typescript: boolean;
    tailwind: boolean;
    eslint: boolean;
    experimental: Record<string, any>;
}

export interface NextJSPageMetadata {
    title?: string;
    description?: string;
    openGraph?: {
        title?: string;
        description?: string;
        images?: string[];
    };
    twitter?: {
        card?: string;
        title?: string;
        description?: string;
    };
}

// Component generation types
export interface ComponentSpec {
    name: string;
    type: 'page' | 'component' | 'layout';
    props?: Array<{
        name: string;
        type: string;
        required: boolean;
        default?: any;
    }>;
    children?: boolean;
    clientComponent?: boolean;
    hooks?: string[];
    imports?: string[];
}

// API route types
export interface APIRouteSpec {
    path: string;
    methods: Array<'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH'>;
    middleware?: string[];
    validation?: {
        query?: Record<string, string>;
        body?: Record<string, string>;
        params?: Record<string, string>;
    };
    response?: {
        success: Record<string, any>;
        error: Record<string, any>;
    };
}
