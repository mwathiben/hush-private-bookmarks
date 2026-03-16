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
- Stricter type guards (`isHushBookmark`, `isHushFolder`) validating individual item shapes — genuine improvement over shallow "is array" check
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
