# Module 15a: Sync Client - Progress Log

## Story Tracker

| ID | Title | Status | Attempts |
| --- | --- | --- | --- |
| SYNC-001 | Sync types, SyncableFeature interface, and SyncError class | PASSED | 1 |
| SYNC-002 | Sync client — HTTPS API client with conflict resolution | PASSED | 1 |
| SYNC-003 | Offline sync queue with retry | PASSED | 1 |
| SYNC-004 | Background sync handlers and integration verification | PASSED | 1 |

**Critical Path**: SYNC-001 → SYNC-002 → SYNC-003 → SYNC-004

---

## Session: 2026-03-17T11:00:00Z
**Task**: SYNC-001 - Sync types, SyncableFeature interface, and SyncError class
**Status**: PASSED (attempt 1)

### Work Done
- Created `lib/sync-types.ts` — types-only module with SyncableFeature, SyncConfig, SyncStatus, SyncResult, SyncConflict
- Added SyncErrorContext interface + SyncError class to `lib/errors.ts` following established error class pattern
- Created `tests/unit/lib/sync-types.test.ts` — 14 tests covering all types + module purity
- Added SyncError test suite to `tests/unit/lib/errors.test.ts` — 5 tests (instanceof, name, context, empty context, cause chaining)
- Updated `tests/unit/integration/scaffold-smoke.test.ts` — LIB_MODULES array, length assertion, SyncError instantiation, SyncErrorContext typed context test, sync-types.ts architecture constraints (100-line limit, zero external deps, zero browser APIs)
- PRD discrepancy resolved: scaffold-smoke updated in SYNC-001 (not SYNC-004 as PRD stated) because adding sync-types.ts to lib/ immediately breaks the toHaveLength(14) assertion

### Files Created

| File | Purpose |
| --- | --- |
| `lib/sync-types.ts` | Types-only module: SyncableFeature, SyncConfig, SyncStatus, SyncResult, SyncConflict |
| `tests/unit/lib/sync-types.test.ts` | 14 unit tests covering all types + module purity checks |

### Files Modified

| File | Changes |
| --- | --- |
| `lib/errors.ts` | Added SyncErrorContext interface + SyncError class (~20 lines, after RecoveryError) |
| `tests/unit/lib/errors.test.ts` | Added SyncError import + 5-test describe block |
| `tests/unit/integration/scaffold-smoke.test.ts` | Added SyncError/SyncErrorContext imports, 'sync-types.ts' to LIB_MODULES, toHaveLength(15), SyncError instantiation, SyncErrorContext typed context test, 3 sync-types.ts architecture constraint tests |

### Acceptance Criteria Verification

1. lib/sync-types.ts is TYPES ONLY — PASS (verified by purity tests: zero runtime code, import type only)
2. SyncableFeature interface: featureId, serialize, deserialize, requiresServer — PASS
3. SyncableFeature JSDoc: plaintext + caller encrypts — PASS
4. SyncConfig: backendUrl, authToken, syncIntervalMs — PASS
5. SyncStatus: 5 states (idle, syncing, error, offline, not_configured) — PASS
6. SyncResult: uses Result<T,E> from lib/types.ts — PASS
7. SyncConflict: local/remote blobs + timestamps — PASS
8. SyncError class in errors.ts: readonly name, SyncErrorContext with code — PASS
9. SyncError follows established pattern — PASS (identical to StorageError/ImportError/RecoveryError/DataModelError)
10. Passes lib/ purity check — PASS (zero React/DOM/browser.storage)

### Verification Results

```
tsc --noEmit: clean (zero errors)
vitest run (targeted): 163 tests pass (errors: 26, sync-types: 14, scaffold-smoke: 123)
vitest run (full suite): 938 tests pass, 64 test files, 0 failures
eslint: clean (zero errors)
wxt build: success (855KB uncompressed)
playwright E2E: 200 tests pass, 0 failures
CodeRabbit review: "Ship it" — no blockers
Deslop review: "Clean" — zero slop detected
```

### Research Applied
- Uint8Array<ArrayBuffer> explicit generic (TS 5.7+ requirement, prevents ArrayBufferLike bugs)
- Discriminated union vs simpler SyncStatus — followed PRD (simpler type sufficient for dormant v1.0)
- Branded types (PlaintextBlob/EncryptedBlob) — deferred to SYNC-002+ as future enhancement
- import type for SyncError reference maintains types-only purity

---

## Session: 2026-03-17T12:00:00Z
**Task**: SYNC-001 follow-up — Apply research findings to sync types
**Status**: PASSED (attempt 1)

