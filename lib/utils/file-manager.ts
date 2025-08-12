import {
    GeneratedFile,
    ProjectStructure,
    Directory,
    ConfigFile,
    Architecture
} from "@/lib/types/generation-types";

export class FileManager {
    async createProjectStructure(
        files: GeneratedFile[],
        architecture: Architecture
    ): Promise<ProjectStructure> {
        try {
            // Extract project information
            const packageJson = files.find(f => f.path === 'package.json');
            const projectName = this.extractProjectName(packageJson?.content);

            // Build directory structure
            const directories = this.buildDirectoryStructure(files);

            // Extract dependencies
            const { dependencies, devDependencies } = this.extractDependencies(files);

            // Generate scripts
            const scripts = this.generateScripts(architecture);

            // Create config files
            const configFiles = this.extractConfigFiles(files);

            return {
                name: projectName,
                version: '0.1.0',
                description: `Generated ${architecture.framework} application`,
                scripts,
                dependencies,
                devDependencies,
                directories,
                configFiles
            };

        } catch (error) {
            throw new Error(`Failed to create project structure: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    private extractProjectName(packageJsonContent?: string): string {
        if (packageJsonContent) {
            try {
                const packageData = JSON.parse(packageJsonContent);
                return packageData.name || 'generated-app';
            } catch {
                // Fall through to default
            }
        }
        return 'generated-app';
    }

    private buildDirectoryStructure(files: GeneratedFile[]): Directory[] {
        const dirMap = new Map<string, Set<string>>();

        // Group files by directory
        files.forEach(file => {
            const pathParts = file.path.split('/');
            const fileName = pathParts.pop() || '';
            const dirPath = pathParts.join('/') || '.';

            if (!dirMap.has(dirPath)) {
                dirMap.set(dirPath, new Set());
            }
            dirMap.get(dirPath)!.add(fileName);
        });

        // Build directory tree
        const directories: Directory[] = [];
        const sortedDirs = Array.from(dirMap.keys()).sort();

        sortedDirs.forEach(dirPath => {
            const files = Array.from(dirMap.get(dirPath) || []).sort();
            const pathParts = dirPath === '.' ? [] : dirPath.split('/');

            // Find or create parent directories
            let currentLevel = directories;
            let currentPath = '';

            pathParts.forEach((part, index) => {
                currentPath = currentPath ? `${currentPath}/${part}` : part;

                let existingDir = currentLevel.find(d => d.path === currentPath);
                if (!existingDir) {
                    existingDir = {
                        path: currentPath,
                        files: index === pathParts.length - 1 ? files : [],
                        subdirectories: []
                    };
                    currentLevel.push(existingDir);
                }

                if (index === pathParts.length - 1) {
                    existingDir.files = files;
                }

                currentLevel = existingDir.subdirectories;
            });

            // Handle root files
            if (dirPath === '.') {
                const rootDir = directories.find(d => d.path === '.') || {
                    path: '.',
                    files: [],
                    subdirectories: []
                };
                if (!directories.find(d => d.path === '.')) {
                    directories.unshift(rootDir);
                }
                rootDir.files = files;
            }
        });

        return directories;
    }

    private extractDependencies(files: GeneratedFile[]): {
        dependencies: Record<string, string>;
        devDependencies: Record<string, string>;
    } {
        const packageJson = files.find(f => f.path === 'package.json');

        if (packageJson) {
            try {
                const packageData = JSON.parse(packageJson.content);
                return {
                    dependencies: packageData.dependencies || {},
                    devDependencies: packageData.devDependencies || {}
                };
            } catch {
                // Fall through to default
            }
        }

        // Extract from all files if package.json parsing fails
        const allDependencies = new Set<string>();

        files.forEach(file => {
            file.imports.forEach(imp => {
                // Only include external packages (not relative imports)
                if (!imp.startsWith('./') && !imp.startsWith('../') && !imp.startsWith('@/')) {
                    const packageName = imp.startsWith('@') ?
                        imp.split('/').slice(0, 2).join('/') :
                        imp.split('/')[0];
                    allDependencies.add(packageName);
                }
            });
        });

        // Categorize dependencies
        const dependencies: Record<string, string> = {};
        const devDependencies: Record<string, string> = {};

        allDependencies.forEach(dep => {
            if (this.isDevDependency(dep)) {
                devDependencies[dep] = 'latest';
            } else {
                dependencies[dep] = 'latest';
            }
        });

        return { dependencies, devDependencies };
    }

    private isDevDependency(packageName: string): boolean {
        const devPackages = [
            '@types/',
            'eslint',
            'prettier',
            'typescript',
            'tailwindcss',
            'autoprefixer',
            'postcss',
            '@typescript-eslint/',
            'jest',
            'vitest',
            '@testing-library/'
        ];

        return devPackages.some(devPkg => packageName.startsWith(devPkg));
    }

    private generateScripts(architecture: Architecture): Record<string, string> {
        const scripts: Record<string, string> = {};

        if (architecture.framework === 'Next.js' || architecture.framework === 'nextjs') {
            scripts.dev = 'next dev';
            scripts.build = 'next build';
            scripts.start = 'next start';
            scripts.lint = 'next lint';
        } else {
            scripts.dev = 'npm run dev';
            scripts.build = 'npm run build';
            scripts.start = 'npm run start';
        }

        if (architecture.typescript) {
            scripts['type-check'] = 'tsc --noEmit';
        }

        return scripts;
    }

    private extractConfigFiles(files: GeneratedFile[]): ConfigFile[] {
        const configFiles: ConfigFile[] = [];

        const configFilePatterns = [
            'next.config.js',
            'next.config.mjs',
            'tailwind.config.js',
            'tailwind.config.ts',
            'postcss.config.js',
            'tsconfig.json',
            '.eslintrc.json',
            '.eslintrc.js',
            'prettier.config.js',
            '.prettierrc'
        ];

        files.forEach(file => {
            const fileName = file.path.split('/').pop() || '';
            if (configFilePatterns.includes(fileName) || fileName.startsWith('.env')) {
                configFiles.push({
                    name: fileName,
                    content: file.content,
                    description: this.getConfigDescription(fileName)
                });
            }
        });

        return configFiles;
    }

    private getConfigDescription(fileName: string): string {
        const descriptions: Record<string, string> = {
            'next.config.js': 'Next.js configuration for build and runtime settings',
            'next.config.mjs': 'Next.js configuration with ES modules support',
            'tailwind.config.js': 'Tailwind CSS configuration for styling customization',
            'tailwind.config.ts': 'Tailwind CSS configuration with TypeScript support',
            'postcss.config.js': 'PostCSS configuration for CSS processing',
            'tsconfig.json': 'TypeScript compiler configuration',
            '.eslintrc.json': 'ESLint configuration for code linting',
            '.eslintrc.js': 'ESLint configuration with JavaScript support',
            'prettier.config.js': 'Prettier configuration for code formatting',
            '.prettierrc': 'Prettier configuration file',
            'package.json': 'Node.js package configuration and dependencies'
        };

        return descriptions[fileName] || `Configuration file: ${fileName}`;
    }

    async validateProjectStructure(structure: ProjectStructure): Promise<{
        isValid: boolean;
        errors: string[];
        warnings: string[];
    }> {
        const errors: string[] = [];
        const warnings: string[] = [];

        try {
            // Check for required files
            const hasPackageJson = structure.configFiles.some(f => f.name === 'package.json');
            if (!hasPackageJson) {
                errors.push('Missing package.json file');
            }

            // Check directory structure
            const hasAppDir = structure.directories.some(d => d.path.includes('app'));
            const hasSrcDir = structure.directories.some(d => d.path.includes('src'));

            if (!hasAppDir && !hasSrcDir) {
                warnings.push('No app or src directory found - ensure proper Next.js structure');
            }

            // Check for TypeScript config
            const hasTypeScript = Object.keys(structure.dependencies).some(dep => dep === 'typescript') ||
                Object.keys(structure.devDependencies).some(dep => dep === 'typescript');
            const hasTsConfig = structure.configFiles.some(f => f.name === 'tsconfig.json');

            if (hasTypeScript && !hasTsConfig) {
                warnings.push('TypeScript dependency found but no tsconfig.json');
            }

            // Check for Next.js dependencies
            const hasNext = Object.keys(structure.dependencies).some(dep => dep === 'next');
            if (!hasNext) {
                errors.push('Next.js dependency not found in dependencies');
            }

            // Check scripts
            if (!structure.scripts.dev) {
                warnings.push('No development script found');
            }

            if (!structure.scripts.build) {
                warnings.push('No build script found');
            }

            return {
                isValid: errors.length === 0,
                errors,
                warnings
            };

        } catch (error) {
            return {
                isValid: false,
                errors: [`Validation error: ${error instanceof Error ? error.message : 'Unknown error'}`],
                warnings: []
            };
        }
    }

    getProjectStatistics(structure: ProjectStructure): {
        totalFiles: number;
        totalDirectories: number;
        totalDependencies: number;
        configFiles: number;
        complexity: 'low' | 'medium' | 'high';
    } {
        const totalFiles = this.countFiles(structure.directories);
        const totalDirectories = this.countDirectories(structure.directories);
        const totalDependencies = Object.keys(structure.dependencies).length +
            Object.keys(structure.devDependencies).length;
        const configFiles = structure.configFiles.length;

        // Determine complexity based on project size
        let complexity: 'low' | 'medium' | 'high' = 'low';
        if (totalFiles > 20 || totalDependencies > 15) complexity = 'medium';
        if (totalFiles > 50 || totalDependencies > 30) complexity = 'high';

        return {
            totalFiles,
            totalDirectories,
            totalDependencies,
            configFiles,
            complexity
        };
    }

    private countFiles(directories: Directory[]): number {
        return directories.reduce((count, dir) => {
            return count + dir.files.length + this.countFiles(dir.subdirectories);
        }, 0);
    }

    private countDirectories(directories: Directory[]): number {
        return directories.reduce((count, dir) => {
            return count + 1 + this.countDirectories(dir.subdirectories);
        }, 0);
    }
}
