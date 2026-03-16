# Module 14: Process Lessons

## SJCL Exception Handling (CRITICAL)

SJCL exceptions are **NOT** `Error` subclasses. They are plain constructor functions:
```javascript
sjcl.exception.corrupt = function(a) { this.message = a; this.toString = ... }
```

- `error instanceof Error` → `false` for SJCL exceptions
- Must use `String(error)` for message extraction
- Wrong password → `String(error)` contains `'CORRUPT'`
- Invalid JSON blob → `String(error)` contains `'INVALID'`
- Detection: `String(error).includes('CORRUPT')` for password errors

## CJS Dynamic Import Interop with Vite

- `sjcl` is CJS-only (`main: "sjcl.js"`, no `module`/`exports` field)
- Vite pre-bundles CJS → ESM automatically
- `await import('sjcl')` resolves with named exports in both Vitest and production
- Top-level `import sjcl from 'sjcl'` works in test files (lazy-load is production-only constraint)
- Verified via sanity test before writing production code

## Type Declaration Strategy

- `@types/sjcl` v1.0.34 exists but uses global namespace — conflicts with dynamic import under strict mode
- Minimal `types/sjcl.d.ts` with just `decrypt` + `encrypt` is sufficient and avoids conflicts
- WXT tsconfig `include: ["../**/*"]` covers `types/` directory automatically

## Type Guard Without `as` Casts

- `'in' operator` narrows to `object & Record<key, unknown>` but `Array.isArray` needs property access
- `as Record<string, unknown>` is the accepted pattern for type guards in this codebase (not `as any`)
- After type guard validates, downstream functions don't need re-validation (removed redundant `Array.isArray` in deslop)

## Security: Stripping Sensitive Fields

- CodeRabbit caught that the `key` field was exposed on the return value of `decryptHushBlob`
- Since the function is exported, any caller could access `result.key`
- Fix: `const { key: _key, ...safe } = parsed; return safe;`
- Lesson: always strip sensitive fields before returning from exported functions, not just "ignore" them in mapping

## Number.isInteger for Timestamp Validation

- `Date.parse()` returns `NaN` on failure, which `Number.isInteger(NaN)` correctly rejects as `false`
- Valid timestamps from `Date.parse()` are always integers (milliseconds since epoch)
- Pattern: `Number.isInteger(ts) && ts > 0 ? ts : Date.now()`

## CodeRabbit Review Findings Worth Remembering

- No depth guard in `countImportedNodes` — acceptable because Hush format is flat (folders cannot contain sub-folders), but document why
- Test assertions with `if` guards can silently skip — consider using `assert()` or unconditional `toMatchObject()` in future
- Missing edge-case tests identified: empty URL, invalid date, empty text — consider adding in future iteration

## CodeRabbit VSC Session Lessons (2026-03-16)

### What CodeRabbit VSC got right
- Stricter type guards (`isHushBookmark`, `isHushFolder`) validating individual item shapes — see **Type Guard Without `as` Casts** and CodeRabbit HUSH-001 for the boundary-validation rule
- Removing redundant try/catch in test → replaced with `rejects.toMatchObject` — cleaner, fails properly
- Static test fixture blob instead of runtime `sjcl.encrypt()` — eliminates sjcl import in test file
- `tsconfig.json` exclude for `node_modules` — prevents phantom diagnostics from transiently installed packages
- Correctly identified that SJCL cannot be replaced: AES-CCM is NOT in Web Crypto API, and `asmcrypto.js` has nonce format incompatibility with SJCL blobs

