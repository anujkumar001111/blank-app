/**
 * Jest setup file to polyfill web streams for Node.js test environment
 *
 * The eventsource-parser package uses TransformStream which is available
 * in Node.js but not exposed as a global in Jest's test environment.
 */

import { TransformStream, ReadableStream, WritableStream } from 'stream/web';

// Polyfill web streams globals for Jest
if (typeof globalThis.TransformStream === 'undefined') {
  (globalThis as any).TransformStream = TransformStream;
}

if (typeof globalThis.ReadableStream === 'undefined') {
  (globalThis as any).ReadableStream = ReadableStream;
}

if (typeof globalThis.WritableStream === 'undefined') {
  (globalThis as any).WritableStream = WritableStream;
}
