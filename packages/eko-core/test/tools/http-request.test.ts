/**
 * Tests for HttpRequestTool
 * Testing HTTP request tool structure and error handling
 * Note: Network-dependent tests should be in e2e tests, not unit tests
 */

import { HttpRequestTool } from '../../src/tools/http-request';

describe('HttpRequestTool', () => {
    let tool: HttpRequestTool;

    beforeEach(() => {
        tool = new HttpRequestTool();
    });

    describe('Tool Properties', () => {
        test('should have correct name', () => {
            expect(tool.name).toBe('http_request');
        });

        test('should have description mentioning HTTP', () => {
            expect(tool.description).toContain('HTTP');
        });

        test('should have correct parameter schema', () => {
            expect(tool.parameters.type).toBe('object');
            expect(tool.parameters.properties.url).toBeDefined();
            expect(tool.parameters.properties.url.type).toBe('string');
            expect(tool.parameters.properties.method).toBeDefined();
            expect(tool.parameters.properties.method.enum).toContain('GET');
            expect(tool.parameters.properties.method.enum).toContain('POST');
            expect(tool.parameters.properties.method.enum).toContain('PUT');
            expect(tool.parameters.properties.method.enum).toContain('DELETE');
            expect(tool.parameters.properties.method.enum).toContain('PATCH');
            expect(tool.parameters.properties.headers).toBeDefined();
            expect(tool.parameters.properties.body).toBeDefined();
            expect(tool.parameters.properties.timeout).toBeDefined();
            expect(tool.parameters.required).toContain('url');
        });
    });

    describe('Error Handling', () => {
        test('should handle invalid URL gracefully', async () => {
            const result = await tool.execute({
                url: 'not-a-valid-url',
            });

            expect(result.isError).toBe(true);
            expect(result.content).toHaveLength(1);
            const content = result.content[0];
            expect(content.type).toBe('text');
            if (content.type === 'text') {
                expect(content.text).toContain('Error');
            }
        });

        test('should handle missing protocol gracefully', async () => {
            const result = await tool.execute({
                url: 'example.com', // Missing https://
            });

            expect(result.isError).toBe(true);
            const content = result.content[0];
            if (content.type === 'text') {
                expect(content.text).toContain('Error');
            }
        });
    });

    describe('Timeout Configuration', () => {
        test('should handle timeout for unreachable hosts', async () => {
            // Use a non-routable IP to force timeout
            const result = await tool.execute({
                url: 'http://10.255.255.1/', // Non-routable
                timeout: 500, // Very short timeout
            });

            expect(result.isError).toBe(true);
            // Either timeout or connection error
            // Either timeout or connection error
            const content = result.content[0];
            if (content.type === 'text') {
                expect(content.text).toMatch(/Error|timed out/i);
            }
        }, 5000);
    });

    describe('Response Formatting', () => {
        // This test uses a local mock or validates format expectations
        test('should have correct ToolResult structure on error', async () => {
            const result = await tool.execute({
                url: 'invalid://url',
            });

            // Verify the result structure is valid ToolResult
            expect(result).toHaveProperty('content');
            expect(result).toHaveProperty('isError');
            expect(Array.isArray(result.content)).toBe(true);
            expect(result.content[0]).toHaveProperty('type');
        });
    });

    describe('Method Defaults', () => {
        test('execute should not throw when only URL provided', async () => {
            // Even with an invalid URL, it should handle gracefully
            await expect(
                tool.execute({ url: 'https://invalid-domain-xyz123.test' })
            ).resolves.toHaveProperty('isError');
        });
    });
});
