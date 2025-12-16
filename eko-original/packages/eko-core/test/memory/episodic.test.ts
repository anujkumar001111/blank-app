/**
 * Tests for EpisodicMemory
 * Testing episodic memory for agent learning
 */

import { EpisodicMemory, InMemoryStorageProvider } from '../../src/memory/episodic';

describe('EpisodicMemory', () => {
    let memory: EpisodicMemory;

    beforeEach(async () => {
        memory = new EpisodicMemory({
            storage: new InMemoryStorageProvider(),
            maxEpisodes: 100,
        });
        await memory.init();
    });

    describe('Initialization', () => {
        test('should initialize with empty episodes', () => {
            const stats = memory.getStats();
            expect(stats.total).toBe(0);
            expect(stats.successes).toBe(0);
            expect(stats.failures).toBe(0);
        });

        test('should throw if not initialized', async () => {
            const uninitMemory = new EpisodicMemory();
            expect(() => uninitMemory.getStats()).toThrow('not initialized');
        });
    });

    describe('Recording Episodes', () => {
        test('should record successful episode', async () => {
            const episode = await memory.recordEpisode({
                goal: 'Search for AI news',
                actions: ['navigate', 'type', 'click'],
                outcome: 'Found 10 headlines',
                success: true,
            });

            expect(episode.id).toMatch(/^ep-/);
            expect(episode.timestamp).toBeGreaterThan(0);
            expect(episode.success).toBe(true);

            const stats = memory.getStats();
            expect(stats.total).toBe(1);
            expect(stats.successes).toBe(1);
        });

        test('should record failed episode with auto-generated lesson', async () => {
            const episode = await memory.recordEpisode({
                goal: 'Submit the form',
                actions: ['click', 'type'],
                outcome: 'Element not found: #submit-button',
                success: false,
                errorType: 'ElementNotFound',
            });

            expect(episode.success).toBe(false);
            expect(episode.lesson).toBeDefined();
            expect(episode.lesson).toContain('ElementNotFound');

            const stats = memory.getStats();
            expect(stats.failures).toBe(1);
        });

        test('should evict old episodes when over limit', async () => {
            const smallMemory = new EpisodicMemory({
                storage: new InMemoryStorageProvider(),
                maxEpisodes: 3,
            });
            await smallMemory.init();

            // Add 5 episodes
            for (let i = 1; i <= 5; i++) {
                await smallMemory.recordEpisode({
                    goal: `Task ${i}`,
                    actions: ['action'],
                    outcome: 'done',
                    success: true,
                });
            }

            const stats = smallMemory.getStats();
            expect(stats.total).toBe(3);

            // Oldest should be evicted
            const episodes = smallMemory.export();
            expect(episodes[0].goal).toBe('Task 3');
        });
    });

    describe('Recalling Episodes', () => {
        beforeEach(async () => {
            // Add diverse episodes
            await memory.recordEpisode({
                goal: 'Search for tech news on Google',
                actions: ['navigate', 'type', 'click'],
                outcome: 'Found headlines',
                success: true,
            });
            await memory.recordEpisode({
                goal: 'Submit contact form on website',
                actions: ['navigate', 'fill', 'submit'],
                outcome: 'Form error',
                success: false,
                errorType: 'ValidationError',
            });
            await memory.recordEpisode({
                goal: 'Search for AI news',
                actions: ['navigate', 'type', 'click'],
                outcome: 'Found AI articles',
                success: true,
            });
        });

        test('should recall relevant episodes by keywords', async () => {
            const relevant = await memory.recallRelevant('Search for sports news');

            // Should match episodes with "search" and "news"
            expect(relevant.length).toBeGreaterThan(0);
            expect(relevant[0].goal).toContain('news');
        });

        test('should prioritize failures with lessons', async () => {
            // Add a failure related to search
            await memory.recordEpisode({
                goal: 'Search for news failed due to timeout',
                actions: ['navigate', 'wait'],
                outcome: 'Timeout after 30s',
                success: false,
                errorType: 'Timeout',
                lesson: 'Use shorter timeout or retry logic',
            });

            const relevant = await memory.recallRelevant('Search for breaking news');

            // Failure with lesson should be prioritized
            expect(relevant[0].success).toBe(false);
            expect(relevant[0].lesson).toBeDefined();
        });

        test('should return empty for unrelated query', async () => {
            const relevant = await memory.recallRelevant('xyz123abc');
            expect(relevant.length).toBe(0);
        });
    });

    describe('Context Injection', () => {
        test('should build context injection from episodes', async () => {
            await memory.recordEpisode({
                goal: 'Login to website',
                actions: ['navigate', 'type', 'click'],
                outcome: 'Invalid credentials',
                success: false,
                errorType: 'AuthError',
                lesson: 'Verify credentials before attempting login',
            });
            await memory.recordEpisode({
                goal: 'Successful login example',
                actions: ['navigate', 'type', 'click', 'verify'],
                outcome: 'Logged in',
                success: true,
            });

            const episodes = memory.export();
            const injection = memory.buildContextInjection(episodes);

            expect(injection).toContain('Lessons from Past Experience');
            expect(injection).toContain('Previous Failures to Avoid');
            expect(injection).toContain('AuthError');
            expect(injection).toContain('Successful Approaches');
        });

        test('should return empty string for no episodes', () => {
            const injection = memory.buildContextInjection([]);
            expect(injection).toBe('');
        });
    });

    describe('Clear and Export', () => {
        test('should clear all episodes', async () => {
            await memory.recordEpisode({
                goal: 'Test',
                actions: ['test'],
                outcome: 'done',
                success: true,
            });

            expect(memory.getStats().total).toBe(1);

            await memory.clear();

            expect(memory.getStats().total).toBe(0);
        });

        test('should export all episodes', async () => {
            await memory.recordEpisode({
                goal: 'Task 1',
                actions: ['a'],
                outcome: 'ok',
                success: true,
            });
            await memory.recordEpisode({
                goal: 'Task 2',
                actions: ['b'],
                outcome: 'ok',
                success: true,
            });

            const exported = memory.export();
            expect(exported.length).toBe(2);
            expect(exported[0].goal).toBe('Task 1');
            expect(exported[1].goal).toBe('Task 2');
        });
    });

    describe('Failure Type Queries', () => {
        test('should get failures by error type', async () => {
            await memory.recordEpisode({
                goal: 'Task 1',
                actions: ['a'],
                outcome: 'timeout',
                success: false,
                errorType: 'Timeout',
            });
            await memory.recordEpisode({
                goal: 'Task 2',
                actions: ['b'],
                outcome: 'not found',
                success: false,
                errorType: 'ElementNotFound',
            });
            await memory.recordEpisode({
                goal: 'Task 3',
                actions: ['c'],
                outcome: 'timeout again',
                success: false,
                errorType: 'Timeout',
            });

            const timeouts = memory.getFailuresByType('Timeout');
            expect(timeouts.length).toBe(2);
            expect(timeouts.every(e => e.errorType === 'Timeout')).toBe(true);
        });
    });
});
