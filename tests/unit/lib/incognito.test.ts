import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import {
  determineMode,
  shouldAutoUnlock,
  getIncognitoMessage,
  INCOGNITO_MESSAGES,
} from '@/lib/incognito';
import type { IncognitoState, IncognitoMode } from '@/lib/incognito';

const ROOT = resolve(process.cwd());

describe('determineMode', () => {
  it('returns incognito_active when in incognito context and allowed', () => {
    // #given
    const state: IncognitoState = { isIncognitoContext: true, isAllowedIncognito: true };
    // #when
    const mode = determineMode(state);
    // #then
    expect(mode).toBe('incognito_active');
  });

  it('returns incognito_not_allowed when in incognito but extension not allowed', () => {
    // #given
    const state: IncognitoState = { isIncognitoContext: true, isAllowedIncognito: false };
    // #when
    const mode = determineMode(state);
    // #then
    expect(mode).toBe('incognito_not_allowed');
  });

  it('returns normal_mode when not in incognito context', () => {
    // #given — isAllowedIncognito is irrelevant when not in incognito
    const state: IncognitoState = { isIncognitoContext: false, isAllowedIncognito: true };
    // #when
    const mode = determineMode(state);
    // #then
    expect(mode).toBe('normal_mode');
  });

  it('returns normal_mode when not in incognito even if not allowed', () => {
    // #given
    const state: IncognitoState = { isIncognitoContext: false, isAllowedIncognito: false };
    // #when
    const mode = determineMode(state);
    // #then
    expect(mode).toBe('normal_mode');
  });
});

describe('shouldAutoUnlock', () => {
  it('returns true only for incognito_active', () => {
    // #given/#when/#then
    expect(shouldAutoUnlock('incognito_active')).toBe(true);
  });

  it('returns false for normal_mode', () => {
    // #given/#when/#then
    expect(shouldAutoUnlock('normal_mode')).toBe(false);
  });

  it('returns false for incognito_not_allowed', () => {
    // #given/#when/#then
    expect(shouldAutoUnlock('incognito_not_allowed')).toBe(false);
  });
});

describe('getIncognitoMessage', () => {
  it('returns null for incognito_active (no message needed)', () => {
    // #given/#when
    const message = getIncognitoMessage('incognito_active');
    // #then
    expect(message).toBeNull();
  });

  it('returns guidance string for incognito_not_allowed', () => {
    // #given/#when
    const message = getIncognitoMessage('incognito_not_allowed');
    // #then
    expect(message).toBeTypeOf('string');
    expect(message!.length).toBeGreaterThan(0);
  });

  it('returns null for normal_mode', () => {
    // #given/#when
    const message = getIncognitoMessage('normal_mode');
    // #then
    expect(message).toBeNull();
  });
});

describe('INCOGNITO_MESSAGES', () => {
  it('has entries for all three IncognitoMode values', () => {
    // #given
    const allModes: IncognitoMode[] = ['incognito_active', 'normal_mode', 'incognito_not_allowed'];
    // #when/#then
    for (const mode of allModes) {
      expect(mode in INCOGNITO_MESSAGES).toBe(true);
    }
  });

  it('only incognito_not_allowed has a non-null message', () => {
    // #given/#when/#then
    expect(INCOGNITO_MESSAGES.incognito_active).toBeNull();
    expect(INCOGNITO_MESSAGES.normal_mode).toBeNull();
    expect(INCOGNITO_MESSAGES.incognito_not_allowed).toBeTypeOf('string');
  });
});

describe('lib/incognito.ts module purity', () => {
  const content = readFileSync(resolve(ROOT, 'lib', 'incognito.ts'), 'utf-8');

  it('has zero React/DOM imports', () => {
    expect(content).not.toMatch(/from\s+['"]react['"]/);
    expect(content).not.toMatch(/from\s+['"]react-dom['"]/);
  });

  it('has zero browser/chrome API imports', () => {
    expect(content).not.toMatch(/from\s+['"]wxt\/browser['"]/);
    expect(content).not.toContain('chrome.');
    expect(content).not.toContain('browser.');
  });

  it('has zero console.log', () => {
    expect(content).not.toMatch(/console\.log/);
  });

  it('has zero type suppressions', () => {
    expect(content).not.toContain('as any');
    expect(content).not.toContain('@ts-ignore');
    expect(content).not.toContain('@ts-expect-error');
  });

  it('is within 80-line limit', () => {
    const lines = content.split('\n').length;
    expect(lines).toBeLessThanOrEqual(80);
  });
});
