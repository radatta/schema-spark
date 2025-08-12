import {
    GeneratedFile,
    ValidationResults,
    FileValidation,
    ValidationIssue,
    ValidationWarning,
    DependencyValidation,
    CodeMetrics
} from "@/lib/types/generation-types";

export class ValidationService {
    async validateProject(files: GeneratedFile[]): Promise<ValidationResults> {
        try {
            const fileValidations: FileValidation[] = [];
            let totalErrors = 0;
            let totalWarnings = 0;

            // Validate each file
            for (const file of files) {
                const validation = await this.validateFile(file, files);
                fileValidations.push(validation);
                totalErrors += validation.errors.length;
                totalWarnings += validation.warnings.length;
            }

            // Validate dependencies
            const dependencyValidations = await this.validateDependencies(files);

            // Calculate overall quality score
            const qualityScore = this.calculateQualityScore(fileValidations);

            // Assess security risk
            const securityRisk = this.assessSecurityRisk(files);

            // Generate suggestions
            const suggestions = this.generateSuggestions(fileValidations, files);

            return {
                isValid: totalErrors === 0,
                totalErrors,
                totalWarnings,
                qualityScore,
                securityRisk,
                files: fileValidations,
                dependencies: dependencyValidations,
                suggestions
            };

        } catch (error) {
            console.error("Project validation error:", error);
            return {
                isValid: false,
                totalErrors: 1,
                totalWarnings: 0,
                qualityScore: 0,
                securityRisk: 'high',
                files: [],
                dependencies: [],
                suggestions: [`Validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`]
            };
        }
    }

    private async validateFile(file: GeneratedFile, allFiles: GeneratedFile[]): Promise<FileValidation> {
        const errors: ValidationIssue[] = [];
        const warnings: ValidationWarning[] = [];

        try {
            // Syntax validation
            const syntaxErrors = this.validateSyntax(file);
            errors.push(...syntaxErrors);

            // Import/export validation
            const importErrors = this.validateImports(file, allFiles);
            errors.push(...importErrors);

            // Type validation for TypeScript files
            if (file.path.endsWith('.ts') || file.path.endsWith('.tsx')) {
                const typeErrors = this.validateTypeScript(file);
                errors.push(...typeErrors);
            }

            // React-specific validation
            if (file.path.endsWith('.tsx') || file.content.includes('React')) {
                const reactWarnings = this.validateReact(file);
                warnings.push(...reactWarnings);
            }

            // Next.js-specific validation
            const nextjsWarnings = this.validateNextJS(file);
            warnings.push(...nextjsWarnings);

            // Code quality checks
            const qualityWarnings = this.validateCodeQuality(file);
            warnings.push(...qualityWarnings);

            // Calculate metrics
            const metrics = this.calculateCodeMetrics(file);

            // Calculate file quality score
            const qualityScore = this.calculateFileQuality(errors, warnings, metrics);

            return {
                path: file.path,
                isValid: errors.length === 0,
                errors,
                warnings,
                qualityScore,
                metrics
            };

        } catch (error) {
            return {
                path: file.path,
                isValid: false,
                errors: [{
                    message: `Validation error: ${error instanceof Error ? error.message : 'Unknown error'}`,
                    severity: 'error' as const
                }],
                warnings: [],
                qualityScore: 0,
                metrics: {
                    linesOfCode: 0,
                    complexity: 0,
                    maintainability: 0
                }
            };
        }
    }

