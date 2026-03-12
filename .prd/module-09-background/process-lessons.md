# Module 9: Process Lessons

## Chrome Extension MV3 Patterns

### onMessage Listener — Return Promise, Not `return true`
In MV3 (Chrome 99+), returning a Promise directly from the `runtime.onMessage` listener keeps the message port open. The old `return true` + `sendResponse()` pattern is deprecated. Return `undefined` for messages you don't handle.

### contextMenus.create() Does NOT Return a Promise
Unlike most Chrome APIs, `contextMenus.create()` returns the menu item ID synchronously. Do not await it. Errors are only accessible via the callback parameter (or `chrome.runtime.lastError`). WXT's `browser.contextMenus.create()` follows the same pattern.

### chrome.storage.session for Service Worker State
Two-tier state architecture: `chrome.storage.session` for tree/metadata (survives SW termination), module-level variable for password (lost on SW termination = correct security behavior). Never put passwords in any form of persistent storage.

### E2E Testing Extensions with Playwright
- Use `chromium.launchPersistentContext` with `--load-extension` flag
- `channel: 'chromium'` enables headless extension testing (Playwright v1.49+)
- Extract extension ID from service worker URL: `sw.url().split('/')[2]`
- Navigate to `chrome-extension://<id>/popup.html` for popup testing
- Use `page.evaluate()` with `chrome.runtime.sendMessage()` to test background handlers
- Context menus can't be directly queried via Playwright; verify via manifest permissions

## Code Quality Lessons

### Consistent Error Response Shape
Every error response MUST include both `error` (human-readable) and `code` (machine-readable) fields. The INTERNAL_ERROR response was the only one missing `code` — caught during self-audit. Consistency prevents frontend bugs where code checks for a `code` field that doesn't exist.

### Scaffold-Smoke Tests as Guardrails
If a PRD specifies a line budget or architectural constraint, add a corresponding scaffold-smoke test. background-types.ts had a ≤150 line test but background.ts ≤300 was missing. These tests catch regressions that code review might miss.

### Deslop = Zero AI Slop
Review every diff for: extra comments a human wouldn't add, defensive try/catch blocks, `as any` casts, style inconsistencies. Match existing patterns exactly.

## Process Lessons

### ALL Instructions Are MANDATORY
User instructions are requirements, not suggestions. Every step in the Ralph Wiggum workflow must be executed: research, skill audit, tracer bullet analysis, implementation, verification, self-review, progress updates, memory commits. No shortcuts.

### Tracer Bullet Analysis Before Implementation
Map the full blast radius before writing code: imports, consumers, test files, browser API surface, security surface, build output. This prevents surprises and ensures comprehensive test coverage.

### Skill Audit Breadth
38 applicable skills were identified for BG-005 across 10 domains (testing, E2E, extension, security, review, quality, architecture, git, verification, coordination). Always check the full domain matrix in CLAUDE.md, not just the obvious skills.

### Research Best Practices FIRST
Web search for current best practices (Playwright Chrome extension docs, WXT E2E guide, Chrome MV3 message passing) before implementing. This prevented two false-positive "bugs" (contextMenus.create, onMessage return value) that would have introduced unnecessary code changes.

### Self-Critical Code Audit
Read the actual code line-by-line before claiming it's ready. The INTERNAL_ERROR missing `code` field was only caught because of the audit, not from test failures. Tests don't catch every inconsistency — human review catches patterns.
