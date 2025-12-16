/**
 * Jest setup file to polyfill web streams and DOM for Node.js test environment
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

// Mock browser globals for testing
if (typeof globalThis.window === 'undefined') {
  (globalThis as any).window = {
    innerWidth: 1024,
    innerHeight: 768,
    scrollX: 0,
    scrollY: 0,
    pageXOffset: 0,
    pageYOffset: 0,
    dispatchEvent: jest.fn(),
  };
}

if (typeof globalThis.document === 'undefined') {
  (globalThis as any).document = {
    documentElement: {
      clientWidth: 1024,
      clientHeight: 768,
    },
    body: {
      clientWidth: 1024,
      clientHeight: 768,
    },
    title: 'Test Page',
  };
}

if (typeof globalThis.location === 'undefined') {
  (globalThis as any).location = {
    href: 'https://example.com/test',
  };
}

if (typeof globalThis.history === 'undefined') {
  (globalThis as any).history = {
    pushState: jest.fn(),
  };
}

if (typeof globalThis.PopStateEvent === 'undefined') {
  (globalThis as any).PopStateEvent = class PopStateEvent {
    type: string;
    constructor(type: string) {
      this.type = type;
    }
  };
}
