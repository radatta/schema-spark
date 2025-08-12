/**
 * Simple chunking utility for streaming code generation
 * Sends updates after every N newlines
 */

export interface ChunkingOptions {
    linesPerChunk: number;    // Send update after this many newlines
}

export interface ChunkResult {
    content: string;
    shouldSend: boolean;
    isComplete: boolean;
}

export class SmartChunker {
    private buffer: string = '';
    private options: ChunkingOptions;

    constructor(options: Partial<ChunkingOptions> = {}) {
        this.options = {
            linesPerChunk: 2, // Send update after every 2 newlines
            ...options
        };
    }

    /**
     * Add content to the buffer and determine if a chunk should be sent
     */
    addContent(content: string): ChunkResult {
        this.buffer += content;

        const shouldSend = this.shouldSendChunk();

        if (shouldSend) {
            const chunkContent = this.extractChunk();
            return {
                content: chunkContent,
                shouldSend: true,
                isComplete: false
            };
        }

        return {
            content: '',
            shouldSend: false,
            isComplete: false
        };
    }

    /**
     * Get any remaining content in the buffer (for completion)
     */
    getRemaining(): ChunkResult {
        if (this.buffer.trim().length === 0) {
            return {
                content: '',
                shouldSend: false,
                isComplete: true
            };
        }

        const content = this.buffer;
        this.buffer = '';
        return {
            content,
            shouldSend: true,
            isComplete: true
        };
    }

    /**
     * Get current accumulated content without sending
     */
    getCurrentContent(): string {
        return this.buffer;
    }

    /**
     * Reset the chunker state
     */
    reset(): void {
        this.buffer = '';
    }

    private shouldSendChunk(): boolean {
        // Count newlines in the buffer
        const newlineCount = (this.buffer.match(/\n/g) || []).length;

        // Send after every N newlines
        return newlineCount >= this.options.linesPerChunk;
    }

    private extractChunk(): string {
        const lines = this.buffer.split('\n');

        // Take the first N lines (plus any partial line after)
        const linesToTake = this.options.linesPerChunk;

        if (lines.length <= linesToTake) {
            // Take everything if we don't have enough lines
            const chunk = this.buffer;
            this.buffer = '';
            return chunk;
        }

        // Take exactly N complete lines
        const chunkLines = lines.slice(0, linesToTake);
        const remainingLines = lines.slice(linesToTake);

        const chunk = chunkLines.join('\n') + '\n'; // Add back the newline
        this.buffer = remainingLines.join('\n');

        return chunk;
    }
}