    private validateSyntax(file: GeneratedFile): ValidationIssue[] {
        const errors: ValidationIssue[] = [];
        const content = file.content;

        // Basic bracket matching
        const openBraces = (content.match(/{/g) || []).length;
        const closeBraces = (content.match(/}/g) || []).length;
        if (openBraces !== closeBraces) {
            errors.push({
                message: `Unmatched braces: ${openBraces} opening vs ${closeBraces} closing`,
                severity: 'error'
            });
        }

        const openParens = (content.match(/\(/g) || []).length;
        const closeParens = (content.match(/\)/g) || []).length;
        if (openParens !== closeParens) {
            errors.push({
                message: `Unmatched parentheses: ${openParens} opening vs ${closeParens} closing`,
                severity: 'error'
            });
        }

        const openBrackets = (content.match(/\[/g) || []).length;
        const closeBrackets = (content.match(/\]/g) || []).length;
        if (openBrackets !== closeBrackets) {
            errors.push({
                message: `Unmatched brackets: ${openBrackets} opening vs ${closeBrackets} closing`,
                severity: 'error'
            });
        }

        // Check for unterminated strings
        const singleQuotes = (content.match(/'/g) || []).length;
        const doubleQuotes = (content.match(/"/g) || []).length;
        const backticks = (content.match(/`/g) || []).length;

        if (singleQuotes % 2 !== 0) {
            errors.push({
                message: 'Unterminated string with single quotes',
                severity: 'error'
            });
        }

        if (doubleQuotes % 2 !== 0) {
            errors.push({
                message: 'Unterminated string with double quotes',
                severity: 'error'
            });
        }

        if (backticks % 2 !== 0) {
            errors.push({
                message: 'Unterminated template literal',
                severity: 'error'
            });
        }

        return errors;
    }

    private validateImports(file: GeneratedFile, allFiles: GeneratedFile[]): ValidationIssue[] {
        const errors: ValidationIssue[] = [];
        const availableExports = new Map<string, string[]>();

        // Build map of available exports
        allFiles.forEach(f => {
            availableExports.set(f.path, f.exports);
        });

        // Check imports
        file.imports.forEach(importPath => {
            if (importPath.startsWith('./') || importPath.startsWith('../')) {
                const resolvedPath = this.resolveImportPath(file.path, importPath);
                if (!allFiles.find(f => f.path === resolvedPath || f.path === resolvedPath + '.ts' || f.path === resolvedPath + '.tsx')) {
                    errors.push({
                        message: `Import '${importPath}' references non-existent file`,
                        severity: 'error'
                    });
                }
            }
        });

        return errors;
    }

    private validateTypeScript(file: GeneratedFile): ValidationIssue[] {
        const errors: ValidationIssue[] = [];
        const content = file.content;

        // Check for basic TypeScript issues
        if (content.includes('any') && !content.includes('// @ts-ignore')) {
            errors.push({
                message: 'Usage of "any" type detected - consider using more specific types',
                severity: 'warning' as const
            });
        }

        // Check for proper interface/type definitions
        if (file.path.endsWith('.tsx') && !content.includes('interface') && !content.includes('type ') && content.includes('props')) {
            errors.push({
                message: 'Component with props should have interface or type definition',
                severity: 'warning' as const
            });
        }

        return errors;
    }

    private validateReact(file: GeneratedFile): ValidationWarning[] {
        const warnings: ValidationWarning[] = [];
        const content = file.content;

        // Check for proper React imports
        if (content.includes('useState') && !content.includes('import { useState }') && !content.includes('import React')) {
            warnings.push({
                message: 'useState used without proper import',
                suggestion: 'Add import { useState } from "react"'
            });
        }

        // Check for client directive
        if ((content.includes('useState') || content.includes('useEffect') || content.includes('onClick')) &&
            !content.includes('"use client"') && !content.includes("'use client'")) {
            warnings.push({
                message: 'Client-side features detected without "use client" directive',
                suggestion: 'Add "use client" at the top of the file'
            });
        }

        return warnings;
    }

    private validateNextJS(file: GeneratedFile): ValidationWarning[] {
        const warnings: ValidationWarning[] = [];
        const content = file.content;
        const path = file.path;

        // Check for proper Next.js imports
        if (content.includes('Link') && !content.includes('next/link')) {
            warnings.push({
                message: 'Link component used without Next.js import',
                suggestion: 'Use import Link from "next/link"'
            });
        }

        // Check for proper page structure
        if (path.includes('page.tsx') && !content.includes('export default')) {
            warnings.push({
                message: 'Page component should have default export',
                suggestion: 'Add export default function PageName()'
            });
        }

        return warnings;
    }

    private validateCodeQuality(file: GeneratedFile): ValidationWarning[] {
        const warnings: ValidationWarning[] = [];
        const content = file.content;
        const lines = content.split('\n');

        // Check for long functions
        let functionLineCount = 0;
        let inFunction = false;

        lines.forEach((line, index) => {
            if (line.includes('function ') || line.includes('const ') && line.includes('=>')) {
                inFunction = true;
                functionLineCount = 0;
            }

            if (inFunction) {
                functionLineCount++;
                if (line.trim() === '}' && functionLineCount > 50) {
                    warnings.push({
                        line: index + 1,
                        message: 'Function is too long (>50 lines)',
                        suggestion: 'Consider breaking down into smaller functions'
                    });
                    inFunction = false;
                }
            }
        });

        // Check for console.log statements
        if (content.includes('console.log')) {
            warnings.push({
                message: 'console.log statements found',
                suggestion: 'Remove console.log statements before production'
            });
        }

        return warnings;
    }

    private calculateCodeMetrics(file: GeneratedFile): CodeMetrics {
        const content = file.content;
        const lines = content.split('\n').filter(line => line.trim() !== '');

        // Calculate cyclomatic complexity (simplified)
        const complexityKeywords = ['if', 'else', 'while', 'for', 'switch', 'case', '&&', '||', '?'];
        let complexity = 1; // Base complexity

        complexityKeywords.forEach(keyword => {
            complexity += (content.match(new RegExp(`\\b${keyword}\\b`, 'g')) || []).length;
        });

        // Calculate maintainability index (simplified)
        const linesOfCode = lines.length;
        const maintainability = Math.max(0, Math.min(100, 171 - 5.2 * Math.log(linesOfCode) - 0.23 * complexity));

        return {
            linesOfCode,
            complexity,
            maintainability
        };
    }

    private calculateFileQuality(errors: ValidationIssue[], warnings: ValidationWarning[], metrics: CodeMetrics): number {
        const errorPenalty = errors.length * 2;
        const warningPenalty = warnings.length * 0.5;
        const complexityPenalty = Math.max(0, (metrics.complexity - 10) * 0.1);

        return Math.max(0, Math.min(10, 10 - errorPenalty - warningPenalty - complexityPenalty));
    }

    private async validateDependencies(files: GeneratedFile[]): Promise<DependencyValidation[]> {
        // This would typically involve checking against npm registry
        // For now, return a simplified validation
        const dependencies = new Set<string>();

        files.forEach(file => {
            file.imports.forEach(imp => {
                if (!imp.startsWith('./') && !imp.startsWith('../') && !imp.startsWith('@/')) {
                    dependencies.add(imp);
                }
            });
        });

        return Array.from(dependencies).map(dep => ({
            package: dep,
            version: 'latest',
            isValid: true,
            hasVulnerabilities: false
        }));
    }

    private calculateQualityScore(fileValidations: FileValidation[]): number {
        if (fileValidations.length === 0) return 10;

        const averageScore = fileValidations.reduce((sum, validation) => sum + validation.qualityScore, 0) / fileValidations.length;
        return Math.round(averageScore * 10) / 10;
    }

    private assessSecurityRisk(files: GeneratedFile[]): 'low' | 'medium' | 'high' {
        const securityIssues = files.reduce((count, file) => {
            const content = file.content;
            let issues = 0;

            // Check for potential security issues
            if (content.includes('eval(')) issues++;
            if (content.includes('innerHTML')) issues++;
            if (content.includes('dangerouslySetInnerHTML')) issues++;
            if (content.includes('document.write')) issues++;

            return count + issues;
        }, 0);

        if (securityIssues === 0) return 'low';
        if (securityIssues <= 2) return 'medium';
        return 'high';
    }

    private generateSuggestions(fileValidations: FileValidation[], files: GeneratedFile[]): string[] {
        const suggestions: string[] = [];

        const avgComplexity = fileValidations.reduce((sum, val) => sum + val.metrics.complexity, 0) / fileValidations.length;
        if (avgComplexity > 15) {
            suggestions.push('Consider refactoring complex functions to improve maintainability');
        }

        const totalWarnings = fileValidations.reduce((sum, val) => sum + val.warnings.length, 0);
        if (totalWarnings > 5) {
            suggestions.push('Address code quality warnings to improve overall code health');
        }

        const hasTests = files.some(file => file.path.includes('.test.') || file.path.includes('.spec.'));
        if (!hasTests) {
            suggestions.push('Consider adding unit tests to improve code reliability');
        }

        return suggestions;
    }

    private resolveImportPath(fromPath: string, importPath: string): string {
        const fromDir = fromPath.split('/').slice(0, -1).join('/');

        if (importPath.startsWith('./')) {
            return `${fromDir}/${importPath.slice(2)}`;
        } else if (importPath.startsWith('../')) {
            const upLevels = importPath.match(/\.\.\//g)?.length || 0;
            const dirs = fromDir.split('/');
            const targetDir = dirs.slice(0, dirs.length - upLevels).join('/');
            const remainingPath = importPath.replace(/\.\.\//g, '');
            return `${targetDir}/${remainingPath}`;
        }

        return importPath;
    }
}
