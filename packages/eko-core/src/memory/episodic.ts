/**
 * EpisodicMemory - Persistent memory for task experiences
 * 
 * Platform-agnostic implementation using a StorageProvider interface.
 * Stores (Goal, Plan, Outcome, Success/Failure) tuples persistently.
 * Enables agents to learn from past mistakes and successes.
 * 
 * @example
 * ```ts
 * // In Node.js:
 * import { FileStorageProvider } from '@eko-ai/eko-nodejs';
 * const memory = new EpisodicMemory({ 
 *   storage: new FileStorageProvider('./agent-memory') 
 * });
 * 
 * // After task completion:
 * await memory.recordEpisode({
 *   goal: "Search for AI news",
 *   plan: "Navigate to news site, search, extract headlines",
 *   actions: ["navigate", "type", "click"],
 *   outcome: "Successfully extracted 10 headlines",
 *   success: true,
 * });
 * 
 * // Before starting a new task:
 * const lessons = await memory.recallRelevant("Search for tech news");
 * ```
 */

/**
 * A single episode of task execution
 */
export interface Episode {
    id: string;
    timestamp: number;
    goal: string;
    plan?: string;
    actions: string[];
    outcome: string;
    success: boolean;
    errorType?: string;
    lesson?: string;
    embedding?: number[]; // For semantic search
    metadata?: Record<string, unknown>;
}

/**
 * Embedding provider interface for semantic search
 */
export interface EmbeddingProvider {
    /** Generate embedding vector for text */
    embed(text: string): Promise<number[]>;
}

/**
 * Storage provider interface for platform-agnostic persistence
 */
export interface EpisodicStorageProvider {
    /** Read episodes from storage */
    read(): Promise<Episode[]>;
    /** Write episodes to storage */
    write(episodes: Episode[]): Promise<void>;
    /** Check if storage exists/is initialized */
    exists(): Promise<boolean>;
}

/**
 * In-memory storage provider (default, no persistence)
 */
export class InMemoryStorageProvider implements EpisodicStorageProvider {
    private episodes: Episode[] = [];

    async read(): Promise<Episode[]> {
        return [...this.episodes];
    }

    async write(episodes: Episode[]): Promise<void> {
        this.episodes = [...episodes];
    }

    async exists(): Promise<boolean> {
        return true;
    }
}

/**
 * Configuration for EpisodicMemory
 */
export interface EpisodicMemoryConfig {
    /** Storage provider for persistence */
    storage?: EpisodicStorageProvider;
    /** Maximum episodes to keep (oldest evicted first) */
    maxEpisodes?: number;
    /** Optional embedding provider for semantic search */
    embeddingProvider?: EmbeddingProvider;
}

/**
 * Persistent episodic memory for agent learning
 */
export class EpisodicMemory {
    private config: EpisodicMemoryConfig & { storage: EpisodicStorageProvider; maxEpisodes: number };
    private episodes: Episode[] = [];
    private initialized = false;

    constructor(config: EpisodicMemoryConfig = {}) {
        this.config = {
            storage: config.storage ?? new InMemoryStorageProvider(),
            maxEpisodes: config.maxEpisodes ?? 1000,
            embeddingProvider: config.embeddingProvider,
        };
    }

    /**
     * Initialize memory - load from storage
     */
    async init(): Promise<void> {
        if (this.initialized) return;

        if (await this.config.storage.exists()) {
            try {
                this.episodes = await this.config.storage.read();
            } catch (e) {
                console.warn('Failed to load episodic memory, starting fresh:', e);
                this.episodes = [];
            }
        }

        this.initialized = true;
    }

    /**
     * Record a new episode after task execution
     */
    async recordEpisode(episode: Omit<Episode, 'id' | 'timestamp' | 'embedding'>): Promise<Episode> {
        this.ensureInitialized();

        const newEpisode: Episode = {
            id: this.generateId(),
            timestamp: Date.now(),
            ...episode,
        };

        // Auto-generate lesson if not provided and task failed
        if (!newEpisode.lesson && !newEpisode.success) {
            newEpisode.lesson = this.generateLesson(newEpisode);
        }

        // Generate embedding if provider is available
        if (this.config.embeddingProvider && !newEpisode.embedding) {
            try {
                newEpisode.embedding = await this.config.embeddingProvider.embed(newEpisode.goal);
            } catch (e) {
                console.warn('Failed to generate embedding for episode:', e);
                // Continue without embedding - keyword search will still work
            }
        }

        this.episodes.push(newEpisode);

        // Evict old episodes if over limit
        if (this.episodes.length > this.config.maxEpisodes) {
            this.episodes = this.episodes.slice(-this.config.maxEpisodes);
        }

        await this.persist();
        return newEpisode;
    }

