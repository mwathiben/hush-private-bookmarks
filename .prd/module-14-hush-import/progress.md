# Module 14: Hush 1.0 Import (SJCL) — Progress Log

## Story Tracker

| ID | Title | Status | Attempts |
| --- | --- | --- | --- |
| HUSH-001 | lib/hush-import.ts — SJCL decryption and data model mapping | ✅ | 1 |
| HUSH-002 | IMPORT_HUSH message type and background handler | ⬜ | 0 |
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
