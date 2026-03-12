# Module 9: Background Service Worker — Progress Log

## Story Tracker

| ID | Title | Status | Attempts |
| --- | --- | --- | --- |
| BG-001 | Complete message protocol types and handler scaffold | PASSED | 1 |
| BG-002 | Unlock/Lock handlers with chrome.storage.session and auto-lock alarm | PASSED | 1 |
| BG-003 | SAVE and ADD_BOOKMARK handlers with alarm reset | PASSED | 1 |
| BG-004 | Context menu, incognito detection, and Sentry error wiring | PASSED | 1 |
| BG-005 | Integration, E2E, and full verification | PASSED | 1 |

**Critical Path**: 001 → 002 → 003/004 → 005

---

## Session: 2026-03-11T16:00:00Z

**Task**: BG-001 - Complete message protocol types and handler scaffold
**Status**: PASSED (attempt 1)

### Work Done
- Created `lib/background-types.ts` with 16-type discriminated union (TYPES ONLY, zero runtime code)
- Rewrote `entrypoints/background.ts` with typed `handleMessage` dispatcher + exhaustive `never` switch
- Added `isBackgroundMessage` type guard at message boundary
- Added `alarms` permission, `incognito: 'spanning'`, and `_execute_action` command to `wxt.config.ts`
- Installed `@types/chrome` as devDependency for proper E2E test typing (best practice research)
- Updated scaffold-smoke.test.ts: LIB_MODULES 12→13, added background-types imports + architecture constraints
- Deslop: removed 4 section separator comments inconsistent with codebase style

### Files Created

| File | Purpose |
| --- | --- |
| `lib/background-types.ts` | 16 message types as discriminated union, BackgroundResponse, SessionState (128 lines, types only) |
| `tests/unit/lib/background-types.test.ts` | 18 tests: type compilation, purity, discriminated union narrowing, module constraints |
| `tests/unit/entrypoints/background.test.ts` | 17 tests: all 16 handlers return NOT_IMPLEMENTED, response shape verification |
| `tests/e2e/background-message.test.ts` | 6 E2E tests: manifest verification (alarms, incognito, commands), message dispatch, pass-through |

### Files Modified

| File | Changes |
| --- | --- |
| `wxt.config.ts` | +alarms permission, +incognito: 'spanning', +commands._execute_action with Ctrl+Shift+H |
| `entrypoints/background.ts` | Full rewrite: handleMessage, isBackgroundMessage, onMessage listener with error catch |
| `tests/unit/integration/scaffold-smoke.test.ts` | LIB_MODULES 12→13, +background-types type imports, +smoke test, +architecture constraints |
| `package.json` | +@types/chrome devDependency |

### Acceptance Criteria Verification

1. [PASS] lib/background-types.ts exports BackgroundMessage (16-type union), BackgroundResponse, SessionState, MessageType, all individual interfaces
2. [PASS] lib/background-types.ts is TYPES ONLY: zero runtime code, only type/import type statements, passes lib/ purity check
3. [PASS] Core (6): UNLOCK, LOCK, SAVE, GET_STATE, ADD_BOOKMARK, GET_INCOGNITO_STATE — all with correct fields
4. [PASS] Settings (7): CHANGE_PASSWORD, UPDATE_AUTO_LOCK, CREATE_SET, RENAME_SET, DELETE_SET, SWITCH_SET, CLEAR_ALL — all with correct fields
5. [PASS] Import/Export (3): IMPORT_CHROME_BOOKMARKS, IMPORT_BACKUP, EXPORT_BACKUP — all with correct fields
6. [PASS] BackgroundResponse: success/failure discriminated union with optional data/code
7. [PASS] SessionState: isUnlocked, activeSetId, sets (readonly PasswordSetInfo[]), tree (BookmarkTree | null), incognitoMode
8. [PASS] handleMessage exhaustive switch with never check
9. [PASS] Non-core handlers return { success: false, error: 'NOT_IMPLEMENTED', code: '<type>' }
10. [PASS] wxt.config.ts gains: alarms permission, incognito: 'spanning', commands config

### Verification Results

```
$ npx tsc --noEmit
(clean — 0 errors)

$ npx eslint .
(clean — 0 errors)

$ npx vitest run
Test Files  32 passed (32)
Tests       630 passed (630)

$ npx wxt build
✔ Finished in 13.7s
Manifest: alarms in permissions, incognito: "spanning", commands._execute_action present

$ npx playwright test
101 passed (2.1m)
```

---

## Session: 2026-03-11T17:20:00Z

**Task**: BG-002 - Unlock/Lock handlers with chrome.storage.session and auto-lock alarm
**Status**: PASSED (attempt 1)

