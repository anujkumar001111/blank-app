/**
 * Integration test for FileStorageProvider persistence
 */

import { EpisodicMemory } from '@eko-ai/eko';
import { FileStorageProvider } from '../../src/memory/file-storage';
import { existsSync, rmSync } from 'fs';

const TEST_STORAGE_PATH = './test-memory-temp';

describe('FileStorageProvider Persistence', () => {
    beforeEach(() => {
        // Clean up test directory
        if (existsSync(TEST_STORAGE_PATH)) {
            rmSync(TEST_STORAGE_PATH, { recursive: true });
        }
    });

    afterEach(() => {
        // Clean up after tests
        if (existsSync(TEST_STORAGE_PATH)) {
            rmSync(TEST_STORAGE_PATH, { recursive: true });
        }
    });

    test('should persist episodes across memory instances', async () => {
        // Create first memory instance and record episodes
        const memory1 = new EpisodicMemory({
            storage: new FileStorageProvider(TEST_STORAGE_PATH),
        });
        await memory1.init();

        await memory1.recordEpisode({
            goal: 'Test task 1',
            actions: ['action1'],
            outcome: 'success',
            success: true,
        });

        await memory1.recordEpisode({
            goal: 'Test task 2',
            actions: ['action2'],
            outcome: 'failed',
            success: false,
            errorType: 'TestError',
        });

        const stats1 = memory1.getStats();
        expect(stats1.total).toBe(2);

        // Create second memory instance (simulating process restart)
        const memory2 = new EpisodicMemory({
            storage: new FileStorageProvider(TEST_STORAGE_PATH),
        });
        await memory2.init();

        // Should load persisted episodes
        const stats2 = memory2.getStats();
        expect(stats2.total).toBe(2);
        expect(stats2.successes).toBe(1);
        expect(stats2.failures).toBe(1);

        const exported = memory2.export();
        expect(exported[0].goal).toBe('Test task 1');
        expect(exported[1].goal).toBe('Test task 2');
    });

    test('should handle non-existent storage path', async () => {
        const memory = new EpisodicMemory({
            storage: new FileStorageProvider(TEST_STORAGE_PATH),
        });
        await memory.init();

        // Should start empty when no file exists
        expect(memory.getStats().total).toBe(0);
    });
});