### Work Done
- Added branded types `PlaintextBlob` and `EncryptedBlob` for compile-time encryption boundary enforcement
- Converted flat `SyncStatus` to 5-variant discriminated union eliminating impossible states
- Changed `SyncStatus.error` from free-form `string` to `NonNullable<SyncErrorContext['code']>` (single source of truth, PII-safe)
- Added `featureId: string` to `SyncConflict` for multi-feature conflict identification
- Added `'CONFLICT'` to `SyncErrorContext.code` union in `lib/errors.ts`
- Updated `SyncableFeature.serialize/deserialize` to use `PlaintextBlob`
- Updated `SyncConflict.local/remote` to use `EncryptedBlob`
- Updated all tests: 6 new tests added (branded blob types, CONFLICT code, first-ever sync, constrained error code, idle lastSyncAt, not_configured no lastSyncAt)

### Files Modified

| File | Changes |
| --- | --- |
| `lib/sync-types.ts` | Added PlaintextBlob/EncryptedBlob branded types, discriminated union SyncStatus, featureId on SyncConflict, updated SyncableFeature to use PlaintextBlob |
| `lib/errors.ts` | Added 'CONFLICT' to SyncErrorContext.code union (line 89) |
| `tests/unit/lib/sync-types.test.ts` | Added branded blob tests, updated SyncableFeature/SyncConflict/SyncStatus tests (19 tests total, was 14) |
| `tests/unit/lib/errors.test.ts` | Added CONFLICT code test (27 tests total, was 26) |

### Verification Results

```
tsc --noEmit: clean (zero errors)
vitest run (targeted): 168 tests pass (sync-types: 19, errors: 27, scaffold-smoke: 123)
vitest run (full suite): 944 tests pass, 64 test files, 0 failures
eslint: clean (zero errors)
wxt build: success (855KB uncompressed)
playwright E2E: 200 tests pass, 0 failures
CodeRabbit review: no blockers — noted authToken PII concern for SYNC-002, SyncErrorCode alias nice-to-have
Deslop review: clean — zero slop detected
```

### CodeRabbit Findings for Future Stories
- `SyncConfig.authToken` is plain `string` — consider branded `AuthToken` type or ensure it never reaches Sentry context
- Consider extracting `SyncErrorCode = NonNullable<SyncErrorContext['code']>` named alias for greppability
- `SyncConflict` blobs are `EncryptedBlob` (intentional — last-write-wins at encrypted level, no per-field merge planned)

---

## Session: 2026-03-17T13:00:00Z
**Task**: SYNC-002 - Sync client — HTTPS API client with conflict resolution
**Status**: PASSED (attempt 1)

### Work Done
- Created `lib/sync-client.ts` — 152-line module with 4 exports + 4 private helpers
- Exports: `uploadBlob`, `downloadBlob`, `resolveConflict`, `getSyncStatus`
- Private: `buildUrl` (URL normalization + HTTPS enforcement), `authHeaders`, `fetchWithTimeout` (AbortSignal.timeout), `mapHttpError`
- Created `tests/unit/lib/sync-client.test.ts` — 37 tests covering all exports + module purity
- Created `tests/e2e/sync-client-build.test.ts` — 2 E2E tests (extension loads, service worker active)
- Updated `tests/unit/integration/scaffold-smoke.test.ts` — added 'sync-client.ts' to LIB_MODULES, count 15→16
- Security: HTTPS validation, generic error messages (no PII), Number.isFinite() timestamp validation, URL normalization
- Error mapping: TypeError→NETWORK_ERROR, TimeoutError/AbortError→TIMEOUT, 401→AUTH_FAILED, 409→CONFLICT, 5xx→SERVER_ERROR
- DOMException name detection: used `error.name` check (not `instanceof DOMException`) for jsdom compatibility

### Files Created

| File | Purpose |
| --- | --- |
| `lib/sync-client.ts` | HTTPS API client: uploadBlob, downloadBlob, resolveConflict, getSyncStatus |
| `tests/unit/lib/sync-client.test.ts` | 37 unit tests with mocked fetch + module purity checks |
| `tests/e2e/sync-client-build.test.ts` | 2 Playwright E2E tests: extension loads + service worker active |

### Files Modified

| File | Changes |
| --- | --- |
| `tests/unit/integration/scaffold-smoke.test.ts` | Added 'sync-client.ts' to LIB_MODULES array, toHaveLength(15)→toHaveLength(16) |

