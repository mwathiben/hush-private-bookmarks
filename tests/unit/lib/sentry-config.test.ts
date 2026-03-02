import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { ErrorEvent } from '@sentry/browser';
import { Scope } from '@sentry/browser';
import {
  SENTRY_DSN,
  stripPii,
  getFilteredIntegrations,
  initSentry,
  captureException,
  getSentryScope,
} from '@/lib/sentry';

const ROOT = resolve(process.cwd());

const fetchSpy = vi.fn().mockResolvedValue(new Response('{}', { status: 200 }));

beforeAll(() => {
  vi.stubGlobal('fetch', fetchSpy);
});

afterAll(() => {
  vi.restoreAllMocks();
});

function makeEvent(overrides: Partial<ErrorEvent> = {}): ErrorEvent {
  return {
    type: undefined,
    event_id: 'abc123',
    timestamp: 1234567890,
    exception: {
      values: [{ type: 'DecryptionError', value: 'decryption failed', stacktrace: { frames: [{ filename: 'lib/crypto.ts', lineno: 42 }] } }],
    },
    ...overrides,
  };
}

describe('SENTRY_DSN', () => {
  it('is the correct public project identifier', () => {
    expect(SENTRY_DSN).toBe(
      'https://32bc999be1b471457f18747eea204a15@o4510975834390528.ingest.us.sentry.io/4510975859687424',
    );
  });
});

describe('stripPii', () => {
  it('deletes request.url', () => {
    const event = makeEvent({ request: { url: 'https://secret.com/page', headers: {} } });
    const result = stripPii(event, {});
    expect(result?.request?.url).toBeUndefined();
  });

  it('deletes request.headers', () => {
    const event = makeEvent({ request: { url: 'https://x.com', headers: { Referer: 'https://secret.com' } } });
    const result = stripPii(event, {});
    expect(result?.request?.headers).toBeUndefined();
  });

  it('clears breadcrumbs to empty array', () => {
    const event = makeEvent({ breadcrumbs: [{ message: 'click', category: 'ui' }] });
    const result = stripPii(event, {});
    expect(result?.breadcrumbs).toEqual([]);
  });

  it('strips URLs from extra string values', () => {
    const event = makeEvent({ extra: { info: 'visited https://secret.com/bookmarks today' } });
    const result = stripPii(event, {});
    expect(result?.extra?.info).toBe('visited [REDACTED] today');
  });

  it('deletes extra.bookmark_title', () => {
    const event = makeEvent({ extra: { bookmark_title: 'My Secret Site' } });
    const result = stripPii(event, {});
    expect(result?.extra?.bookmark_title).toBeUndefined();
  });

  it('deletes extra.title', () => {
    const event = makeEvent({ extra: { title: 'Page Title' } });
    const result = stripPii(event, {});
    expect(result?.extra?.title).toBeUndefined();
  });

  it('deletes extra.url', () => {
    const event = makeEvent({ extra: { url: 'https://secret.com' } });
    const result = stripPii(event, {});
    expect(result?.extra?.url).toBeUndefined();
  });

  it('deletes tags.url and tags.title', () => {
    const event = makeEvent({ tags: { url: 'https://secret.com', title: 'Secret' } });
    const result = stripPii(event, {});
    expect(result?.tags?.url).toBeUndefined();
    expect(result?.tags?.title).toBeUndefined();
  });

  it('deletes user entirely', () => {
    const event = makeEvent({ user: { id: '123', email: 'user@example.com' } });
    const result = stripPii(event, {});
    expect(result?.user).toBeUndefined();
  });

  it('strips URLs embedded in message', () => {
    const event = makeEvent({ message: 'Error loading https://private.com/data' });
    const result = stripPii(event, {});
    expect(result?.message).toBe('Error loading [REDACTED]');
  });

  it('preserves exception values (error class + stack)', () => {
    const event = makeEvent();
    const result = stripPii(event, {});
    expect(result?.exception?.values?.[0]?.type).toBe('DecryptionError');
    expect(result?.exception?.values?.[0]?.value).toBe('decryption failed');
    expect(result?.exception?.values?.[0]?.stacktrace?.frames).toHaveLength(1);
  });

  it('preserves timestamp', () => {
    const event = makeEvent();
    const result = stripPii(event, {});
    expect(result?.timestamp).toBe(1234567890);
  });

  it('returns the event (not null)', () => {
    const event = makeEvent();
    const result = stripPii(event, {});
    expect(result).not.toBeNull();
  });

  it('handles minimal event without throwing', () => {
    const result = stripPii({ type: undefined }, {});
    expect(result).toBeDefined();
  });

  it('handles event with no request/extra/tags/user gracefully', () => {
    const event = makeEvent();
    const result = stripPii(event, {});
    expect(result).toBeDefined();
    expect(result?.exception).toBeDefined();
  });
});

describe('getFilteredIntegrations', () => {
  const BANNED = [
    'BrowserApiErrors',
    'BrowserSession',
    'Breadcrumbs',
    'ConversationId',
    'GlobalHandlers',
    'FunctionToString',
  ];

  const EXPECTED_KEPT = [
    'InboundFilters',
    'LinkedErrors',
    'Dedupe',
    'HttpContext',
    'CultureContext',
  ];

  it('excludes all 6 banned DOM-dependent integrations', () => {
    const names = getFilteredIntegrations().map((i) => i.name);
    for (const banned of BANNED) {
      expect(names).not.toContain(banned);
    }
  });

  it('preserves safe integrations', () => {
    const names = getFilteredIntegrations().map((i) => i.name);
    for (const kept of EXPECTED_KEPT) {
      expect(names).toContain(kept);
    }
  });

  it('returns a non-empty array', () => {
    expect(getFilteredIntegrations().length).toBeGreaterThan(0);
  });
});

describe('initSentry', () => {
  it('returns a Scope instance', () => {
    const scope = initSentry();
    expect(scope).toBeInstanceOf(Scope);
  });

  it('captureException does not throw', () => {
    initSentry();
    expect(() => captureException(new Error('test'))).not.toThrow();
  });
});

describe('getSentryScope', () => {
  it('returns scope after initialization', () => {
    initSentry();
    expect(getSentryScope()).toBeInstanceOf(Scope);
  });
});

describe('lib/sentry.ts module purity', () => {
  const content = readFileSync(resolve(ROOT, 'lib/sentry.ts'), 'utf-8');

  it('has zero React/DOM imports', () => {
    expect(content).not.toMatch(/from\s+['"]react['"]/);
    expect(content).not.toMatch(/from\s+['"]react-dom['"]/);
    expect(content).not.toContain('document.');
    expect(content).not.toContain('window.');
  });

  it('has zero browser.storage references', () => {
    expect(content).not.toContain('browser.storage');
    expect(content).not.toContain('chrome.storage');
  });

  it('has zero console.log statements', () => {
    expect(content).not.toMatch(/console\.log/);
  });

  it('has zero type suppressions', () => {
    expect(content).not.toContain('as any');
    expect(content).not.toContain('@ts-ignore');
    expect(content).not.toContain('@ts-expect-error');
  });
});