### Work Done
- Implemented `handleUnlock`: getActiveSetId → loadSetData → JSON.parse → listSets → determineMode → storage.session.set → cache password → alarms.create → return SessionState
- Implemented `handleLock`: null password → storage.session.clear → alarms.clear → success
- Implemented `handleGetState`: check cachedPassword → storage.session.get → return stored or locked state
- Exported `onAlarmFired` for auto-lock alarm → calls handleLock
- Registered alarms.onAlarm listener in defineBackground
- Two-tier security: password in SW memory only (cachedPassword), tree/metadata in chrome.storage.session
- Updated E2E tests: GET_STATE and LOCK now expect success (not NOT_IMPLEMENTED)
- Added 3 new BG-002 E2E tests: locked state on fresh load, LOCK idempotent, UNLOCK error path

### Files Modified

| File | Changes |
| --- | --- |
| `entrypoints/background.ts` | Added handleUnlock, handleLock, handleGetState, onAlarmFired. Constants: AUTO_LOCK_ALARM, DEFAULT_AUTO_LOCK_MINUTES, SESSION_KEY, LOCKED_STATE. Imports from password-sets, incognito, errors. 63→163 lines. |
| `tests/unit/entrypoints/background.test.ts` | Added 9 new tests (cycles 1-9): UNLOCK success/persistence/password-not-in-storage/alarm/invalid-password, LOCK clears-state/clears-alarm, auto-lock alarm fires, GET_STATE locked/unlocked. 15→24 tests. |
| `tests/e2e/background-message.test.ts` | Updated GET_STATE test to expect success with isUnlocked:false. Updated LOCK test to expect success. Added BG-002 describe block with 3 E2E tests. 6→9 E2E tests. |

### Acceptance Criteria Verification

1. [PASS] Tree in chrome.storage.session (survives SW restart) — test: "persists state to chrome.storage.session"
2. [PASS] Password in SW memory ONLY (never in any storage) — test: "does not persist password to storage.session"
3. [PASS] UNLOCK: loadSetData → JSON.parse → chrome.storage.session.set → cache pw → alarm → SessionState — test: "decrypts active set and returns SessionState"
4. [PASS] UNLOCK wrong password: { success: false, error: 'Invalid password', code: 'INVALID_PASSWORD' } — test: "returns INVALID_PASSWORD for wrong password"
5. [PASS] LOCK: chrome.storage.session.clear() + null pw → clear alarm — tests: "clears session state" + "clears auto-lock alarm"
6. [PASS] Auto-lock: chrome.alarms.create(AUTO_LOCK_ALARM, { delayInMinutes }) — test: "starts auto-lock alarm"
7. [PASS] chrome.alarms.onAlarm triggers LOCK — test: "locks session when auto-lock alarm fires"
8. [PASS] GET_STATE reads from chrome.storage.session — tests: "returns locked state" + "returns session state after unlock"
9. [PASS] SW termination → locked state (password lost = correct) — GET_STATE returns LOCKED_STATE when cachedPassword is null

### Security Checklist

- [x] Password NEVER written to chrome.storage.session or any storage
- [x] Password stored ONLY in module-level `cachedPassword` variable (SW memory)
- [x] `cachedPassword = null` on LOCK — explicit wipe
- [x] SW termination → cachedPassword lost → GET_STATE returns locked (correct)
- [x] InvalidPasswordError → user-facing "Invalid password" (no stack traces, no PII)
- [x] captureException NOT called for InvalidPasswordError (user error, not bug)
- [x] No console.log in production code
- [x] Error messages contain zero PII
- [x] `import type` used for all type-only imports

### Verification Results

```
$ npx tsc --noEmit
(clean — 0 errors)

$ npx eslint .
(clean — 0 errors)

$ npx vitest run
Test Files  32 passed (32)
Tests       637 passed (637)

$ npx wxt build
✔ Finished in 11.5s

$ npx playwright test
104 passed (2.0m)
```

---

## Session: 2026-03-11T18:10:00Z

**Task**: BG-003 - SAVE and ADD_BOOKMARK handlers with alarm reset
**Status**: PASSED (attempt 1)

### Work Done
- Implemented `handleSave`: validates cachedPassword → JSON.stringify(tree) → saveSetData → update chrome.storage.session → resetAlarm
- Implemented `handleAddBookmark`: validates cachedPassword + tree → addBookmark from data-model → JSON.stringify → saveSetData → update session → resetAlarm → return updated tree
- Extracted `resetAlarm()` helper: clear + create alarm (DRY for SAVE and ADD_BOOKMARK)
- Extracted `getSessionState()` helper: reads SessionState from browser.storage.session (reused by handleGetState, handleSave, handleAddBookmark)
- Refactored `handleGetState` to use `getSessionState()` helper
- Updated switch: SAVE → handleSave, ADD_BOOKMARK → handleAddBookmark
- Updated UNIMPLEMENTED_TYPES: removed SAVE and ADD_BOOKMARK (13→11)
- Added mocks for `saveSetData` and `addBookmark` in test setup

