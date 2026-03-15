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
