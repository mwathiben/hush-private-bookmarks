# Module 10: Process Lessons

## happy-dom navigator.clipboard Mocking

`navigator.clipboard` is a getter-only property in happy-dom. `Object.assign(navigator, { clipboard: ... })` silently fails. Use `Object.defineProperty(navigator, 'clipboard', { value: ..., writable: true, configurable: true })` in `beforeAll`. For spying on clipboard calls, use `vi.spyOn(navigator.clipboard, 'writeText')` directly in the test where the click happens — not in setup hooks, since `vi.clearAllMocks()` clears the spy between tests.

## SessionState.activeSetId Type

`SessionState.activeSetId` is `string`, not `string | null`. Use `''` (empty string) as the "no active set" sentinel in test fixtures. This caught a type error in the first test run.

## CodeRabbit Review — Design Intent vs Security Findings

CodeRabbit flagged "mnemonic never sent to background" as HIGH severity. This was by design — recovery blob creation is Module 12 scope. Document design decisions in the plan so reviewers understand intentional gaps. Conversely, "mnemonic not cleared from state after success" was a legitimate security fix — always clear sensitive data from component state when no longer needed.

## Clipboard API Error Handling

`navigator.clipboard.writeText()` can throw in non-secure contexts, extension popups with restricted permissions, or when the clipboard API is unavailable. Always wrap in try/catch. A silently failing clipboard copy is better than a floating rejected promise that crashes error boundaries.

## E2E Tests for Stub Handlers

When background handlers are NOT_IMPLEMENTED stubs, E2E tests can still verify the full UI flow up to the stub error. The test asserts that the error message (`NOT_IMPLEMENTED`) is displayed gracefully. These tests will break when the handler is implemented (AUTH-004 / Module 12 scope) — this is expected and intentional.

## Vertical TDD Slices

AUTH-003 followed vertical slices: each test was written, then the corresponding implementation, then the next test. This prevented the "all tests first" anti-pattern where tests end up testing imagined behavior. The `fillPasswordAndConfirm()` and `advanceToConfirmBackup()` helpers emerged naturally during GREEN phases as duplication accumulated.

## Pre-Existing Test Failures Must Be Fixed

When running verification and discovering pre-existing test failures (tests that were broken before the current task), fix them immediately rather than noting them as pre-existing. The user expects all tests to pass after every task, and "I didn't break it" is not an acceptable excuse. Use tracer bullet analysis to find root causes and all affected locations before applying fixes.

## Dark Mode FOUC Prevention

For class-based Tailwind dark mode (`@custom-variant dark (&:is(.dark *))`), the `matchMedia` detection MUST run synchronously before React renders — place it in `main.tsx` before `ReactDOM.createRoot()`, not in a `useEffect` hook. A hook runs after first paint, causing a flash of the wrong theme. Also add a `change` event listener for live updates when the user changes OS theme while the popup is open.

## Playwright emulateMedia for Extension Popups

`page.emulateMedia({ colorScheme: 'dark' })` works for Chrome extension popup pages when called BEFORE `page.goto()`. The synchronous dark mode script in `main.tsx` reads `window.matchMedia` on page load, so the emulation must be set first. Extension popup pages are standard HTML pages served via `chrome-extension://` protocol — no special restrictions.

## buildLockedState() Auto-Creates Default Set

`buildLockedState()` in background.ts calls `createDefaultManifest()` which generates a UUID for the default password set. Tests asserting `activeSetId === ''` will fail because the actual value is a UUID. Use a UUID regex matcher instead of exact string comparison.

## TestErrorTrigger Pattern for ErrorBoundary E2E

To test ErrorBoundary with E2E (which runs against production builds), add a `TestErrorTrigger` component that reads a query param (`?__test_throw`) and throws during render. This cannot be gated behind `import.meta.env.DEV` because E2E tests run against prod builds. The security risk is zero: the popup URL is not externally accessible, and the thrown error is caught by ErrorBoundary.

## CR-M9-3: Distinct Code Paths for Type Guard

The existing test sending `{ action: 'not-ours' }` (no `type` field) tests the `'type' in msg` check. CR-M9-3 sending `{ type: 'TOTALLY_BOGUS' }` tests the `VALID_TYPES.has(t)` check — a different code path in `isBackgroundMessage()`. Both are needed for full guard coverage.

## CodeRabbit Review Triage

When CodeRabbit flags a finding as MEDIUM but the fix would break functionality (e.g., gating TestErrorTrigger behind DEV breaks E2E), document why you're accepting it rather than silently ignoring. Include the analysis in the progress log so future reviewers understand the decision.
