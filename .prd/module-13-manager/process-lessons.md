# Module 13: Manager — Process Lessons

## Session Context Extraction (Step 0)

- Extracting shared context from an entrypoint into `hooks/` is the single riskiest step — 17 files change simultaneously. Run `tsc --noEmit && vitest run` immediately after, before writing any new code.
- The `useSessionProvider()` hook pattern (returns state + dispatch + treeValue) enables independent React roots sharing the same logic. Each entrypoint calls the hook and passes results to `SessionProvider`.
- Mock path updates in 9 test files are mechanical but error-prone. Grep for the old path after updating to catch any misses.

## V8 Coverage and JSX

- V8 native coverage does NOT reliably track JSX expressions inside conditional blocks like `{tree !== null && (<>...</>)}`. The compiled `jsx()` calls get different source map positions than the original JSX lines.
- Tests that verify `getByRole('dialog')` prove the dialog JSX renders, but V8 still reports those lines as uncovered. This is a tool limitation, not a testing gap.
- Workaround attempted: mocking `useSessionProvider` to skip the two-render cycle (initial state → effect → re-render). Did not improve V8 JSX tracking.
- Accept V8 JSX coverage gaps in entrypoint files. Focus coverage thresholds on `lib/` (pure TS, no JSX artifacts).

## Test Patterns for ManagerApp

- Mock `useSessionProvider` directly (via `async (importOriginal)` partial mock) to control initial render state. This eliminates the useEffect two-render cycle and makes tests synchronous where possible.
- DropdownMenu actions: click `getByLabelText('Actions')` to open the menu, then click the menu item text. Works reliably in happy-dom.
- `within(screen.getByTestId('manager-main'))` is essential when sidebar and main panel contain overlapping text (e.g., "Bookmark" appears in both "All Bookmarks" sidebar item and "+ Bookmark" toolbar button).

## Radix Dialog Scroll Lock

- When Radix dialogs open, `data-scroll-locked="1"` and `pointer-events: none` are set on body. This can interfere with `getByRole('alert')` queries.
- Use `getByText('error message')` instead of `getByRole('alert')` when testing error states inside dialog flows.

## Coverage Strategy

- `main.tsx` bootstrap files (ReactDOM.createRoot) will always show 0% coverage — untestable by unit tests.
- For components using `useTree` hook, the mock must be set BEFORE render and must return the tree synchronously. The `mockUseSession` helper pattern (sets both `useSession` and `useTree` together) prevents stale mock state.
- `ErrorBoundary` tests require `vi.spyOn(console, 'error').mockImplementation(() => {})` to suppress React's error boundary console output, plus `vi.restoreAllMocks()` in `afterEach` to clean up.

## Component Architecture

- ManagerApp.tsx at 270 lines exceeds the 200-line target. The `ManagerTreePanel` inner component contains dialog handling (~80 lines of callbacks). If this grows further, extract a `useBookmarkDialogs` hook.
- `DialogState` discriminated union with `DIALOG_NONE` constant prevents re-renders from reference identity changes. Same pattern as TreeScreen.
- `CENTERED_SCREENS` record lookup eliminates if-else chains for screen routing.

## CodeRabbit Review Findings (Post-MANAGER-001)

- Nested interactive elements (button inside button) are invalid HTML — refactor chevron toggle into a sibling `<button>` with `aria-label="Toggle folder"` and `aria-expanded`.
- `role="alert"` must be consistent on all error containers for screen reader announcements. The top-level ManagerApp error div was missing it.
- Never use `as SessionState` casts on `unknown` — use `isSessionState()` type guard for runtime validation before dispatching to context.
- Reducers must never throw — return unchanged state on invalid transitions. `console.warn` is also forbidden per project rules; silently ignore instead.
- Test names must match what the test actually asserts. "sends LOCK and returns to login" was renamed to "sends LOCK" since the test only checks the message call.
