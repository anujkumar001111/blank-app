/**
 * Integration test for episodic memory full workflow
 * Tests the complete flow: task execution → episode recording → lesson recall → injection
 */

import { EpisodicMemory, InMemoryStorageProvider } from '../../src/memory/episodic';

describe('Episodic Memory Integration', () => {
    test('should auto-record episodes and inject lessons into planning', async () => {
        // Create in-memory episodic memory
        const memory = new EpisodicMemory({
            storage: new InMemoryStorageProvider(),
        });
        await memory.init();

        // Manually record a failed episode (simulating previous task)
        await memory.recordEpisode({
            goal: 'Login to example.com',
            actions: ['Browser', 'navigate', 'type'],
            outcome: 'Element not found: #login-button',
            success: false,
            errorType: 'ElementNotFound',
        });

        // Verify episode was recorded
        const stats = memory.getStats();
        expect(stats.total).toBe(1);
        expect(stats.failures).toBe(1);

        // Test recall for similar task
        const relevantEpisodes = await memory.recallRelevant('Login to website');
        expect(relevantEpisodes.length).toBeGreaterThan(0);
        expect(relevantEpisodes[0].goal).toContain('Login');
        expect(relevantEpisodes[0].success).toBe(false);

        // Test context injection
        const injection = memory.buildContextInjection(relevantEpisodes);
        expect(injection).toContain('Lessons from Past Experience');
        expect(injection).toContain('ElementNotFound');
        expect(injection).toContain('Previous Failures to Avoid');
    });

    test('should handle successful episodes for best practices', async () => {
        const memory = new EpisodicMemory({
            storage: new InMemoryStorageProvider(),
        });
        await memory.init();

        // Record successful episode
        await memory.recordEpisode({
            goal: 'Search for AI news on Google',
            actions: ['Browser', 'navigate', 'type', 'click'],
            outcome: 'Successfully found 10 articles',
            success: true,
        });

        const stats = memory.getStats();
        expect(stats.successes).toBe(1);

        // Recall for similar task
        const episodes = await memory.recallRelevant('Search for news');
        expect(episodes.length).toBe(1);
        expect(episodes[0].success).toBe(true);

        // Injection should include successful approaches
        const injection = memory.buildContextInjection(episodes);
        expect(injection).toContain('Successful Approaches');
        expect(injection).toContain('Browser');
    });

    test('should prioritize failures with lessons over successes', async () => {
        const memory = new EpisodicMemory({
            storage: new InMemoryStorageProvider(),
        });
        await memory.init();

        // Add both success and failure
        await memory.recordEpisode({
            goal: 'Submit form successfully',
            actions: ['Browser'],
            outcome: 'Form submitted',
            success: true,
        });

        await memory.recordEpisode({
            goal: 'Submit contact form',
            actions: ['Browser'],
            outcome: 'Validation error',
            success: false,
            errorType: 'ValidationError',
            lesson: 'Always check required fields before submission',
        });

        const episodes = await memory.recallRelevant('Submit form');

        // Failure with lesson should come first
        expect(episodes[0].success).toBe(false);
        expect(episodes[0].lesson).toBeDefined();
    });

    test('should handle empty recall gracefully', async () => {
        const memory = new EpisodicMemory({
            storage: new InMemoryStorageProvider(),
        });
        await memory.init();

        const episodes = await memory.recallRelevant('Completely unrelated task xyz123');
        expect(episodes.length).toBe(0);

        const injection = memory.buildContextInjection(episodes);
        expect(injection).toBe('');
    });

    test('should evict old episodes when limit is reached', async () => {
        const memory = new EpisodicMemory({
            storage: new InMemoryStorageProvider(),
            maxEpisodes: 3,
        });
        await memory.init();

        // Add 5 episodes
        for (let i = 1; i <= 5; i++) {
            await memory.recordEpisode({
                goal: `Task ${i}`,
                actions: ['action'],
                outcome: 'done',
                success: true,
            });
        }

        const stats = memory.getStats();
        expect(stats.total).toBe(3);

        // Verify oldest were evicted (should have Task 3, 4, 5)
        const episodes = memory.export();
        expect(episodes[0].goal).toBe('Task 3');
        expect(episodes[2].goal).toBe('Task 5');
    });
});
