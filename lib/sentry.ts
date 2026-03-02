import {
  BrowserClient,
  defaultStackParser,
  getDefaultIntegrations,
  makeFetchTransport,
  Scope,
} from '@sentry/browser';
import type { ErrorEvent, EventHint } from '@sentry/browser';

export const SENTRY_DSN =
  'https://32bc999be1b471457f18747eea204a15@o4510975834390528.ingest.us.sentry.io/4510975859687424';

const BANNED_INTEGRATIONS = [
  'BrowserApiErrors',
  'BrowserSession',
  'Breadcrumbs',
  'ConversationId',
  'GlobalHandlers',
  'FunctionToString',
];

const URL_PATTERN = /https?:\/\/\S+/g;

const PII_EXTRA_KEYS = ['bookmark_title', 'title', 'url'];
const PII_TAG_KEYS = ['url', 'title'];

export function stripPii(event: ErrorEvent, _hint: EventHint): ErrorEvent | null {
  if (event.request) {
    delete event.request.url;
    delete event.request.headers;
  }

  event.breadcrumbs = [];

  delete event.user;

  if (event.extra) {
    for (const key of PII_EXTRA_KEYS) {
      delete event.extra[key];
    }
    for (const key of Object.keys(event.extra)) {
      const val = event.extra[key];
      if (typeof val === 'string') {
        event.extra[key] = val.replace(URL_PATTERN, '[REDACTED]');
      }
    }
  }

  if (event.tags) {
    for (const key of PII_TAG_KEYS) {
      delete event.tags[key];
    }
  }

  if (typeof event.message === 'string') {
    event.message = event.message.replace(URL_PATTERN, '[REDACTED]');
  }

  return event;
}

export function getFilteredIntegrations(): ReturnType<typeof getDefaultIntegrations> {
  return getDefaultIntegrations({}).filter(
    (integration) => !BANNED_INTEGRATIONS.includes(integration.name),
  );
}

let sentryScope: Scope | null = null;

export function initSentry(): Scope {
  const client = new BrowserClient({
    dsn: SENTRY_DSN,
    transport: makeFetchTransport,
    stackParser: defaultStackParser,
    integrations: getFilteredIntegrations(),
    beforeSend: stripPii,
  });

  const scope = new Scope();
  scope.setClient(client);
  client.init();

  sentryScope = scope;
  return scope;
}

export function captureException(error: unknown): void {
  sentryScope?.captureException(error);
}

export function getSentryScope(): Scope | null {
  return sentryScope;
}
