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

## SETTINGS-002 (2026-03-15)

### "Back" Button Selector Collision

Adding "Restore Backup" and "Export Backup" buttons caused `/back/i` regex to match 3 buttons instead of 1. Playwright's `getByRole('button', { name: 'Back' })` also matches substrings. Fix: use `{ name: 'Back', exact: true }` in Playwright, or exact string `'Back'` in testing-library (which is exact by default for string matchers).

### shadcn CLI Path Resolution on WXT Projects

shadcn CLI resolves `@/` alias via `.wxt/` directory and places generated files one directory up from expected. Always verify output location after running `shadcn add` and move files if needed. Also: `npm_config_legacy_peer_deps=true` env var works when shadcn's internal `npm install` hits ESLint peer dep conflicts.

### happy-dom File Upload Workaround

`userEvent.upload()` fails in happy-dom (https://github.com/testing-library/user-event/issues/940). Use `fireEvent.change(input, { target: { files: [file] } })` with manually constructed `File` objects. Access hidden file inputs via `document.querySelector('input[accept="..."]')` since they have no accessible role.

### Type Guards for BackgroundResponse.data

`BackgroundResponse.data` is `unknown`. Each consumer needs a runtime type guard. Pattern: check `data !== null && typeof data === 'object'`, then verify expected properties exist and have correct types. Avoid `as any` — the type guard is small and makes the narrowing explicit.

### Immutable Tree Merge

`BookmarkTree.children` is `readonly BookmarkNode[]`. Merging requires spread: `{ ...current, children: [...current.children, imported] }`. The "Imported" wrapper folder from `parseHtmlBookmarks`/`convertChromeBookmarks` is appended whole — don't flatten its children.

### File Input Reset for Re-selection

Hidden `<input type="file">` elements must have `.value` reset after the handler finishes (success or failure). Otherwise selecting the same file again won't trigger `onChange` because the browser sees the value hasn't changed. Use `e.currentTarget` (stable reference) and reset in a `finally` block.

### sr-only Labels for Accessibility Without Visual Noise

When a section heading (e.g., "Change Password") already provides visual context, visible `<Label>` elements on each field duplicate the information and create cramped UI in popup-width layouts. Use `<Label className="sr-only">` to maintain screen reader accessibility (`htmlFor` + `id` association) while keeping the visual UI clean. The `aria-label` on PasswordInput provides a fallback, but explicit Label association is the WCAG-preferred pattern.

### Unused Mock Cleanup

When mocking context providers in test files, verify the component actually uses each mocked export. SettingsScreen doesn't use `useTreeContext` — its children (ImportSection, ExportSection) use `useTree` which is mocked separately. Stale mock entries are harmless but confusing during review.

## SETTINGS-003 (2026-03-15)

### Type-to-Confirm Pattern for Double Confirmation

When `ConfirmDialog` (button-only confirm) is insufficient for destructive actions requiring double confirmation, implement inline type-to-confirm in the component rather than modifying the shared `ConfirmDialog`. Two-phase UI: initial destructive button reveals input + disabled confirm button → button enables only when exact text matches. Keeps the shared component simple while meeting stronger confirmation requirements.

### TRANSITIONS Table Maintenance

Always check the TRANSITIONS state machine in App.tsx when adding operations that could route to new screens. CLEAR_ALL causes `deriveScreen()` to return `'setup'` (when `!session.hasData`), but `settings → setup` wasn't in the TRANSITIONS table — would throw "Invalid transition" at runtime. Audit TRANSITIONS for every new state-changing background message.

### Theme Init Timing (FOUC Prevention)

localStorage read for theme preference MUST happen synchronously in `main.tsx` BEFORE `ReactDOM.createRoot().render()`. If deferred to a React component (e.g., ThemeToggle's `useEffect`), users see a flash of the wrong theme on every page load. Guard the `prefers-color-scheme` media query listener with a localStorage check so it doesn't override explicit user choice.

### Session Refresh After Set Operations

CREATE_SET returns full `SessionState` in `response.data` — dispatch `SET_SESSION` directly. RENAME_SET and DELETE_SET return `{ success: true }` without session data — must send follow-up `GET_STATE`, validate with `isSessionState()`, then dispatch `SET_SESSION`. Inline helper `refreshSession()` is appropriate for 3 call sites (not worth extracting to a shared hook).

### Module 13 Coordination: Manager Theme Init

The manager entrypoint (`entrypoints/manager/main.tsx`, built in Module 13) will need identical localStorage-first theme init code. Document this dependency so the Module 13 implementer doesn't miss it — otherwise the manager page will have FOUC while the popup doesn't.

### Radix DialogDescription Accessibility

Radix Dialog warns when `DialogContent` lacks a `DialogDescription` or explicit `aria-describedby={undefined}`. Always include `DialogDescription` with meaningful text in Dialog-based modals. Discovered during E2E — console warning doesn't break tests but indicates accessibility gap.

### CodeRabbit Review: Always Use finally for setPending

When async handlers use `setPending(true)` at the top and have multiple exit paths (early return on error, catch block, success path), use `finally { setPending(false) }` instead of placing `setPending(false)` after the try/catch or inside each branch. This prevents: (1) pending never resetting on success when the component unmounts (e.g., CLEAR_ALL navigates away), (2) double `setPending(false)` calls (once in catch, once after try/catch). Found in ClearDataSection and all 3 SetManagement handlers.

### CodeRabbit Review: Clear Sensitive State on Dialog Dismiss

When a Dialog contains password or sensitive inputs, clear them on ANY close path — not just on Cancel button click or successful submit. The `onOpenChange` handler fires when the user clicks the overlay or presses ESC, bypassing the Cancel button. Pattern: `onOpenChange={(open) => { if (!open) { clearSensitiveState(); } setOpen(open); }}`.

### Semantic Color Tokens Over Raw Colors

Use semantic tokens (`text-primary`, `text-destructive`, `text-muted-foreground`) instead of raw Tailwind colors (`text-green-600`). Raw colors bypass the theme system and won't adapt to dark mode or theme changes. If no semantic success token exists, `text-primary` is acceptable for positive status messages.

### Context Session Continuation: Re-verify After Compaction

When a conversation is continued from compacted context, ALL verification must be re-run in the new session before claiming completion. Compacted summaries say "tests passed" but that's a claim from a previous session — not evidence. The verification-before-completion skill applies per-session, not per-lifetime.
