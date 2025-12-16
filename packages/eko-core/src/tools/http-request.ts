/**
 * HTTP Request Tool - Execute web requests and interact with APIs
 *
 * Enables agents to make HTTP requests to REST APIs, fetch web resources,
 * and interact with external services. Supports all standard HTTP methods
 * with configurable headers, body, and timeout handling.
 *
 * ## Use Cases
 *
 * - **API Integration**: Call REST endpoints for data retrieval or updates
 * - **Web Scraping**: Fetch HTML content from websites
 * - **Service Communication**: Interact with microservices and external APIs
 * - **Data Synchronization**: Send/receive data between systems
 *
 * ## Features
 *
 * - **Full HTTP Support**: GET, POST, PUT, DELETE, PATCH methods
 * - **Flexible Headers**: Custom headers for authentication and content-type
 * - **Request Body**: Support for JSON, form data, and raw content
 * - **Timeout Control**: Configurable request timeouts with abort signaling
 * - **Response Formatting**: Pretty-printed JSON and comprehensive response details
 * - **Error Handling**: Graceful handling of network errors and timeouts
 *
 * ## Response Format
 *
 * Returns structured response including:
 * - HTTP status code and message
 * - Response headers as JSON
 * - Formatted response body (pretty-printed JSON when applicable)
 * - Error indicators for failed requests
 *
 * @example
 * ```typescript
 * // GET request to fetch user data
 * const result = await tool.execute({
 *   url: "https://api.example.com/users/123",
 *   method: "GET",
 *   headers: { "Authorization": "Bearer token123" }
 * });
 *
 * // POST request to create resource
 * const result = await tool.execute({
 *   url: "https://api.example.com/users",
 *   method: "POST",
 *   headers: { "Content-Type": "application/json" },
 *   body: JSON.stringify({ name: "John", email: "john@example.com" })
 * });
 * ```
 */

import { Tool, ToolResult } from '../types';

interface HttpRequestArgs {
    url: string;
    method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
    headers?: Record<string, string>;
    body?: string;
    timeout?: number;
}

export class HttpRequestTool implements Tool {
    readonly name = 'http_request';
    readonly description = 'Execute HTTP requests (GET, POST, PUT, DELETE, etc.) to interact with APIs or fetch resources.';
    readonly parameters = {
        type: 'object' as const,
        properties: {
            url: {
                type: 'string' as const,
                description: 'The URL to request',
            },
            method: {
                type: 'string' as const,
                enum: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
                description: 'HTTP method (default: GET)',
            },
            headers: {
                type: 'object' as const,
                description: 'HTTP headers',
                additionalProperties: { type: 'string' as const },
            },
            body: {
                type: 'string' as const,
                description: 'Request body (for POST/PUT/PATCH)',
            },
            timeout: {
                type: 'number' as const,
                description: 'Timeout in milliseconds (default: 10000)',
            },
        },
        required: ['url'],
    };

    /**
     * Executes an HTTP request with the specified parameters
     *
     * Makes the actual HTTP request using the native fetch API with timeout
     * and error handling. Formats the response for agent consumption.
     *
     * @param args - HTTP request parameters
     * @returns Tool result containing formatted response or error information
     *
     * @remarks
     * Request execution includes:
     * 1. **Timeout setup**: AbortController with configurable timeout
     * 2. **Request dispatch**: Native fetch with all specified parameters
     * 3. **Response processing**: Headers, status, and body extraction
     * 4. **Content formatting**: JSON pretty-printing when applicable
     * 5. **Error handling**: Network errors, timeouts, and HTTP errors
     */
    async execute(args: Record<string, unknown>): Promise<ToolResult> {
        const {
            url,
            method = 'GET',
            headers = {},
            body,
            timeout = 10000,
        } = args as unknown as HttpRequestArgs;

        try {
            // Set up timeout control with AbortController
            const controller = new AbortController();
            const id = setTimeout(() => controller.abort(), timeout);

            // Execute the HTTP request
            const response = await fetch(url, {
                method,
                headers: headers,
                body: body,
                signal: controller.signal,
            });

            clearTimeout(id);

            // Extract response content
            const responseText = await response.text();
            let content = responseText;

            // Attempt to pretty-print JSON responses for better readability
            try {
                const json = JSON.parse(responseText);
                content = JSON.stringify(json, null, 2);
            } catch (e) {
                // Response is not JSON, use as-is
            }

            // Format complete response for agent consumption
            const headersObj = Object.fromEntries(response.headers.entries());
            const output = `Status: ${response.status} ${response.statusText}\nHeaders: ${JSON.stringify(headersObj, null, 2)}\n\nBody:\n${content}`;

            return {
                content: [
                    {
                        type: 'text',
                        text: output,
                    },
                ],
                isError: !response.ok, // Mark as error for non-2xx status codes
                extInfo: {
                    status: response.status,
                    statusText: response.statusText,
                    headers: Object.fromEntries(response.headers.entries()),
                    body: content
                }
            };
        } catch (error: any) {
            // Handle different types of errors
            if (error.name === 'AbortError') {
                return {
                    content: [{ type: 'text', text: `Error: Request timed out after ${timeout}ms` }],
                    isError: true
                };
            }

            // Generic network or other errors
            return {
                content: [
                    {
                        type: 'text',
                        text: `Error: ${error.message}`,
                    },
                ],
                isError: true,
            };
        }
    }
}
