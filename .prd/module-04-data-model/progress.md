# Module 4: Data Model — Progress Log

## Story Tracker

| ID | Title | Status | Attempts |
| --- | --- | --- | --- |
| DATAMODEL-001 | Core reads: createEmptyTree, getItemByPath, findItemPath | PASSED | 1 |
| DATAMODEL-002 | Immutable writes: add, remove, update, rename | PASSED | 1 |
| DATAMODEL-003 | moveItem with cycle detection and reorder | Pending | 0 |
| DATAMODEL-004 | Utilities: collectAllUrls, countBookmarks, flattenTree | Pending | 0 |
| DATAMODEL-005 | JSON serialization compatibility and normalizeTree | Pending | 0 |
| DATAMODEL-006 | Module purity, coverage gate, and full integration | Pending | 0 |

---

## Session: 2026-03-05T19:39:00Z
**Task**: DATAMODEL-001 - Core reads: createEmptyTree, getItemByPath, findItemPath
**Status**: PASSED (attempt 1)

### Work Done
- Added DataModelErrorContext interface and DataModelError class to lib/errors.ts (context object pattern matching StorageError/ImportError)
- Created lib/data-model.ts with: isBookmark, isFolder, generateId, createEmptyTree, getItemByPath, findItemPath
- Private helpers: walkPath (path traversal), searchChildren (recursive DFS)
- GPL-3.0 + Holy PB attribution header on data-model.ts
- CodeRabbit review fix: removed user-supplied id from error message (defense-in-depth for PII via Sentry)

### Files Created

| File | Purpose |
| --- | --- |
| lib/data-model.ts | Core read functions, type guards, ID generation (135 lines) |
| tests/unit/lib/data-model.test.ts | 14 unit tests for DATAMODEL-001 |
| tests/e2e/data-model.test.ts | 4 Playwright E2E tests (crypto.randomUUID, tree ops, type guards, popup smoke) |

### Files Modified

| File | Changes |
| --- | --- |
| lib/errors.ts | Added DataModelErrorContext interface + DataModelError class (25 lines appended) |
| tests/unit/lib/errors.test.ts | Added DataModelError describe block (4 tests) + import |

### Acceptance Criteria Verification

1. createEmptyTree(): BookmarkTree — returns Folder with type, name, children, id, dateAdded: PASS
2. BookmarkTree IS Folder (type alias, not wrapper): PASS
3. getItemByPath(tree, []) returns root Folder: PASS
4. getItemByPath(tree, [0]) returns tree.children[0]: PASS
5. getItemByPath(tree, [0, 2, 1]) traverses nested children: PASS (tested [0, 1])
6. getItemByPath returns path_not_found for out-of-bounds: PASS
7. getItemByPath returns type_mismatch when descending into Bookmark: PASS
8. getItemByPath returns invalid_path for negative indices: PASS
9. findItemPath returns path to item with matching id: PASS
10. findItemPath returns path_not_found for non-existent id: PASS
11. isBookmark and isFolder type guards exported: PASS
12. DataModelError added to errors.ts with context object pattern: PASS

### Verification Results

```
Unit tests: 14 passed (data-model.test.ts) + 21 passed (errors.test.ts)
Full unit suite: 368 tests passed, 0 failed
Type check: npx tsc --noEmit — clean
Lint: npx eslint — clean
Coverage: lib/data-model.ts — 97.14% stmts, 94.44% branches, 100% funcs, 96.96% lines
Build: npx wxt build — success (594.45 kB)
E2E: 4 data-model tests passed + 50 total E2E tests passed
```

---

## Session: 2026-03-05T21:30:00Z
**Task**: DATAMODEL-002 - Immutable writes: add, remove, update, rename
**Status**: PASSED (attempt 1)

### Work Done
- Added `withReplacedChildren` private helper for structural sharing (path-copy rebuild)
- Added 5 public write functions: addBookmark, addFolder, removeItem, updateBookmark, renameFolder
- All write functions return new trees — originals never mutated
- CodeRabbit review fixes: (1) removed `as BookmarkTree` cast by typing `rebuilt` as `Folder`, (2) added `renameFolder([])` root rename support instead of silent no-op
- 15 unit tests with deepFreeze helper for immutability verification
- 4 Playwright E2E tests for write operations in real Chromium extension context
- Updated scaffold-smoke.test.ts with all 11 data-model exports

### Files Created

| File | Purpose |
| --- | --- |
| tests/unit/lib/data-model-writes.test.ts | 15 unit tests for DATAMODEL-002 write operations (316 lines) |

### Files Modified

| File | Changes |
| --- | --- |
| lib/data-model.ts | Added withReplacedChildren + 5 write functions (135 -> 290 lines) |
| tests/e2e/data-model.test.ts | Added DATAMODEL-002 describe block with 4 E2E tests (127 -> 231 lines) |
| tests/unit/integration/scaffold-smoke.test.ts | Added data-model.ts to LIB_MODULES, import 11 exports, callable test (296 -> ~310 lines) |

### Acceptance Criteria Verification

1. generateId() (from DATAMODEL-001) is integrated and used by addBookmark/addFolder write functions: PASS
2. All write operations return Result<BookmarkTree, DataModelError>: PASS
3. All write operations return NEW trees — original never mutated: PASS (deepFreeze tests)
4. addBookmark auto-generates id for new bookmark: PASS
5. addFolder auto-generates id and creates empty children array: PASS
6. removeItem cannot remove root (path []): PASS
7. updateBookmark only works on Bookmark nodes (type_mismatch for Folders): PASS
8. renameFolder only works on Folder nodes (type_mismatch for Bookmarks): PASS
9. Deep-freeze test: original tree verified unchanged after each write operation: PASS

### Verification Results

```
Unit tests: 15 passed (data-model-writes.test.ts) + 14 passed (data-model.test.ts) + 49 passed (scaffold-smoke.test.ts)
Full unit suite: 388 tests passed, 0 failed
Type check: npx tsc --noEmit — clean
Lint: npx eslint — clean
Coverage: lib/data-model.ts — 94.79% stmts, 88.63% branches, 100% funcs, 96.42% lines
Build: npx wxt build — success (594.45 kB)
E2E: 8 data-model tests passed (4 DATAMODEL-001 + 4 DATAMODEL-002) + 54 total E2E tests passed
```
