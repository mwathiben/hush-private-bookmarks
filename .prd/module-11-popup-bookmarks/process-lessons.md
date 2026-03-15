# Module 11 — Process Lessons

## BOOKMARK-001 (2026-03-14)

- shadcn CLI places files wrong with WXT alias — verify output path after `shadcn add`
- Pre-existing `as SessionState` casts found during analysis — fix immediately, don't defer
- E2E for extensions requires `chromium.launchPersistentContext` with `--load-extension`
- Vitest `// @vitest-environment happy-dom` pragma needed for hook tests (jsdom breaks esbuild Uint8Array)

## BOOKMARK-002 (2026-03-15)

### Selector Disambiguation in E2E

When multiple buttons share similar text (e.g., toolbar "Add bookmark" aria-label vs EmptyTreeState "Add Bookmark" text), use different selector strategies:
- `getByLabel('Add bookmark')` for elements with `aria-label`
- `getByRole('button', { name: 'Add Bookmark', exact: true })` for text-based buttons
- Scope dialog buttons with `page.getByRole('dialog').getByRole('button', ...)`

### E2E Headed Mode

Default to headed locally, headless only in CI. Implementation: `headless: !!process.env.CI` in the fixture. Never use env-var opt-in (`HEADED=true`) — too easy to forget.

### CodeRabbit Findings Worth Internalizing

1. **Always try/catch around `onSave` calls** — if onSave throws, the dialog gets permanently stuck in saving state without a catch block.
2. **Stable refs matter** — inline arrow functions, objects, and arrays in JSX create new references every render. Extract to `useCallback`, `useMemo`, or module-level constants.
3. **Module-level constants for empty arrays** — `const ROOT_PATH: readonly number[] = []` at module scope prevents re-renders from new array identity.

### Coverage Strategy

- Write initial tests for the happy path and main error cases
- After implementation, check coverage with `--coverage` flag
- Target uncovered branches specifically — dialog close handlers (`if (!open)`) are easy to miss
- TreeScreen's `handleOpenChange(false)` branches need tests that open then close dialogs (Escape key)

### TDD Vertical Slices

Horizontal slicing (all tests first) produces tests that test imagined behavior. Vertical slicing (one test → one impl → repeat) produces tests that verify actual behavior. The difference is significant — vertical slice tests survived all refactoring unchanged.

### Security Test Isolation

When testing protocol/scheme rejection (e.g., `javascript:`, `data:`), use one test per scheme. A combined test title like "rejects javascript: and data: URLs" that only exercises one scheme is misleading — split into isolated tests for independent failure reporting.

### Deslop: Nested Ternaries

Nested ternaries in JSX (`saving ? 'X' : isEdit ? 'Y' : 'Z'`) violate project conventions. Extract to a helper function (`buttonLabel(saving, isEdit)`) for readability.

## BOOKMARK-003 (2026-03-15)

### Button Nesting in Radix Components

DropdownMenuTrigger renders as `<button>`. Placing it inside AccordionTrigger (also `<button>`) causes a DOM nesting violation. Solution: restructure FolderItem so the dropdown trigger is a sibling of AccordionTrigger inside a flex container, not a child of it. This eliminates the need for `stopPropagation` hacks entirely.

### E2E Strict Mode Violations with `getByLabel`

`getByLabel('Name')` can match both the dialog container (via `aria-labelledby` resolving to title text containing "Name") and the actual input (via `<label htmlFor>`). Use `getByRole('textbox', { name: 'Name' })` to target specifically the input element.

### FolderPicker Design: Emit Path + Count

When `getItemAtPath` doesn't exist in the data model, have `collectPickableFolders` capture folder metadata (path, childrenCount) during the tree walk, so `onSelect` can emit `(folderPath, childrenCount)` directly without needing to look up the folder again.

### DialogState as Single Discriminated Union

Using a single `DialogState` union (7 variants) instead of separate boolean/enum state variables prevents impossible states (e.g., two dialogs open simultaneously) and makes the action→dialog mapping explicit in the switch statement.

