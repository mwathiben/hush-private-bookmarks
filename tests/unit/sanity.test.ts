import { describe, expect, it } from 'vitest';

describe('test runner sanity check', () => {
  it('evaluates arithmetic correctly', () => {
    expect(1 + 1).toBe(2);
  });

  it('has jsdom environment active', () => {
    expect(typeof globalThis.document).toBe('object');
  });
});
