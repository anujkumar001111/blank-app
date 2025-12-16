/**
 * OpenAI embeddings provider for semantic search
 * Uses OpenAI's text-embedding-3-small model
 */

import { embed } from 'ai';
import { openai } from '@ai-sdk/openai';
import type { EmbeddingProvider } from './episodic';

export class OpenAIEmbeddingProvider implements EmbeddingProvider {
    private model: string;
    private cache: Map<string, number[]> = new Map();

    constructor(model: string = 'text-embedding-3-small') {
        this.model = model;
    }

    async embed(text: string): Promise<number[]> {
        // Check cache first
        if (this.cache.has(text)) {
            const cached = this.cache.get(text)!;
            // Move to end (most recently used)
            this.cache.delete(text);
            this.cache.set(text, cached);
            return cached;
        }

        try {
            const { embedding } = await embed({
                model: openai.embedding(this.model) as any,
                value: text,
            });

            // Add to cache
            this.cache.set(text, embedding);

            // Evict least recently used if over limit (first entry in Map)
            if (this.cache.size > 1000) {
                const firstKey = this.cache.keys().next().value;
                if (firstKey !== undefined) {
                    this.cache.delete(firstKey);
                }
            }

            return embedding;
        } catch (error) {
            throw new Error(`Failed to generate embedding: ${error}`);
        }
    }

    /**
     * Clear the embedding cache
     */
    clearCache(): void {
        this.cache.clear();
    }

    /**
     * Get cache statistics
     */
    getCacheStats(): { size: number; maxSize: number } {
        return {
            size: this.cache.size,
            maxSize: 1000,
        };
    }
}