### Files Modified

| File | Changes |
| --- | --- |
| `entrypoints/background.ts` | +saveSetData import, +addBookmark import, +SaveMessage/AddBookmarkMessage type imports, +resetAlarm helper, +getSessionState helper, +handleSave, +handleAddBookmark, refactored handleGetState. 158→223 lines. |
| `tests/unit/entrypoints/background.test.ts` | +saveSetData mock, +addBookmark mock, +DataModelError import, UNIMPLEMENTED_TYPES 13→11, +5 SAVE tests, +5 ADD_BOOKMARK tests, +3 CodeRabbit edge-case tests. 316→536 lines (39 total tests). |

### Acceptance Criteria Verification

1. [PASS] SAVE: JSON.stringify(tree) → saveSetData → update chrome.storage.session → reset alarm — test: "serializes tree with JSON.stringify before saveSetData"
2. [PASS] ADD_BOOKMARK: addBookmark(tree, parentPath ?? [], bookmark) → save → update session → reset alarm → return tree — test: "adds bookmark to tree and saves"
3. [PASS] JSON.stringify before saveSetData, explicit everywhere — verified via mock assertion on saveSetData args
4. [PASS] Both error when no cached password — tests: "returns NOT_UNLOCKED when no cached password" (×2)
5. [PASS] Alarm reset on every successful mutation — tests: "resets auto-lock alarm on success" (×2)

### CodeRabbit Review Findings (3 edge-case tests added)

1. SAVE with null session state (cached password but cleared session) — covers `!state` branch
2. ADD_BOOKMARK with null tree in session state — covers `!state.tree` guard
3. ADD_BOOKMARK when saveSetData fails — verifies session NOT updated on partial failure

### Verification Results

```
$ npx tsc --noEmit
(clean — 0 errors)

$ npx eslint .
(clean — 0 errors)

$ npx vitest run
Test Files  32 passed (32)
Tests       652 passed (652)
```

---

## Session: 2026-03-12T19:40:00Z

**Task**: BG-004 - Context menu, incognito detection, and Sentry error wiring
**Status**: PASSED (attempt 1)

### Work Done
- Implemented `handleGetIncognitoState`: browser.extension.isAllowedIncognitoAccess → determineMode → return mode
- Implemented `registerContextMenu`: removeAll → create('Add to Hush', ['page', 'link']) → addListener(onContextMenuClicked)
- Implemented `onContextMenuClicked`: guards menuItemId, extracts url/title from info+tab, dispatches ADD_BOOKMARK with parentPath: []
- Wired GET_INCOGNITO_STATE into handleMessage switch (no longer returns NOT_IMPLEMENTED)
- Wired registerContextMenu into defineBackground with .catch(captureException) — handles fakeBrowser throws in test env
- Verified existing initSentry() at line 17 and captureException in 4 error paths (onMessage catch, onAlarmFired, registerContextMenu, onContextMenuClicked)

### Files Modified

| File | Changes |
| --- | --- |
| `entrypoints/background.ts` | +Browser type import, +CONTEXT_MENU_ID, +handleGetIncognitoState, +registerContextMenu, +onContextMenuClicked, wired switch + defineBackground. 223→259 lines. |
| `tests/unit/entrypoints/background.test.ts` | +registerContextMenu/onContextMenuClicked/determineMode/captureException imports, UNIMPLEMENTED_TYPES 11→10, +4 BG-004 tests (context menu registration, click handler, GET_INCOGNITO_STATE, Sentry error wiring). 552→647 lines (42 total tests). |

### Acceptance Criteria Verification

1. [PASS] Context menu: 'Add to Hush', contexts: ['page', 'link'] — test: "registers context menu on startup"
2. [PASS] removeAll() before create — removeAll is first call in registerContextMenu
3. [PASS] Context menu → ADD_BOOKMARK with parentPath: [] — test: "context menu click triggers ADD_BOOKMARK with parentPath: []"
4. [PASS] GET_INCOGNITO_STATE resolves via determineMode() — test: "returns resolved incognito mode"
5. [PASS] Existing initSentry() verified, NOT recreated — line 17, unchanged from BG-001
6. [PASS] captureException wired to error paths — 4 wiring points verified

### Key Decision: fakeBrowser contextMenus

`@webext-core/fake-browser` throws "not implemented" for ALL contextMenus methods. Solution: bundle all contextMenus work into `registerContextMenu()` async function, called via `void registerContextMenu().catch(captureException)` in defineBackground. The throw becomes a rejected promise caught silently by mocked captureException during tests. Individual tests spy on browser.contextMenus methods before calling registerContextMenu directly.

