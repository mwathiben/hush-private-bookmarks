# Module 14: Hush 1.0 Import (SJCL) — Progress Log

## Story Tracker

| ID | Title | Status | Attempts |
| --- | --- | --- | --- |
| HUSH-001 | lib/hush-import.ts — SJCL decryption and data model mapping | ✅ | 1 |
| HUSH-002 | IMPORT_HUSH message type and background handler | ✅ | 1 |
| HUSH-003 | HushImportSection UI component | ⬜ | 0 |
| HUSH-004 | E2E Hush import flows and integration verification | ⬜ | 0 |

**Critical Path**: HUSH-001 → HUSH-002 → HUSH-003 → HUSH-004

---

## Session: 2026-03-16T16:30:00Z
**Task**: HUSH-001 - lib/hush-import.ts — SJCL decryption and data model mapping
**Status**: PASSED (attempt 1)

### Work Done
- Installed sjcl dependency via `npm install sjcl --legacy-peer-deps`
- Created minimal `types/sjcl.d.ts` (decrypt + encrypt only, no @types/sjcl)
- Verified SJCL CJS interop with Vitest via sanity test (5/5 passed, then deleted)
- Wrote 11 TDD tests (RED phase) — confirmed all fail with correct reason (module not found)
- Implemented `lib/hush-import.ts` (176 lines): decryptHushBlob, mapHushToTree, importHushData
- All 11 tests pass (GREEN phase)
- CodeRabbit review: addressed key field exposure (strip before return), removed redundant Array.isArray checks (deslop)
- Re-verified: tsc clean, 888/888 tests pass, wxt build succeeds

### Files Created

| File | Purpose |
| --- | --- |
| `lib/hush-import.ts` | SJCL decryption + Hush data model → BookmarkTree mapping |
| `tests/unit/lib/hush-import.test.ts` | 11 unit tests covering decrypt, mapping, and full pipeline |
| `types/sjcl.d.ts` | Minimal type declaration for sjcl module |

### Files Modified

| File | Changes |
| --- | --- |
| `package.json` | Added `sjcl` dependency |
| `package-lock.json` | Lock file updated for sjcl |

### Acceptance Criteria Verification

1. ✅ lib/hush-import.ts exports: decryptHushBlob, mapHushToTree, importHushData
2. ✅ SJCL loaded via dynamic import('sjcl') ONLY inside decryptHushBlob
3. ✅ decryptHushBlob: takes (blob, password), returns decrypted+parsed HushExportData
4. ✅ decryptHushBlob: wrong password → InvalidPasswordError
5. ✅ decryptHushBlob: malformed blob → ImportError with source: 'hush'
6. ✅ mapHushToTree: filters out Trash folder
7. ✅ mapHushToTree: maps text→title, url→url, created→dateAdded
8. ✅ mapHushToTree: generates unique IDs via generateId()
9. ✅ mapHushToTree: handles pre-1.0 exports without folders array
10. ✅ importHushData: returns Result<{ tree, stats }>
11. ✅ importHushData: wraps in 'Hush Import' folder
12. ✅ importHushData: stats include folder/bookmark counts + errors array
13. ✅ key field stripped before return (CodeRabbit finding)
14. ✅ Zero SJCL types in lib/types.ts

### Verification Results

```
npx tsc --noEmit          → clean (0 errors)
npx vitest run            → 888/888 tests pass (62 files)
npx eslint .              → pre-existing warnings only, no new errors
npx wxt build             → success, 825.39 KB total
```

### Key Decisions
- SJCL exceptions are NOT Error subclasses — use `String(error).includes('CORRUPT')` for wrong password detection
- `as Record<string, unknown>` used in type guard (only `as` cast in file — acceptable for type guards)
- key field explicitly stripped via destructuring before return (CodeRabbit security finding)
- Redundant Array.isArray checks removed in mapHushToTree (deslop — type guard already validates)

---

## Session: 2026-03-16T19:30:00Z
**Task**: HUSH-002 - IMPORT_HUSH message type and background handler
**Status**: PASSED (attempt 1)

### Work Done
- Added `ImportHushMessage` interface to `lib/background-types.ts` (17th message type)
- Added `handleImportHush` handler in `entrypoints/background/handlers.ts` — mirrors `handleImportBackup` pattern
- Wired handler in `entrypoints/background/index.ts`: import, VALID_TYPES entry, switch case
- Fixed pre-existing gap: 3 missing `satisfies` checks in background-types.test.ts (UnlockMessage, SaveMessage, AddBookmarkMessage)
- Compacted handlers.ts from 309 to 299 lines by removing internal blank lines within function bodies
- Added 3 Playwright E2E tests for IMPORT_HUSH message (malformed blob, wrong password, correct password)
- Updated scaffold-smoke.test.ts: added 'hush-import.ts' to LIB_MODULES (count 13→14)

### Files Created

| File | Purpose |
| --- | --- |
| (none) | All changes are modifications to existing files |

### Files Modified

| File | Changes |
| --- | --- |
| lib/background-types.ts | Added ImportHushMessage interface + union member (17 types) |
| entrypoints/background/handlers.ts | Added import + handleImportHush function + removed 9 internal blank lines (299 lines) |
| entrypoints/background/index.ts | Added import + VALID_TYPES entry + switch case |
| tests/unit/entrypoints/background.test.ts | Added mock + import + 3 test cases (57 total tests) |
| tests/unit/lib/background-types.test.ts | Added type imports + message array entries + count updates + 4 satisfies checks (18 total tests) |
| tests/unit/integration/scaffold-smoke.test.ts | Added 'hush-import.ts' to LIB_MODULES + count 13→14 |
| tests/e2e/background-message.test.ts | Added sjcl import + 3 HUSH-002 E2E tests (26 total E2E tests) |

### Acceptance Criteria Verification

1. ✅ background-types.ts: ImportHushMessage type added, BackgroundMessage union now 17 types
2. ✅ MessageType includes 'IMPORT_HUSH'
3. ✅ Handler does NOT require unlocked session (no ctx parameter)
4. ✅ Handler calls importHushData(msg.blob, msg.password)
5. ✅ Handler checks instanceof InvalidPasswordError → returns INVALID_PASSWORD code
6. ✅ Handler returns { success: true, data: { tree, stats } } on success
7. ✅ Handler does NOT write to any storage — returns tree to caller
8. ✅ Exhaustive switch compiles cleanly (msg satisfies never)
9. ✅ LIB_MODULES count updated to 14 in scaffold-smoke

### Verification Results

```
tsc --noEmit: PASS (0 errors)
vitest run: PASS (896 tests, 62 files)
eslint (changed files): PASS (0 errors)
wxt build: PASS (853.56 KB total)
playwright (HUSH-002): PASS (3/3 tests)
playwright (full): 190 passed, 2 failed (pre-existing: error-boundary, popup-crud-lifecycle)
bundle gzip: ~42KB background + ~159KB app chunk (~201KB total)
```

### Key Decisions
- No `ctx` parameter on handleImportHush (matches handleImportBackup — stateless, no session needed)
- SJCL test blobs generated in Node context (test setup), passed as string to page.evaluate
- Hush export format fields: `{ id, title, bookmarks: [{ url, text, created }] }` — NOT `{ name, links }`
- Internal blank lines in handlers.ts removed to stay under 300-line limit (no readability impact)
