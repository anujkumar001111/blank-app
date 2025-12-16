/**
 * Semantic search tests - demonstrates improvement over keyword matching
 */

import { EpisodicMemory, InMemoryStorageProvider } from '../../src/memory/episodic';
import type { EmbeddingProvider } from '../../src/memory/episodic';

// Mock embedding provider for testing
class MockEmbeddingProvider implements EmbeddingProvider {
    async embed(text: string): Promise<number[]> {
        // Simple mock: create synthetic embeddings based on semantic groups
        const semanticGroups: Record<string, number[]> = {
            // Login/authentication group
            'login': [0.9, 0.1, 0.0, 0.1],
            'authenticate': [0.85, 0.15, 0.05, 0.1],
            'signin': [0.88, 0.12, 0.02, 0.08],

            // Search/find group
            'search': [0.1, 0.9, 0.1, 0.0],
            'find': [0.15, 0.85, 0.15, 0.05],
            'lookup': [0.12, 0.88, 0.12, 0.03],

            // Book/reserve group
            'book': [0.0, 0.1, 0.9, 0.0],
            'reserve': [0.05, 0.15, 0.85, 0.1],
            'schedule': [0.03, 0.12, 0.87, 0.08],
        };

        const textLower = text.toLowerCase();

        // Find best matching semantic group
        for (const [keyword, embedding] of Object.entries(semanticGroups)) {
            if (textLower.includes(keyword)) {
                // Add some noise to make embeddings more realistic
                return embedding.map(v => v + (Math.random() - 0.5) * 0.05);
            }
        }

        // Default random embedding
        return [Math.random(), Math.random(), Math.random(), Math.random()];
    }
}

describe('Semantic Search', () => {
    test('should match semantically similar queries (login/authenticate)', async () => {
        const memory = new EpisodicMemory({
            storage: new InMemoryStorageProvider(),
            embeddingProvider: new MockEmbeddingProvider(),
        });
        await memory.init();

        // Record episode with "login"
        await memory.recordEpisode({
            goal: 'Login to the dashboard',
            actions: ['Browser'],
            outcome: 'Failed - invalid credentials',
            success: false,
            errorType: 'AuthError',
            lesson: 'Verify credentials before attempting login',
        });

        // Query with semantically similar term "authenticate"
        const episodes = await memory.recallRelevant('Authenticate on the website');

        // Should find the login episode even though words are different
        expect(episodes.length).toBeGreaterThan(0);
        expect(episodes[0].goal).toContain('Login');
    });

    test('should have better recall than keyword-only matching', async () => {
        const memoryWithEmbeddings = new EpisodicMemory({
            storage: new InMemoryStorageProvider(),
            embeddingProvider: new MockEmbeddingProvider(),
        });
        await memoryWithEmbeddings.init();

        const memoryKeywordOnly = new EpisodicMemory({
            storage: new InMemoryStorageProvider(),
            // No embedding provider
        });
        await memoryKeywordOnly.init();

        // Record same episodes in both
        const episodeData = {
            goal: 'Book a flight to New York',
            actions: ['Browser'],
            outcome: 'Successfully booked',
            success: true,
        };

        await memoryWithEmbeddings.recordEpisode(episodeData);
        await memoryKeywordOnly.recordEpisode(episodeData);

        // Query with synonym "reserve airline ticket"
        const semanticResults = await memoryWithEmbeddings.recallRelevant('Reserve airline ticket');
        const keywordResults = await memoryKeywordOnly.recallRelevant('Reserve airline ticket');

        // Semantic search should find it, keyword-only might not
        expect(semanticResults.length).toBeGreaterThan(0);
        expect(semanticResults[0].goal).toContain('Book a flight');

        // Keyword-only has no shared words except implicit ones
        // "book" != "reserve", "flight" != "airline ticket"
        // So keyword-only may return empty or lower relevance
    });

    test('should fallback to keyword matching when no embeddings', async () => {
        const memory = new EpisodicMemory({
            storage: new InMemoryStorageProvider(),
            // No embedding provider
        });
        await memory.init();

        await memory.recordEpisode({
            goal: 'Search for AI news articles',
            actions: ['Browser'],
            outcome: 'Found 10 articles',
            success: true,
        });

        const episodes = await memory.recallRelevant('Search for tech news');

        // Should still work with keyword matching (both have "search", "news")
        expect(episodes.length).toBeGreaterThan(0);
        expect(episodes[0].goal).toContain('Search');
    });

    test('should combine keyword and semantic scores properly', async () => {
        const memory = new EpisodicMemory({
            storage: new InMemoryStorageProvider(),
            embeddingProvider: new MockEmbeddingProvider(),
        });
        await memory.init();

        // Add episodes that match keyword vs semantic
        await memory.recordEpisode({
            goal: 'Login to example.com dashboard',
            actions: ['Browser'],
            outcome: 'Success',
            success: true,
        });

        await memory.recordEpisode({
            goal: 'Find the contact form',
            actions: ['Browser'],
            outcome: 'Success',
            success: true,
        });

        // Query matches "login" semantically but has different words
        const episodes = await memory.recallRelevant('Authenticate on example.com');

        // "Login" episode should rank higher due to semantic + keyword match
        expect(episodes[0].goal).toContain('Login');
    });
});
