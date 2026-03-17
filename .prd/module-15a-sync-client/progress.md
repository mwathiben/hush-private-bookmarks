# Module 15a: Sync Client - Progress Log

## Story Tracker

| ID | Title | Status | Attempts |
| --- | --- | --- | --- |
| SYNC-001 | Sync types, SyncableFeature interface, and SyncError class | PASSED | 1 |
| SYNC-002 | Sync client — HTTPS API client with conflict resolution | PENDING | 0 |
| SYNC-003 | Offline sync queue with retry | PENDING | 0 |
| SYNC-004 | Background sync handlers and integration verification | PENDING | 0 |

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