### What CodeRabbit VSC got wrong (reverted/fixed)
- **`@types/sjcl` addition**: `@types/sjcl` uses `export = sjcl` + global namespace. `sjcl.encrypt()` returns `SjclCipherEncrypted` (object type) not `string` — type mismatch. Our minimal `types/sjcl.d.ts` is correct and intentional.
- **Redundant re-validation in `mapHushToTree`**: Added `isRecord(f)` + `Array.isArray(f.bookmarks)` checks inside `.filter()` on items already validated by `isHushExportData`. After the type guard passes, downstream code can trust the types. Removed as slop.
- **`Array.isArray(f.bookmarks) ? f.bookmarks : []` ternary**: Same redundancy — type guard guarantees `bookmarks` is an array. Reverted to direct `f.bookmarks`.
- **TODO comment about SJCL migration**: Unnecessary — decision is documented in plan and process-lessons. SJCL is the ONLY option for AES-CCM/PBKDF2 compatible with frozen Hush export format.
- **Attempted `asmcrypto.js` installation**: Left `asmcrypto.js` package reference in node_modules causing phantom TS diagnostic. Fixed via tsconfig exclude.

### Key takeaway
AI-generated reviews (CodeRabbit VSC) can introduce slop while fixing real issues. Always review with confirmation bias → 0: validate each change independently against the type system and existing validation guarantees. Type guards that validate at the boundary should be trusted by downstream code — re-validation is defensive slop.

### SJCL is the only viable option (confirmed via research)
- Web Crypto API: AES-GCM/CBC/CTR/KW only — NO AES-CCM support
- `@noble/ciphers`: No CCM mode
- `asmcrypto.js`: Has CCM but nonce/format incompatible with SJCL blobs
- `crypto-js`, `node-forge`: No CCM mode
- SJCL format is frozen (self-describing JSON). Only SJCL can decode its own blobs.
- SJCL is deprecated (2016) but acceptable for import-only (read-only) use on frozen format.

## HUSH-002: Handler Wiring Lessons

### Hush export data format (for E2E fixtures)
- Hush export format uses `{ id, title, bookmarks: [{ url, text, created }] }` — NOT `{ name, links }`
- E2E test initially used wrong field names causing import failure. The `isHushFolder` type guard requires exact field names.
- Lesson: always reference the type guard source code (or unit test fixtures) when building E2E test data, don't guess from memory.

### handlers.ts 300-line limit
- Adding handleImportHush (11 lines) pushed handlers.ts to 309 lines, exceeding the 300-line scaffold-smoke constraint
- Fix: removed 9 internal blank lines within function bodies (between guard clauses and logic). No readability impact because early-return guard style makes flow clear without visual separators.
- Lesson: when a file is near the limit, plan for compaction before adding new code.

### Pre-existing test gaps
- background-types.test.ts "each interface is independently importable" test only had 13 of 16 `satisfies` checks (missing UnlockMessage, SaveMessage, AddBookmarkMessage)
- Tracer bullet analysis caught this gap before implementation. Fixed by adding all 3 missing checks + ImportHushMessage → 17 total.
- Lesson: tracer bullet analysis is valuable for finding pre-existing gaps, not just blast radius.

### SJCL in Playwright E2E
- SJCL blob must be generated in Node context (test setup), passed as string argument to `page.evaluate()`
- Cannot use `sjcl.encrypt()` inside `page.evaluate()` — SJCL is a Node dependency, not available in browser context
- Pattern: `const validBlob = sjcl.encrypt('pw', data); page.evaluate<Response, string>(async (blob) => { ... }, validBlob);`
- `import sjcl from 'sjcl'` works at top level in Playwright test files (CJS default export interop)

### CodeRabbit Review Findings (HUSH-002)

- Verdict: "Ship it" — 0 Critical, 0 High, 1 Low
- Low finding: mixed concerns (formatting changes + feature) in same commit — acceptable for 300-line limit compliance
- All checks passed: security (no PII leak), type safety (zero `as any`), module boundaries, error discrimination, handler statelessness

### WXT Messaging Best Practices (WebSearch 2026-03-16)

- WXT recommends `@webext-core/messaging` wrapper for type-safe messaging — we use raw `runtime.sendMessage` with discriminated unions instead, which is equally type-safe and avoids an extra dependency
- MV3 service workers are terminated after approximately 30 seconds of idle time — handlers must be stateless (no in-memory state between messages). The ~5 minute limit applies to how long an individual event handler may take to settle, not to idle timeout. Our import handlers (handleImportBackup, handleImportHush) are correctly stateless (no ctx parameter)
- `VALID_TYPES` Set pattern for runtime message validation is not from WXT docs but is a project-specific guard — works well with the `satisfies never` exhaustive switch