### Acceptance Criteria Verification

1. Exports: uploadBlob, downloadBlob, resolveConflict, getSyncStatus — PASS
2. uploadBlob: POST with Bearer auth, octet-stream body, returns SyncResult — PASS
3. downloadBlob: GET with Bearer auth, returns { blob, timestamp } | null — PASS
4. resolveConflict: last-write-wins, local wins ties — PASS
5. getSyncStatus: returns SyncStatus based on config + health check — PASS
6. Zero crypto imports — sync client is opaque blob transport — PASS (module purity test)
7. All network calls use fetch() — PASS
8. Uses SyncError from lib/errors.ts with appropriate context codes — PASS

### Verification Results

```
tsc --noEmit: clean (zero errors)
vitest run (targeted): 37 tests pass (sync-client: 37)
vitest run (full suite): 990 tests pass, 65 test files, 0 failures
eslint (changed files): clean (zero errors)
wxt build: success (855KB uncompressed)
playwright E2E: 202 tests pass, 0 failures (was 200, +2 new)
```

### Research Applied
- fetch API error classification: TypeError = network (rejects), DOMException TimeoutError/AbortError = timeout (rejects), HTTP errors resolve (check response.ok)
- AbortSignal.timeout(30_000): Chrome 103+, Node 17.3+ — cleaner than manual AbortController
- DOMException instanceof fails in jsdom — use error.name check (same lesson as crypto OperationError)
- HTTPS enforcement: defense-in-depth, prevents auth token over HTTP
- Number.isFinite() for X-Sync-Timestamp validation (catches NaN, Infinity)
- URL normalization: strip trailing slash prevents //sync/upload

---

## Session: 2026-03-17T14:00:00Z
**Task**: SYNC-003 - Offline sync queue with retry
**Status**: PASSED (attempt 1)

### Work Done
- Created `entrypoints/background/sync-queue.ts` — 202 lines, module functions (not class), async mutex, full jitter backoff
- Created `tests/unit/entrypoints/sync-queue.test.ts` — 27 tests across 11 TDD slices
- Created `tests/e2e/sync-queue-build.test.ts` — 3 Playwright E2E tests (load, service worker, storage key conflict)
- Updated `tests/unit/integration/scaffold-smoke.test.ts` — added sync-queue.ts to background file size check
- TDD vertical slices: getQueueSize/clearQueue → enqueue → drain success → drain auth failure → drain retryable+backoff → drain backoff skip → drain concurrency/mutex → empty queue → CONFLICT → blobToBase64 → module purity

### Files Created

| File | Purpose |
| --- | --- |
| `entrypoints/background/sync-queue.ts` | Offline queue with retry, exponential backoff + full jitter, async mutex |
| `tests/unit/entrypoints/sync-queue.test.ts` | 27 unit tests covering all queue behaviors |
| `tests/e2e/sync-queue-build.test.ts` | 3 Playwright E2E tests for build integration |

### Files Modified

| File | Changes |
| --- | --- |
| `tests/unit/integration/scaffold-smoke.test.ts` | Added sync-queue.ts to background file size check (line 662) |

### Acceptance Criteria Verification

1. File lives in entrypoints/background/ (NOT lib/) — PASS
2. Persists to browser.storage.local (survives SW restart) — PASS
3. Uses browser from wxt/browser — PASS (module purity test confirms)
4. FIFO order for drain operations — PASS (test: processes items in FIFO order)
5. Exponential backoff: 1s base, 2x multiplier, 300s max — PASS (with full jitter per AWS recommendation)
6. Max queue depth: 50 — PASS (test: drops oldest when exceeding MAX_QUEUE_DEPTH)
7. Max retries per operation: 10 — PASS (test: removes item after MAX_RETRIES)
8. AUTH_FAILED not retried — PASS (test: removes AUTH_FAILED items, continues processing)
9. Network errors retried with backoff — PASS (test: increments retryCount on NETWORK_ERROR)
10. getQueueSize() returns current queue depth — PASS
11. clearQueue() removes all pending operations — PASS

### Verification Results

```
tsc --noEmit: clean (zero errors)
vitest run (targeted): 27 tests pass (sync-queue: 27)
vitest run (full suite): 1019 tests pass, 66 test files, 0 failures
eslint: zero new errors (16 pre-existing in take-settings-screenshots.mjs)
wxt build: success (855KB uncompressed)
playwright E2E (sync-queue): 3 tests pass, 0 failures
security audit: 11/11 items pass
```

