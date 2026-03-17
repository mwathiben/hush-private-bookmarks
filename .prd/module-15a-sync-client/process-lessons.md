# Module 15a: Sync Client — Process Lessons

## SYNC-001: Sync types, SyncableFeature interface, and SyncError class

### Lesson 1: PRD discrepancies must be caught in tracer bullet analysis

**What happened**: PRD assigned scaffold-smoke LIB_MODULES update to SYNC-004, but adding `sync-types.ts` in SYNC-001 immediately breaks the `toHaveLength(14)` assertion. The file count must match reality as soon as a new lib/ file exists.

**Rule**: When creating a new lib/ file, update scaffold-smoke LIB_MODULES in the same story. Don't defer integration test updates to later stories.

### Lesson 2: Types-only modules benefit from static purity tests

**What happened**: `sync-types.ts` is purely types — zero runtime code. The purity tests (no `const/let/var/function/class`, `import type` only) enforce this at test time, catching accidental runtime additions during future modifications.

**Rule**: Every types-only lib/ module should have a purity test suite that asserts: zero runtime exports, zero React/DOM imports, zero browser.storage references, import type only.

### Lesson 3: Research findings should update the PRD, not be deferred

**What happened**: Research identified branded types, discriminated union SyncStatus, constrained error codes, and featureId on SyncConflict (with CONFLICT error code) as improvements. Initially deferred because "not in PRD scope." User correctly pushed back — the PRD is a living document that should evolve based on research. All 4 improvements were implemented with zero blast radius (types-only, no production code affected).

**Rule**: When research reveals a valuable pattern, present pros/cons to the user and recommend implementation. Update the PRD to reflect the improvement. The PRD serves the system, not the other way around.

### Lesson 4: Uint8Array<ArrayBuffer> explicit generic is load-bearing

**What happened**: TS 5.7+ changed `Uint8Array` default generic from `ArrayBuffer` to `ArrayBufferLike` (which includes `SharedArrayBuffer`). Web Crypto API's `BufferSource` type rejects `ArrayBufferLike`. Using bare `Uint8Array` causes type errors at crypto boundaries.

**Rule**: Always use `Uint8Array<ArrayBuffer>` (not bare `Uint8Array`) in any type that will interact with Web Crypto API or `BufferSource` parameters.

### Lesson 5: E2E testing types-only modules

**What happened**: SYNC-001 is types-only — no new runtime behavior to E2E test. The existing E2E suite (200 tests) confirms the extension builds and loads correctly with the new types included. Adding a dedicated E2E test for SyncError construction in browser context would require a global bridge (`globalThis.__hushErrors`) that doesn't exist and shouldn't be added just for testing.

**Rule**: For types-only stories, E2E verification = "extension still builds and loads." Don't add runtime globals solely to enable E2E tests for compile-time constructs.

### Lesson 6: CodeRabbit review insights for future stories

**What happened**: CodeRabbit flagged that `SyncStatus.error` is `string` — could carry PII if a caller sets it carelessly. Also noted `SyncConflict` lacks `featureId` (needed when multiple SyncableFeature implementations exist).

**Action for SYNC-002+**: Add JSDoc to `SyncStatus.error` noting "Must not contain URLs, tokens, or bookmark content." ~~Consider adding `featureId` to `SyncConflict` when implementing conflict resolution.~~ (Done in follow-up session.)

### Lesson 7: CodeRabbit PII review catches type-level concerns early

**What happened**: CodeRabbit flagged `SyncConfig.authToken` as a plain `string` that could leak to Sentry if the config object is passed as error context. Also suggested a named `SyncErrorCode` type alias for greppability.

**Rule**: When adding types that carry secrets or tokens, consider whether the type will be visible in error contexts. Branded types or opaque wrappers prevent accidental exposure. Named type aliases (not just indexed access types) improve greppability across the codebase.

## SYNC-002: Sync client — HTTPS API client with conflict resolution

### Lesson 8: DOMException name detection in test environments

**What happened**: `new DOMException('msg', 'TimeoutError')` works in Node.js and real browsers, but when passed through vitest's mock system (`fetchSpy.mockRejectedValue(new DOMException(...))`), the `.name` property may not survive correctly. Using `new Error('msg')` with `.name = 'TimeoutError'` is the reliable test pattern.

**Rule**: For error name-based detection (`error.name === 'TimeoutError'`), test with plain `Error` objects that have `.name` overridden. This matches what the production code checks and avoids environment-specific DOMException quirks. Same lesson as crypto OperationError (Lesson 4 from SYNC-001).

### Lesson 9: fetch mock patterns — avoid double-call in catch verification

**What happened**: Tests that used `await expect(fn()).rejects.toThrow(SyncError)` followed by a `try/catch` block calling the same function would fail because the first call consumed the mock response, leaving the second call with no mock configured.

**Rule**: For tests that need to verify both that an error is thrown AND inspect its properties, use a single try/catch pattern with explicit assertions on the caught error. Don't call the function twice.

### Lesson 10: HTTPS enforcement as defense-in-depth

**What happened**: Security audit identified that auth tokens sent over HTTP are visible to network observers. Added a one-line `startsWith('https://')` check in `buildUrl()` that throws before any fetch call.

**Rule**: When a function sends authentication credentials, validate the transport security before making the request. This is defense-in-depth — the backend should also reject HTTP, but the client should never send tokens over an insecure channel.

### Lesson 11: Vertical TDD slice still catches real bugs

**What happened**: Writing tests first (RED) for `uploadBlob` → implementing (GREEN) → then tests for `downloadBlob` revealed that the timestamp header validation needed `Number.isFinite()` instead of just `Number()` truthiness, because `Number('Infinity')` would pass a basic truthy check but is not a valid timestamp.

**Rule**: The RED-GREEN cycle per function (not per file) catches subtle bugs that bulk-writing tests misses, because each GREEN implementation informs the next RED test.