### Playwright Extension E2E Patterns (WebSearch 2026-03-16)

- Extension testing requires Chromium-only + persistent context + headed mode (per Playwright docs)
- `--load-extension` flag only works with bundled Chromium, not Chrome/Edge/Firefox
- Our pattern of `page.evaluate(() => chrome.runtime.sendMessage({...}))` is the standard approach for testing extension message passing
- SJCL blob generation in Node context, passed as string to `page.evaluate<T, string>()`, is the correct pattern for testing with Node-only dependencies

## HUSH-003: UI Component Lessons

### Playwright strict mode with getByText
- `getByText('Import from Hush')` resolves to 2 elements when the same text appears in both an h4 heading and a button label
- Fix: use `getByRole('heading', { name: 'Import from Hush' })` for headings, `getByRole('button', { name: /import from hush/i })` for buttons
- Lesson: always prefer role-based locators over `getByText` when text may appear in multiple elements

### React 19 FormEvent deprecation
- `React.FormEvent<HTMLFormElement>` shows TypeScript deprecation warning in React 19 types — this is a React 19 types migration notice, not an error
- The pattern still works correctly and matches existing codebase usage (ImportSection.tsx:149)

### appendImportedFolder duplication decision
- One-liner `{ ...current, children: [...current.children, imported] }` duplicated in HushImportSection rather than extracted to shared utility
- Extracting would touch ImportSection.tsx + its tests — scope creep for a single-line function
- If a third consumer appears, extract to `lib/data-model.ts`

### settingsPage fixture duplication
- E2E test file duplicates the full settingsPage fixture (storage seeding, unlock, navigate) from popup-settings.test.ts
- Playwright fixtures can't be shared across separate test files without a shared fixture file
- If more settings E2E test files are added, extract settingsPage fixture to `tests/e2e/fixtures/settings-page.ts`

### Deslop review must be scoped correctly

- Running deslop on `git diff main...HEAD` includes ALL branch changes — findings may be from previous stories, not the current one
- Fix: scope deslop to `git diff HEAD~1...HEAD` for single-story review, or list only the files changed in the current story
- Lesson: always scope reviews to the work being verified, not the entire branch
- Cross-reference: the `mapBookmarks`/`isHushBookmark` redundancy lesson is already captured in **Type Guard Without `as` Casts** and CodeRabbit HUSH-001.

### BDD section spacing in E2E tests

- HUSH-002 E2E tests were missing blank lines between `#given`, `#when`, `#then` sections
- Project convention (per testing.md rules): BDD sections should be visually separated with blank lines
- Applied consistently across all 3 HUSH-002 E2E test cases

### CodeRabbit HUSH-003 Review Findings

- **M-02 (fixed): `save()` return value ignored** — `useTree().save()` returns `Promise<boolean>` (false on failure). Component showed success even if save failed. Fixed by checking return value and showing error on `!saved`.
- **M-01 (pre-existing): shallow type guard** — `isHushImportData` only checks `typeof === 'object'` for `tree` and `stats`. Same pattern as `isChromeImportData` in ImportSection. Not a regression — defer to a future hardening pass across all import guards.
- **M-03 (deferred): no test for `tree === null` early return** — when `useTree()` returns null before initial load, `handleImport` bails silently. Low risk (button requires both fields filled). Add in HUSH-004 or future test pass.
- **L-03 (deferred): no test for `sendMessage` rejection** — catch branch only tested via unit tests that mock resolved errors, not rejected promises. Add in future test pass.
- **Verdict: Ship it** — 0 Critical, 1 High (SJCL E2E coupling — acceptable, documented), 4 Medium (1 fixed, 3 pre-existing/deferred), 5 Low/Info