### Design Decisions Applied
- Module functions (not class) — matches codebase pattern (storage.ts, sync-client.ts)
- Dependency injection: drain(config, upload) takes upload function as parameter
- Async mutex (promise chain) — prevents read-then-write race on browser.storage.local
- Full jitter: Math.floor(Math.random() * Math.min(BACKOFF_MAX_MS, BACKOFF_BASE_MS * 2**retryCount))
- nextRetryAt field on queue items (not setTimeout) — testable with vi.useFakeTimers()
- Stop-on-first-retryable-failure: saves network resources when offline
- Base64 helpers local to sync-queue.ts (not imported from crypto.ts internals)
- _resetForTesting() export: resets module-level draining flag and storageLock between tests

---

## Session: 2026-03-17T16:00:00Z
**Task**: SYNC-003 follow-up — Apply CodeRabbit review findings
**Status**: PASSED (attempt 1)

### Work Done
- Ran CodeRabbit code review agent on SYNC-003 implementation
- Fixed Issue #2: Added `isQueueItem()` type guard — `readQueue()` now validates element shape, filtering out malformed items instead of blindly casting `as QueueItem[]`
- Fixed Issue #5: Non-SyncError errors in `result.error` now treated as retryable (was silently ignored, creating permanently stuck queue items)
- Refactored duplicate retry logic: unified SyncError retryable path and non-SyncError fallback into single block (removed 9 lines of duplication)
- Restored `break` after retryable failure (was accidentally changed to `continue`, breaking stop-on-first-retryable-failure design)
- Added 3 new tests: malformed storage filtering, non-SyncError error handling, upload rejection behavior

### Files Modified

| File | Changes |
| --- | --- |
| `entrypoints/background/sync-queue.ts` | Added `isQueueItem()` type guard (+12 lines), unified retry logic, restored `break` semantics. 223→214 lines. |
| `tests/unit/entrypoints/sync-queue.test.ts` | Added 3 edge-case tests: malformed storage, non-SyncError error, upload throws (+56 lines). 27→30 tests. |
| `.prd/module-15a-sync-client/process-lessons.md` | Added lessons 17-18 (storage validation, non-SyncError handling) |

### CodeRabbit Findings Triage

| Issue | Severity | Action |
| --- | --- | --- |
| #1 Math.random() for jitter | Low | No change — scheduling jitter, not crypto |
| #2 `as QueueItem[]` on untrusted storage | Critical | FIXED — added `isQueueItem()` type guard |
| #3 Head-of-line blocking | High | No change — deliberate design (stop-on-first-retryable-failure) |
| #4 CONFLICT counted as processed | High | No change — matches plan's DrainResult interface |
| #5 Non-SyncError fallthrough | Critical | FIXED — unified retry block handles all error types |
| #6 withLock error chaining | Medium | No change — pattern is correct, subtle but intentional |

### Verification Results

```
tsc --noEmit: clean (zero errors)
vitest run (targeted): 30 tests pass (sync-queue: 30)
vitest run (full suite): 1022 tests pass, 66 test files, 0 failures
eslint: clean (zero errors)
wxt build: success (855KB uncompressed)
playwright E2E (sync-queue): 3 tests pass, 0 failures
deslop review: removed duplicate retry logic, restored break semantics
```

---

## Session: 2026-03-17T18:00:00Z
**Task**: SYNC-004 - Background sync handlers and integration verification
**Status**: PASSED (attempt 1)

### Work Done
- Added 3 new message interfaces to `lib/background-types.ts`: SyncUploadMessage, SyncDownloadMessage, SyncStatusMessage
- Extended BackgroundMessage union with 3 new members (17→20 types)
- Created `entrypoints/background/sync-handlers.ts` — 101 lines: 3 handler functions, loadSyncConfig, isSyncConfig type guard, base64 helpers, mapError
- Wired sync handlers into `entrypoints/background/index.ts`: import, VALID_TYPES entries, 3 switch cases
- Created `tests/unit/entrypoints/sync-handlers.test.ts` — 28 tests across 4 describe blocks using fakeBrowser from wxt/testing
- Created `tests/e2e/sync-handlers.test.ts` — 5 Playwright E2E tests (extension load, service worker, SYNC_STATUS/UPLOAD/DOWNLOAD all return SYNC_NOT_CONFIGURED)
- Updated scaffold-smoke.test.ts: 3 type instantiation tests, bumped background-types.ts limit 150→170, added sync-handlers.ts to background file size check
- Updated background-types.test.ts: bumped line limit 150→170

