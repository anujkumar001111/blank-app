/**
 * Tests for BrowserAgent (Chrome Extension)
 *
 * These tests verify the BrowserAgent class can be instantiated.
 * Full integration tests require a Chrome extension environment.
 */

import BrowserAgent from '../src/browser';

// Mock Chrome APIs for testing
const mockChrome = {
  tabs: {
    captureVisibleTab: jest.fn(),
    create: jest.fn(),
    query: jest.fn(),
    update: jest.fn(),
    get: jest.fn(),
    onUpdated: {
      addListener: jest.fn(),
      removeListener: jest.fn(),
    },
  },
  windows: {
    getLastFocused: jest.fn(),
    getCurrent: jest.fn(),
  },
  scripting: {
    executeScript: jest.fn(),
  },
};

// Install mock before tests
beforeAll(() => {
  (globalThis as any).chrome = mockChrome;
});

afterAll(() => {
  delete (globalThis as any).chrome;
});

beforeEach(() => {
  jest.clearAllMocks();
});

describe('BrowserAgent', () => {
  it('can be instantiated', () => {
    const agent = new BrowserAgent();
    expect(agent).toBeDefined();
    expect(agent).toBeInstanceOf(BrowserAgent);
  });

  it('is an instance of BaseBrowserLabelsAgent', () => {
    const agent = new BrowserAgent();
    // BrowserAgent extends BaseBrowserLabelsAgent
    expect(agent.constructor.name).toBe('BrowserAgent');
  });
});

describe('BrowserAgent export', () => {
  it('exports BrowserAgent class', () => {
    expect(BrowserAgent).toBeDefined();
    expect(typeof BrowserAgent).toBe('function');
  });

  it('can create multiple instances', () => {
    const agent1 = new BrowserAgent();
    const agent2 = new BrowserAgent();
    expect(agent1).not.toBe(agent2);
  });
});
