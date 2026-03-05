# Module 3: Storage Service — Progress Log

## Story Tracker

| ID | Title | Status | Attempts |
| --- | --- | --- | --- |
| STORAGE-001 | Encrypted save and load roundtrip | PASSED | 1 |
| STORAGE-002 | Error handling for all failure modes | PASSED | 1 |
| STORAGE-003 | Retry logic with exponential backoff | PASSED | 1 |
| STORAGE-004 | Utility functions: hasData, clearAll, getStorageUsage | Pending | 0 |
| STORAGE-005 | validateEncryptedStore type guard and module purity | Pending | 0 |
| STORAGE-006 | Full test suite validation and integration verification | Pending | 0 |

**Critical Path**: 001 -> 002 -> 003 -> 004/005 -> 006

---

## Session: 2026-03-05T12:00:00Z
**Task**: STORAGE-001 - Encrypted save and load roundtrip
**Status**: PASSED (attempt 1)

### Work Done
- Added `reason` field to `StorageErrorContext` in lib/errors.ts (additive, backward-compatible)
- Created lib/storage.ts (144 lines) with `saveEncryptedData`, `loadEncryptedData`, `validateEncryptedStore`, `STORAGE_KEY`
- Created 5 unit tests with mocked crypto + happy-dom environment
- Created 4 Playwright E2E tests for real chrome.storage.local verification
- Installed `happy-dom` dev dependency (jsdom incompatible with WXT — issue #1575)
- CodeRabbit review: hardened `validateEncryptedStore` with `Number.isFinite()` + non-empty string checks
- Renamed E2E file from `storage-roundtrip.test.ts` to `browser-storage-api.test.ts` (CodeRabbit feedback)

### Files Created

| File | Purpose |
| --- | --- |
| lib/storage.ts | Core storage service: encrypt/save, load/decrypt, validate |
| tests/unit/lib/storage.test.ts | 5 unit tests with mocked crypto + happy-dom |
| tests/e2e/browser-storage-api.test.ts | 4 E2E tests for real browser.storage.local API |

### Files Modified

| File | Changes |
| --- | --- |
| lib/errors.ts | Added `reason` field to `StorageErrorContext` |
| package.json | Added `happy-dom` dev dependency |
| package-lock.json | Updated lockfile for happy-dom |

### Acceptance Criteria Verification

1. saveEncryptedData signature correct — PASS
2. loadEncryptedData signature with union error type — PASS
3. Save/load roundtrip preserves plaintext — PASS
4. Data stored under STORAGE_KEY = 'holyPrivateData' — PASS
5. Stored value is valid EncryptedStore JSON — PASS
6. loadEncryptedData returns not_found when no data — PASS
7. validateEncryptedStore is public export — PASS
8. StorageErrorContext has reason field — PASS
9. Uses browser.storage.local from 'wxt/browser' — PASS

### Verification Results

- `npx tsc --noEmit` — 0 errors
- `npx eslint lib/storage.ts tests/unit/lib/storage.test.ts tests/e2e/browser-storage-api.test.ts` — 0 errors
- `npx vitest run` — 290 tests, 18 files, all passing
- `npm run test:e2e` — 35 tests, all passing
- lib/storage.ts: 144 lines (under 150 limit), all functions under 50 lines
- Zero `console.log`, `as any`, `@ts-ignore`, empty catches

### Learnings
- jsdom is incompatible with WXT's `@webext-core/fake-browser` — use `// @vitest-environment happy-dom` annotation
- Use `browser.storage.local.clear()` instead of `fakeBrowser.reset()` in happy-dom
- E2E tests for chrome.storage.local need local `declare const chrome` type declaration
- `Number.isFinite()` + positivity + non-empty string checks needed for robust type guard

---

## Session: 2026-03-05T16:00:00Z
**Task**: STORAGE-002 - Error handling for all failure modes
**Status**: PASSED (attempt 1)

### Work Done
- Added cross-browser QuotaExceededError detection in `saveEncryptedData` catch block (Chrome: `QuotaExceededError`, Firefox: `NS_ERROR_DOM_QUOTA_REACHED`, fallback: DOMException code 22)
- Added 9 unit tests covering all error paths: corrupted JSON, invalid EncryptedStore, wrong password, quota exceeded, generic write/read failures, DecryptionError wrapping, unexpected Error fallback, non-Error thrown values
- Added 2 Playwright E2E tests for storage corruption resilience (invalid string, partial object)
- Trimmed lib/storage.ts from 157 to 150 lines (condensed JSDoc, removed unnecessary blank lines, `== null` for null/undefined check)
- CodeRabbit review: identified and fixed coverage gaps for line 141 fallback and non-Error throw branch

### Files Modified

| File | Changes |
| --- | --- |
| lib/storage.ts | Added QuotaExceededError detection; condensed JSDoc; trimmed blank lines; `== null` |
| tests/unit/lib/storage.test.ts | Added 9 error handling tests (7 PRD + 2 CodeRabbit coverage); added DecryptionError/InvalidPasswordError imports |
| tests/e2e/browser-storage-api.test.ts | Added 2 E2E resilience tests (invalid string, partial object) |

### Acceptance Criteria Verification

1. Invalid JSON in storage → StorageError with reason 'corrupted' — PASS
2. Valid JSON but not EncryptedStore → StorageError with reason 'corrupted' — PASS
3. Wrong password → InvalidPasswordError (union return type, not thrown) — PASS
4. Storage quota exceeded → StorageError with reason 'quota_exceeded' — PASS
5. Generic write failure → StorageError with reason 'write_failed' — PASS
6. Generic read failure → StorageError with reason 'read_failed' — PASS
7. No error path throws — all return Result failures — PASS

### Verification Results

- `npx tsc --noEmit` — 0 errors
- `npx eslint lib/storage.ts tests/unit/lib/storage.test.ts tests/e2e/browser-storage-api.test.ts` — 0 errors
- `npx vitest run` — 299 tests, 18 files, all passing
- `npx vitest run --coverage` — storage.ts: 100% statements, 91.89% branches, 100% functions, 100% lines
- `npx wxt build` — successful (594.45 kB total)
- `npm run test:e2e` — 37 tests, all passing
- lib/storage.ts: 150 lines (at limit), loadEncryptedData ~64 lines (flagged for STORAGE-006 refactor)
- Zero `console.log`, `as any`, `@ts-ignore`, empty catches

### Learnings
- Cross-browser QuotaExceededError detection: check `error.name === 'QuotaExceededError'` (Chrome) OR `'NS_ERROR_DOM_QUOTA_REACHED'` (Firefox) OR `DOMException.code === 22` (fallback)
- `== null` is idiomatic for checking both `undefined` and `null` — saves a line
- CodeRabbit found 2 real coverage gaps: unexpected Error from decrypt() and non-Error thrown values — both worth testing
- loadEncryptedData at 64 lines exceeds 50-line function limit — needs extraction in STORAGE-006
- Playwright cannot simulate QuotaExceededError in E2E (10MB storage limit) — unit tests with mocks are the correct layer

---

## Session: 2026-03-05T17:00:00Z
**Task**: STORAGE-003 - Retry logic with exponential backoff
**Status**: PASSED (attempt 1)

### Work Done
- Added `RETRY_CONFIG` exported constant: `{ maxAttempts: 3, delays: [100, 200] } as const`
- Added internal `isRetryable()` function: returns false for `InvalidPasswordError`, true only for `read_failed`/`write_failed`
- Added internal `withRetry<T, E>()` generic function: first attempt outside loop, retries inside with `setTimeout` delays
- Wrapped `saveEncryptedData` and `loadEncryptedData` bodies in `withRetry` lambdas
- Explicit type parameter `withRetry<string, StorageError | InvalidPasswordError>` on `loadEncryptedData` call to fix generic inference narrowing
- Created separate test file `storage-retry.test.ts` (existing file at 295 lines, adding more would exceed 300-line limit)
- Updated 4 STORAGE-002 tests to chain 3x `mockRejectedValueOnce` for retry exhaustion compatibility
- Added 1 Playwright E2E smoke test: rapid sequential set/get cycles
- CodeRabbit review found dead config: `delays[2]` (400ms) was never consumed (3 attempts = 2 retries = 2 delays). Fixed to `[100, 200]`.

### Files Created

| File | Purpose |
| --- | --- |
| tests/unit/lib/storage-retry.test.ts | 6 retry-specific unit tests with fake timers |

### Files Modified

| File | Changes |
| --- | --- |
| lib/storage.ts | Added RETRY_CONFIG, isRetryable(), withRetry(), wrapped save/load; 182 lines |
| tests/unit/lib/storage.test.ts | 4 tests updated: chained 3x mockRejectedValueOnce for retryable errors |
| tests/e2e/browser-storage-api.test.ts | Added rapid operations E2E smoke test |

### Acceptance Criteria Verification

1. Transient read/write failures retried up to maxAttempts (3) times — PASS
2. Exponential backoff delays in RETRY_CONFIG.delays: [100, 200] ms — PASS (fixed from [100, 200, 400] after CodeRabbit review found delays[2] was dead config)
3. Permanent errors (quota_exceeded, corrupted, not_found) NOT retried — PASS
4. InvalidPasswordError NOT retried — PASS (security-critical: prevents brute-force)
5. After all retries exhausted, returns last StorageError — PASS
6. RETRY_CONFIG is exported constant, no magic numbers — PASS

### Verification Results

- `npx tsc --noEmit` — 0 errors
- `npx eslint lib/storage.ts tests/unit/lib/storage.test.ts tests/unit/lib/storage-retry.test.ts tests/e2e/browser-storage-api.test.ts` — 0 errors
- `npx vitest run` — 305 tests, 19 files, all passing
- `npx vitest run --coverage` — storage.ts: 100% statements, 91.48% branches, 100% functions, 100% lines
- `npx wxt build` — successful (594.45 kB total)
- `npm run test:e2e` — 38 tests, all passing
- lib/storage.ts: 182 lines (over PRD's 150 target, under CLAUDE.md's 300; flagged for STORAGE-006)
- Zero `console.log`, `as any`, `@ts-ignore`, `!` assertions, empty catches

### Learnings
- `withRetry` generic inference: TypeScript narrows `E` to just `StorageError` when the lambda returns both `StorageError` and `InvalidPasswordError`. Fix: explicit type parameter at call site.
- `mockRejectedValue` (persistent) vs `mockRejectedValueOnce` matters for retry tests — use persistent when the error should repeat on every call, use chained `ValueOnce` when testing exhaustion.
- `vi.useFakeTimers()` + `vi.advanceTimersByTimeAsync()` works correctly with WXT's in-memory storage mock (Promises are microtasks, unaffected by fake timers).
- For non-retryable errors, `await loadEncryptedData()` resolves immediately without needing `advanceTimersByTimeAsync` — `withRetry` short-circuits before reaching `setTimeout`.
- CodeRabbit catch: `delays` array had 3 elements but only 2 were consumed (`maxAttempts - 1` retries). Dead config is misleading — trim to match actual usage.