    /**
     * Recall relevant past episodes for a given goal
     * Uses hybrid search: keyword matching + semantic similarity (if embeddings available)
     */
    async recallRelevant(goal: string, limit: number = 5): Promise<Episode[]> {
        this.ensureInitialized();

        // Generate embedding for query if provider available
        let queryEmbedding: number[] | undefined;
        if (this.config.embeddingProvider) {
            try {
                queryEmbedding = await this.config.embeddingProvider.embed(goal);
            } catch (e) {
                console.warn('Failed to generate query embedding:', e);
            }
        }

        const keywords = this.extractKeywords(goal);

        const scored = this.episodes.map(episode => {
            // Keyword-based score (0-1)
            const episodeKeywords = this.extractKeywords(episode.goal);
            const overlap = keywords.filter(k => episodeKeywords.includes(k)).length;
            const keywordScore = overlap / Math.max(keywords.length, 1);

            // Semantic similarity score (0-1)
            let semanticScore = 0;
            if (queryEmbedding && episode.embedding) {
                semanticScore = this.cosineSimilarity(queryEmbedding, episode.embedding);
            }

            // Hybrid score: 40% keyword + 60% semantic (if available)
            const finalScore = queryEmbedding && episode.embedding
                ? (keywordScore * 0.4 + semanticScore * 0.6)
                : keywordScore;

            return { episode, score: finalScore, keywordScore, semanticScore };
        });

        // Sort by relevance, prioritize failures with lessons
        scored.sort((a, b) => {
            // Prioritize failures with lessons if scores are close (within 0.1)
            if (Math.abs(a.score - b.score) < 0.1) {
                if (!a.episode.success && a.episode.lesson &&
                    (b.episode.success || !b.episode.lesson)) {
                    return -1;
                }
                if (!b.episode.success && b.episode.lesson &&
                    (a.episode.success || !a.episode.lesson)) {
                    return 1;
                }
            }
            return b.score - a.score;
        });

        return scored
            .filter(s => s.score > 0.1)
            .slice(0, limit)
            .map(s => s.episode);
    }

    /**
     * Get all failures for a specific error type
     */
    getFailuresByType(errorType: string): Episode[] {
        this.ensureInitialized();
        return this.episodes.filter(
            e => !e.success && e.errorType === errorType
        );
    }

    /**
     * Build context injection string from relevant episodes
     * This gets added to the agent's system prompt
     */
    buildContextInjection(episodes: Episode[]): string {
        if (episodes.length === 0) return '';

        const failures = episodes.filter(e => !e.success && e.lesson);
        const successes = episodes.filter(e => e.success);

        let injection = '\n\n## Lessons from Past Experience\n';

        if (failures.length > 0) {
            injection += '\n### Previous Failures to Avoid:\n';
            for (const ep of failures.slice(0, 3)) {
                injection += `- Goal: "${ep.goal.slice(0, 100)}"\n`;
                injection += `  Error: ${ep.errorType || 'Unknown'}\n`;
                injection += `  Lesson: ${ep.lesson}\n\n`;
            }
        }

        if (successes.length > 0) {
            injection += '\n### Successful Approaches:\n';
            for (const ep of successes.slice(0, 2)) {
                injection += `- Goal: "${ep.goal.slice(0, 100)}"\n`;
                injection += `  Approach: ${ep.actions.slice(0, 5).join(' → ')}\n\n`;
            }
        }

        return injection;
    }

    /**
     * Get statistics about stored episodes
     */
    getStats(): { total: number; successes: number; failures: number; oldestTimestamp: number | null } {
        this.ensureInitialized();
        return {
            total: this.episodes.length,
            successes: this.episodes.filter(e => e.success).length,
            failures: this.episodes.filter(e => !e.success).length,
            oldestTimestamp: this.episodes.length > 0 ? this.episodes[0].timestamp : null,
        };
    }

    /**
     * Clear all episodes
     */
    async clear(): Promise<void> {
        this.episodes = [];
        await this.persist();
    }

    /**
     * Export all episodes
     */
    export(): Episode[] {
        this.ensureInitialized();
        return [...this.episodes];
    }

    // ============== Private Methods ==============

    private ensureInitialized(): void {
        if (!this.initialized) {
            throw new Error('EpisodicMemory not initialized. Call init() first.');
        }
    }

    private async persist(): Promise<void> {
        await this.config.storage.write(this.episodes);
    }

    private generateId(): string {
        return `ep-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }

    private extractKeywords(text: string): string[] {
        const stopWords = new Set([
            'the', 'a', 'an', 'to', 'and', 'or', 'is', 'are', 'was', 'were',
            'in', 'on', 'at', 'for', 'of', 'with', 'by', 'from', 'as', 'it',
            'this', 'that', 'be', 'have', 'has', 'had', 'do', 'does', 'did',
            'will', 'would', 'could', 'should', 'can', 'may', 'might',
        ]);

        return text
            .toLowerCase()
            .replace(/[^\w\s]/g, '')
            .split(/\s+/)
            .filter(word => word.length > 2 && !stopWords.has(word));
    }

    private generateLesson(episode: Episode): string {
        const goalStart = episode.goal.slice(0, 50);
        const outcomeStart = episode.outcome.slice(0, 100);

        if (episode.errorType) {
            return `When attempting "${goalStart}...", avoid ${episode.errorType}. ` +
                `The previous attempt resulted in: ${outcomeStart}`;
        }

        return `Previous attempt at "${goalStart}..." failed with: ${outcomeStart}. ` +
            `Consider a different approach.`;
    }

    /**
     * Calculate cosine similarity between two embedding vectors
     * Returns value between -1 and 1 (1 = identical, 0 = orthogonal, -1 = opposite)
     */
    private cosineSimilarity(a: number[], b: number[]): number {
        if (a.length !== b.length) return 0;

        let dotProduct = 0;
        let normA = 0;
        let normB = 0;

        for (let i = 0; i < a.length; i++) {
            dotProduct += a[i] * b[i];
            normA += a[i] * a[i];
            normB += b[i] * b[i];
        }

        const denominator = Math.sqrt(normA) * Math.sqrt(normB);
        return denominator === 0 ? 0 : dotProduct / denominator;
    }
}