### Files Created

| File | Purpose |
| --- | --- |
| `entrypoints/background/sync-handlers.ts` | 3 handler functions + loadSyncConfig + isSyncConfig type guard + base64 helpers |
| `tests/unit/entrypoints/sync-handlers.test.ts` | 28 unit tests: not-configured path, config validation, configured path, module purity |
| `tests/e2e/sync-handlers.test.ts` | 5 Playwright E2E tests: extension load, SW register, 3 message handlers |

### Files Modified

| File | Changes |
| --- | --- |
| `lib/background-types.ts` | +3 interfaces (SyncUploadMessage, SyncDownloadMessage, SyncStatusMessage), extended union (136→152 lines) |
| `entrypoints/background/index.ts` | +1 import, +3 VALID_TYPES entries, +3 switch cases (175→184 lines) |
| `tests/unit/integration/scaffold-smoke.test.ts` | +3 type instantiation tests, bumped limit 150→170, added sync-handlers.ts size check |
| `tests/unit/lib/background-types.test.ts` | Bumped line limit 150→170 |

### Acceptance Criteria Verification

1. 3 new message types (SYNC_UPLOAD, SYNC_DOWNLOAD, SYNC_STATUS) added to BackgroundMessage union — PASS
2. sync-handlers.ts exports handleSyncUpload, handleSyncDownload, handleSyncStatus — PASS
3. All handlers return SYNC_NOT_CONFIGURED when no valid SyncConfig in storage — PASS
4. loadSyncConfig validates storage data field-by-field (not just type assertion) — PASS
5. handleSyncUpload validates timestamp (NaN, Infinity, negative rejected) — PASS
6. handleSyncUpload converts base64→Uint8Array, calls uploadBlob — PASS
7. handleSyncDownload converts Uint8Array→base64, returns blob string — PASS
8. handleSyncStatus calls getSyncStatus and returns status data — PASS
9. All error paths use mapError (SyncError→code+message, non-SyncError→generic message) — PASS
10. Zero crypto imports in sync-handlers.ts — PASS (module purity test)
11. msg satisfies never compiles cleanly (exhaustive switch) — PASS
12. E2E: extension builds and loads with sync-handlers bundled — PASS
13. E2E: all 3 message types return SYNC_NOT_CONFIGURED via runtime.sendMessage — PASS

### Verification Results

```
tsc --noEmit: clean (zero errors)
vitest run (full suite): 1050 tests pass, 67 test files, 0 failures
eslint (changed files): clean (zero errors)
wxt build: success (859.87 KB uncompressed)
playwright E2E (sync-handlers): 5 tests pass, 0 failures
playwright E2E (full suite): 210 tests pass, 0 failures
security audit: no authToken in error messages, no console.log, no type suppressions
```

### Design Decisions Applied
- Separate sync-handlers.ts (not handlers.ts) — handlers.ts at 299/300 line limit
- fakeBrowser from wxt/testing (not manual vi.mock) — matches sync-queue.test.ts pattern
- isSyncConfig type guard validates each field individually (per Lesson 17)
- mapError handles non-SyncError gracefully (per Lesson 18)
- base64 helpers local to sync-handlers.ts (same pattern as sync-queue.ts)
- NOT_CONFIGURED as module-level const (shared across all 3 handlers)

---

## Module Summary

**Module 15a: Sync Client** — ALL 4 STORIES PASSED (4/4)

| Story | Title | Tests Added | Lines Created |
| --- | --- | --- | --- |
| SYNC-001 | Sync types + SyncError class | 25 (14+5+6) | ~100 (lib/sync-types.ts + error additions) |
| SYNC-002 | HTTPS API client | 39 (37+2) | ~155 (lib/sync-client.ts + tests) |
| SYNC-003 | Offline sync queue with retry | 33 (30+3) | ~220 (sync-queue.ts + tests) |
| SYNC-004 | Background sync handlers | 33 (28+5) | ~190 (sync-handlers.ts + tests + type additions) |

**Totals**: 130 new tests, ~665 lines of production+test code, zero regressions

**Architecture**: lib/ types → lib/ client → entrypoints/ queue → entrypoints/ handlers. Import direction strictly downward. Zero crypto in transport layer. All handlers return SYNC_NOT_CONFIGURED until Module 15b backend exists.

**Key Lessons**: 20 process lessons documented in process-lessons.md. Critical patterns: fakeBrowser from wxt/testing (not vi.mock), storage data validation with type guards, non-SyncError fallback handling, separate handler files when at line limit.
