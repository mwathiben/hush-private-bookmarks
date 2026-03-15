# Module 12 — Process Lessons

## SETTINGS-001a (2026-03-15)

### Directory-Based Entrypoint Extraction

WXT supports `entrypoints/background/index.ts` + companion files. When a single entrypoint file approaches 300 lines, extract to directory structure. Import paths (`@/entrypoints/background`) resolve to `index.ts` automatically — no import changes needed in tests or other files.

### HandlerContext Pattern

Dependency injection via interface works well for background handlers. Benefits: testable without browser mocks, consistent abstraction (no mixing direct browser.* calls with context methods). CodeRabbit correctly flagged 4 leaked browser.* calls that broke the pattern — always audit for consistency after extraction.

### loadAndActivateSet Shared Helper

handleUnlock and handleSwitchSet shared ~25 lines of identical logic. Extracting to a private helper reduced handlers.ts from 339 to 288 lines. Look for duplication across handlers before considering the file "done."

### CodeRabbit Review Patterns

Medium-priority findings were all legitimate:
1. **Abstraction consistency** — if you create a context/DI pattern, ALL browser calls must go through it. Partial adoption is worse than none.
2. **Orphaned resource tests** — test the case where step 1 succeeds but step 2 fails (e.g., createSet succeeds but saveSetData fails).
3. **Re-encryption failure test** — test that CHANGE_PASSWORD handles saveSetData failure after successful loadSetData.

### scaffold-smoke.test.ts Maintenance

When restructuring entrypoint files, update the scaffold smoke test that checks file existence and line counts. Easy to forget — causes immediate CI failure.

### E2E Test Updates After Handler Wiring

Existing E2E tests that checked NOT_IMPLEMENTED responses need updating to check actual behavior. Plan for this when wiring handlers — it's not just unit tests that change.

## SETTINGS-001b (2026-03-15)

### TDD Vertical Slices for UI Components

7 RED→GREEN cycles across 3 phases (PasswordChangeForm 3, RecoveryPhraseVerify 2, SettingsScreen 2). Each cycle verified independently before moving on. Key: start with rendering tests, then add behavior tests incrementally. Don't write all tests first.

### Pre-existing Problems Are Still Problems

Fix pre-existing violations found during analysis — 4 `console.error` calls in TreeScreen.tsx violated CLAUDE.md's zero-console-log rule. Also fix stale E2E assertions (popup-setup.test.ts expected NOT_IMPLEMENTED but handler was already implemented in 001a). Don't leave known-broken tests passing for the wrong reason.

### Playwright `exact: true` for Substring Placeholders

`getByPlaceholder('New password')` matches both "New password" and "Confirm new password" in strict mode. Use `{ exact: true }` to disambiguate. Similarly, `getByText('Change Password')` matches both `<h4>` headings and `<button>` text — use `getByRole('heading', { name: 'Change Password' })` instead.

### React.FormEvent Generic Parameter

React 19 deprecates bare `React.FormEvent`. Use `React.FormEvent<HTMLFormElement>` to match existing codebase pattern (AddFolderDialog, AddEditBookmarkDialog). Consistent typing prevents deprecation warnings.

### useSessionDispatch Mock Propagation

Adding `useSessionDispatch()` to an existing component (TreeScreen) breaks all its tests if the mock isn't added. When modifying a component to use a new context hook, immediately update its test file's mock setup.

### PasswordInput autocomplete Prop

Adding optional props to shared UI components (PasswordInput) is safe — existing callers are unaffected. But do it as a prerequisite step before the component that needs it, not as a drive-by change mid-implementation.

### CREATE_SET / SetupScreen Contract Mismatch (RESOLVED)

CREATE_SET handler originally returned `{ setId }` but SetupScreen expects `SessionState` (checked via `isSessionState()`). Fixed by having `handleCreateSet` build and return a full SessionState — reusing the same `activateSession` helper that `loadAndActivateSet` uses. This also required `setActiveSetId` before building the session. The shared `activateSession` helper deduplicates the session-building pattern (listSets → incognito check → build state → persist → cache password → reset alarm) that was previously inlined in `loadAndActivateSet` and duplicated by CodeRabbit's initial fix.

### CodeRabbit VSC Auto-Review: Verify Blast Radius

CodeRabbit on VSC correctly identified the CREATE_SET contract mismatch and fixed it, but the fix duplicated 20 lines from `loadAndActivateSet` into `handleCreateSet`, pushing handlers.ts to 319 lines (over the 300-line limit). Always check: (1) does the fix duplicate existing code? (2) does it push any file over line limits? Extract shared logic into helpers before committing.
