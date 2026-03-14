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
