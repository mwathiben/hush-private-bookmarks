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

## MANAGER-002: Search Hook & Toolbar (2026-03-16)

### happy-dom Duplicate Element Rendering

- `type="search"` inputs render duplicate elements under happy-dom. `getByPlaceholderText('Search bookmarks...')` and `getByRole('searchbox')` both find multiple matches.
- **Fix**: Use `within(result.container as HTMLElement)` to scope queries to the actual rendered container, and use `getByLabelText('Search bookmarks')` (aria-label) instead of placeholder or role queries.
- This is a happy-dom quirk, not a test design issue. Document per-component when this workaround is needed.

### Test Query Specificity

- URL filter tests must use queries that uniquely match a single fixture bookmark. Query `'EXAMPLE.COM'` matched both `jira.example.com` AND `example.com` — 2 results instead of expected 1.
- **Fix**: Use domain-specific queries like `'GITHUB.COM'` that uniquely match one fixture entry. Always audit test fixtures for overlapping URLs/titles before writing assertions.

### React Debounce Pattern

- `useEffect` + `setTimeout`/`clearTimeout` cleanup is the canonical React debounce pattern (confirmed via React docs + context7). No external debounce libraries needed.
- `useMemo` keyed on `[tree, debouncedQuery]` for the filtering computation — prevents re-filtering on unrelated state changes.
- Effect cleanup runs before new effect AND on unmount — single mechanism handles both debounce reset and unmount cleanup.

### Toolbar Extraction Pattern

- Extracting inline toolbar JSX into a presentational component (`ManagerToolbar`) reduces ManagerApp line count and separates concerns.
- The parent manages all state; the toolbar receives callbacks. Zero business logic in the toolbar component.
- Button text (`+ Bookmark`, `+ Folder`) must be preserved exactly — existing tests check for this text.

### Search Integration Architecture

- `handleSearchChange` clears `selectedFolderPath` when search is active — ensures search results show all matches, not just current folder.
- `isActiveSearch` derived from `searchQuery.trim() !== ''` — whitespace-only queries don't trigger search.
- `SearchResults` resolves absolute paths via `findItemPath` for each result — O(n) per result but acceptable for v1.0 (< 1000 bookmarks).

### E2E Search Testing

- Use `page.fill()` for search input (triggers input event properly). `page.type()` also works but `fill()` is cleaner.
- Debounce means assertions need `timeout: 5_000` to wait for results to appear after debounce settles.
- Empty search result: use `data-testid="search-empty"` selector — more reliable than matching text content across locales.

### CodeRabbit Findings (Post-MANAGER-002)

- `role="toolbar"` + `aria-label` required on toolbar containers that group related controls (search + action buttons). Screen readers announce generic divs as unnamed containers without this.
- `tree!` non-null assertions are fragile — restructure conditionals to provide explicit null guards (`isActiveSearch && tree !== null`) instead of relying on implicit guarantees across component boundaries.
- Whitespace trim must be consistent between `isActiveSearch` check and `useSearch` filter. Adding `.trim()` in `useSearch`'s empty-check prevents whitespace-only queries from running the filter pipeline.
- O(N*M) `findItemPath` per search result in `SearchResults` is acceptable for v1.0 (<1000 bookmarks) but should be documented as an optimization opportunity. Pre-computed `Map<id, path>` would reduce to O(N+M).
- Silent `null` return from `.map()` when `findItemPath` fails is acceptable for the race condition (bookmark deleted between search and render) but not for integrity errors.