### Deslop: Identical Ternary Branches

`isEdit ? 'Failed to save folder' : 'Failed to save folder'` — when extending a dialog for add/edit modes, check that conditional error messages actually differ. If both branches produce the same string, the ternary is slop. Caught by deslop review, not by tests or linter.

### CodeRabbit Review Findings (BOOKMARK-003)

1. **Duck typing vs type guards** — `'name' in node` works but is fragile. Prefer `isFolder(node)` from data-model.ts for type discrimination. Type guards are stable against future property additions.
2. **`default: never` in action switches** — adding exhaustive checks to `handleAction` prevents silent ignore when new action types are added. Not a defect today but valuable future-proofing.
3. **Path array identity vs memo** — `[...basePath, index]` creates new arrays every render, defeating `React.memo` on child components. Acceptable for small popup trees; revisit if manager view has thousands of items.

## BOOKMARK-004 (2026-03-15)

### Strict Mode Violations in Playwright

`getByText('Work')` matched both the folder name `<span>Work</span>` and the ConfirmDialog title `Delete "Work"?`. Fix: wait for dialog to close (`getByRole('dialog').not.toBeVisible()`) before checking text that also appears in the dialog. Always consider what other elements share the text you're asserting on.

### `node satisfies never` vs `const _exhaustive: never = node`

Both enforce compile-time exhaustive type checking. `satisfies never` doesn't declare a variable, avoiding unused variable lint/TS errors. Preferred pattern going forward for exhaustive checks in switch/if chains.

### PII in Error Messages

`JSON.stringify(node)` in exhaustive check error leaks bookmark titles/URLs into Sentry. Even "impossible" code paths should not include PII — defense-in-depth. The `never` type already guarantees compile-time exhaustiveness; no runtime data needed in the error.

### eslint-plugin-react-hooks Overrides

- `set-state-in-effect`: Use targeted `/* eslint-disable/enable */` block comments around each useEffect, not blanket file-level overrides in eslint.config.js. `eslint-disable-next-line` only covers the immediate next line and misses setState calls inside the useEffect body.
- `rules-of-hooks` + `exhaustive-deps`: OFF for `tests/e2e/**/*.ts` only — Playwright fixture `use()` function is falsely flagged as React Hook `use`

### Lifecycle Tests vs Granular Tests

Lifecycle tests (add → edit → delete → verify empty state) complement granular tests but don't replace them. Granular tests isolate failures; lifecycle tests catch state transition bugs across operations. Both are needed.

### Apply Flagged Patterns Codebase-Wide

When a code review flags a pattern (e.g., `satisfies never` over `_exhaustive: never`), grep the entire codebase for all instances — don't fix only the file under review. background.ts had the same `const _exhaustive: never` pattern that BookmarkTree.tsx was fixed for. Fix all canonical instances in one pass.

### E2E Fixture Deduplication

When multiple test groups share identical fixture setup (same steps, different seed data), extract a factory function: `makeTreeTest(treeData)` returns the extended test with parameterized data. Eliminates copy-paste divergence risk.

### Cross-Folder Move Testing

Single-folder move tests (root → Work) don't exercise the code path where a bookmark moves between two non-root folders. Add cross-folder tests (root → Work → Personal) to cover `getByLabel('Actions', { exact: true })` selector disambiguation when multiple folder action buttons exist.

### CodeRabbit VSC Auto-Review: Accept/Reject Discipline

CodeRabbit's VSCode integration auto-applies fixes. Review each with zero confirmation bias:

- **Reject** changes that violate CLAUDE.md (e.g., `console.error` in production code when `no-console` is enforced; editing `components/ui/` shadcn source files).
- **Reject** type changes that regress to deprecated APIs (global `JSX.Element` deprecated in React 19 — use `React.JSX.Element`).
- **Accept** test renames that match what assertions actually verify (test titles are documentation).
- **Accept** test fixes where describe block and test interactions disagree (folder describe + bookmark dialog interactions = wrong test).
- **Accept** exhaustive-switch improvements (`throw` over `return msg` for `never` branches).