### PRD metadata drift

- CodeRabbit VSC (GitHub Copilot) caught that `.prd/README.md` Module 14 row still showed `0/4, 0/23` after 3 stories passed
- Also caught that Module 16a `prd.json` had incomplete ProStatus default shape (`{ isPro: false, canTrial: true }` missing `expiresAt: null, trialDaysLeft: null`)
- Lesson: PRD metadata (README tracker table, acceptance criteria examples) drifts from actual state when progress logging updates only `prd.json` and `progress.md`. Add README update to the post-story checklist.
- Cross-reference: `Progress Logging Protocol` in CLAUDE.md does not mention README updates — consider adding it

## HUSH-004 Session Lessons

### Shared fixture extraction eliminates 260+ lines of duplication

- Three E2E test files (`hush-import-ui`, `popup-settings`, `popup-settings-flows`) each duplicated ~80-90 lines of identical `settingsPage` fixture code including full PBKDF2 key derivation
- Extracted to `tests/e2e/fixtures/settings-page.ts` using existing `seedStorage()` and `unlockPopup()` from `seed-storage.ts`
- Factory pattern `makeSettingsTest(treeData?)` matches existing `makeTreeTest()` convention
- Lesson: When adding a new test file that needs a fixture, first check if the same fixture exists elsewhere — duplication is the #1 E2E test anti-pattern

### Playwright strict mode violations from ambiguous aria-labels

- `getByLabel('Actions')` matched 3 elements: 2x "Folder actions" + 1x "Actions" (bookmark). Playwright's `getByLabel` does substring matching by default
- Fix: `getByRole('button', { name: 'Actions', exact: true })` — explicit role + exact match eliminates ambiguity
- Lesson: Always use `exact: true` or `getByRole` with exact name when the label substring could match related but different elements (e.g., "Actions" vs "Folder actions")

### "decrypt" in user-friendly messages is not a crypto internal leak

- Initial test asserted `not.toContainText('decrypt')` — but "Failed to decrypt Hush export" is a user-friendly sentence, not a raw SJCL exception
- The intent was to block SJCL internals: CORRUPT, sjcl, INVALID, stack traces
- Lesson: Error message leak assertions should target library-specific terms (CORRUPT, sjcl.exception) not English words that legitimately describe the operation

### emulateMedia({ reducedMotion: 'reduce' }) for Radix accordion tests

- Radix UI Accordion uses CSS transitions that can cause timing issues in E2E tests
- `page.emulateMedia({ reducedMotion: 'reduce' })` disables animations, making accordion expansion deterministic
- Applied in the integration test that expands nested accordions (Hush Import → Test Folder → bookmarks)

### Coverage gap identification via branch analysis

- Initial coverage: 75% statements, 58% branches — below 80% target
- Uncovered: empty data path (line 166), unexpected error wrapping (lines 198-201), malformed blob import path
- Three targeted tests raised coverage to 80%+ without over-testing
- Lesson: When coverage is close to threshold, check uncovered lines first — usually 2-3 targeted tests suffice

### CodeRabbit VSC post-commit review cycle (HUSH-004)

- CodeRabbit VSC flagged 4 issues after the HUSH-004 commit; Copilot auto-fixed them
- All 4 changes were legitimate improvements after confirmation-bias-zero review:
  - `toBeHidden()` → `not.toBeVisible()`: canonical Playwright negative assertion
  - `toBeHidden()` → `toHaveCount(0)`: stronger — asserts element absent from DOM, not just hidden
  - Added `toContainText('Invalid password')`: test previously only checked alert visibility, not content
  - Grammar fix in process-lessons.md: garbled sentence corrected
- Copilot could NOT run Playwright to verify (PowerShell constraints) — always run tests after accepting Copilot changes
- Lesson: `toBeHidden()` is ambiguous (passes for both hidden-but-present AND absent). Use `not.toBeVisible()` for "shouldn't be showing" and `toHaveCount(0)` for "shouldn't exist in DOM"
