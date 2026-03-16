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