### Verification Results

```
$ npx tsc --noEmit
(clean — 0 errors)

$ npx eslint entrypoints/background.ts tests/unit/entrypoints/background.test.ts
(clean — exit 0, 0 errors)

$ npx vitest run
Test Files  32 passed (32)
Tests       655 passed (655)

$ npx wxt build
✔ Finished in 16.5s
background.ts: 259 lines (≤300 budget)
background-types.ts: 127 lines (≤150 budget)

Deslop review: no AI slop in diff
```

---

## Session: 2026-03-12T21:00:00Z

**Task**: BG-005 - Integration, E2E, and full verification
**Status**: PASSED (attempt 1)

### Work Done
- Fixed INTERNAL_ERROR response: added missing `code` field for consistency with all other error responses
- Added scaffold-smoke test enforcing background.ts ≤300 line budget
- Added 9 new Playwright E2E tests across 2 describe blocks (BG-003/BG-004 + BG-005)
- Full verification suite: tsc, eslint, vitest (656 tests), wxt build, playwright (113 tests)
- Deslop review: zero AI slop in diff
- Tracer bullet analysis: mapped full blast radius (11 browser APIs, 13 lib/ modules, 5 test files)
- Security audit: password never in storage, Sentry PII-safe, no console.log, no type suppressions

### Files Modified

| File | Changes |
| --- | --- |
| `entrypoints/background.ts` | Fixed INTERNAL_ERROR: added `code: 'INTERNAL_ERROR'`, human-readable error message. 259→260 lines. |
| `tests/e2e/background-message.test.ts` | +9 E2E tests: SAVE/ADD_BOOKMARK not-unlocked, GET_INCOGNITO_STATE, NOT_IMPLEMENTED shape, contextMenus permission, SW active, sequential consistency, NOT_IMPLEMENTED consistency, rapid messages. 121→280 lines. |
| `tests/unit/entrypoints/background.test.ts` | Updated INTERNAL_ERROR assertion to match new response shape. |
| `tests/unit/integration/scaffold-smoke.test.ts` | +background.ts ≤300 line budget test. 629→634 lines. |

### Acceptance Criteria Verification

1. [PASS] LIB_MODULES = 13 — already enforced since BG-001
2. [PASS] background.ts ≤ 300 lines — 260 lines, now enforced by scaffold-smoke test
3. [PASS] background-types.ts ≤ 150 lines + zero runtime code — 127 lines, enforced by scaffold-smoke
4. [PASS] Built manifest has incognito: 'spanning' + alarms + commands — verified in E2E BG-001 tests
5. [PASS] E2E passes — 113/113 tests (18 background-specific)
6. [PASS] Zero regressions — 656 unit tests, 113 E2E tests all green

### Code Issues Found and Fixed

1. **INTERNAL_ERROR missing code field** (background.ts L254) — only error response without `code` field. Fixed: `{ success: false, error: 'Internal error', code: 'INTERNAL_ERROR' }`
2. **No background.ts line budget test** — background-types.ts had one, background.ts didn't. Fixed: added scaffold-smoke test.
3. **contextMenus.create() not awaited** (background.ts L190) — researched: NOT a bug. `create()` returns ID synchronously per Chrome API. Correct as-is.
4. **onMessage listener pattern** — researched: returning Promise directly (not `return true`) is correct MV3 best practice (Chrome 99+). Correct as-is.

### Verification Results

```
$ npx tsc --noEmit
(clean — 0 errors)

$ npx eslint .
(clean — 0 errors)

$ npx vitest run
Test Files  32 passed (32)
Tests       656 passed (656)

$ npx wxt build
✔ Finished in 33.4s
Total: 607.54 kB

$ npx playwright test
113 passed (5.3m)
```

---

## Module Summary

All 5 stories PASSED on first attempt. Module 9 complete.

| ID | Title | Attempts | Tests Added |
| --- | --- | --- | --- |
| BG-001 | Message protocol types + handler scaffold | 1 | 18 unit + 6 E2E |
| BG-002 | Unlock/Lock + storage.session + auto-lock | 1 | 9 unit + 3 E2E |
| BG-003 | SAVE + ADD_BOOKMARK + alarm reset | 1 | 8 unit |
| BG-004 | Context menu + incognito + Sentry | 1 | 4 unit |
| BG-005 | Integration, E2E, full verification | 1 | 1 unit + 9 E2E |

**Final counts**: 260 lines (background.ts), 127 lines (background-types.ts), 42 unit tests, 18 E2E tests, 656 total unit tests, 113 total E2E tests.
