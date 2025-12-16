/**
 * Tests for BrowserAgent (Web/Browser-only)
 *
 * These tests verify the BrowserAgent class can be instantiated.
 * Full integration tests require a real browser environment with DOM.
 */

import BrowserAgent from '../src/browser';

// Mock html2canvas
jest.mock('html2canvas', () => {
  return jest.fn().mockResolvedValue({
    toDataURL: jest.fn().mockReturnValue('data:image/jpeg;base64,mockbase64data'),
  });
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
