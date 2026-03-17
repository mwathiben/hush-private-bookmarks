# Module 16a: Payment Integration (ProGate) — Process Lessons

## PAY-001: lib/pro-gate.ts, ProStatus, ProGateError

### Lesson 1: Object.freeze + spread copy for shared default objects

**What happened**: CodeRabbit identified that `FREE_TIER_DEFAULT` was returned by reference from `checkProStatus()` on every error path. TypeScript's `readonly` only prevents mutation at compile time — at runtime, any caller could mutate the shared object, corrupting it for all future calls.

**Rule**: When a module returns the same default/sentinel object from multiple code paths, apply both defenses: `Object.freeze()` on the constant (runtime immutability) AND return a spread copy `{ ...DEFAULT }` (identity isolation). Belt and suspenders — `Object.freeze` catches mutation attempts, spread copy prevents identity-based coupling between callers.

### Lesson 2: ExtPay SDK has built-in TypeScript types

**What happened**: The plan anticipated possibly needing a custom `.d.ts` declaration file. Investigation revealed `extpay` v3.1.2 ships `types.d.ts` in the package with full type coverage for User, Plan, and the ExtPay instance interface. No custom declarations needed.

**Rule**: Before creating type declarations for npm packages, check `node_modules/<package>/types.d.ts` and `node_modules/<package>/index.d.ts`. Many packages ship types without `@types/` packages.

### Lesson 3: ExtPay cannot be required/imported outside browser extension context

**What happened**: `node -e "require('extpay')"` throws `Error: This script should only be loaded in a browser extension` because `webextension-polyfill` (ExtPay's dependency) checks for browser extension context on load. This is expected — ExtPay works only when bundled into an extension.

**Rule**: For packages that depend on browser extension APIs, verify installation via `ls node_modules/<pkg>/types.d.ts` and TypeScript compilation, not Node.js `require()`. The runtime check is a feature, not a bug.

### Lesson 4: Singleton test verifies ExtPay constructor call count

**What happened**: CodeRabbit flagged missing test coverage for the singleton caching behavior. Added a test verifying `ExtPay()` constructor is called exactly once across multiple `checkProStatus()` calls. This catches regressions where the singleton pattern breaks (e.g., someone removes the `if (!extpayInstance)` guard).

**Rule**: When a module uses the singleton pattern with lazy initialization, add a test that calls the public function multiple times and asserts the constructor was called exactly once. This is especially important for SDK wrappers where re-initialization has side effects.

### Lesson 5: Reserved error codes in context types are acceptable forward declarations

**What happened**: CodeRabbit noted that `NETWORK_ERROR` and `CHECK_FAILED` codes in `ProGateErrorContext` are never constructed in PAY-001. These are intentionally reserved for PAY-002 (useProGate hook distinguishes network failures) and PAY-003 (background handler). They're defined now because the error context type is in the shared `lib/errors.ts` — changing it later would modify a file that PAY-001 already changed.

**Rule**: When defining error context types in a shared module, include all planned error codes from the module's PRD scope, not just the ones used in the current story. This prevents churning the shared types file across multiple stories. Document the intent in the plan.

### Lesson 6: Math.ceil for trial days is a deliberate UX choice

**What happened**: CodeRabbit questioned whether `Math.ceil` inflates trial days at boundaries (showing "1 day" when only hours remain). Analysis confirmed this is intentional: `isPro` is the authoritative gating check (uses `daysLeft > 0`), while `trialDaysLeft` is display-only. Showing "0 days" while the trial is still active would be worse UX than showing "1 day" during the final partial day.

**Rule**: When implementing time-based display values alongside boolean gate values, document which is authoritative. The display value can round generously (Math.ceil) as long as the gate value is precise.

### Lesson 7: Use expect.assertions(n) instead of expect.fail for throw-verification tests

**What happened**: CodeRabbit identified that the `try { fn(); expect.fail('should have thrown'); } catch (err) { ... }` pattern is fragile — if someone removes the `expect.fail` line, the test silently passes even if the function never throws. The project had 8 instances of this pattern across crypto.test.ts and pro-gate.test.ts.

**Rule**: For tests that verify a function throws and inspect the thrown error's properties, use `expect.assertions(n)` at the top of the test instead of `expect.fail` in the try block. `expect.assertions(n)` guarantees exactly `n` assertions run — if the catch block is skipped (function didn't throw), the test fails because the assertion count is wrong. This is structurally safer than a deletable sentinel line. Updated pro-gate.test.ts; crypto.test.ts instances are pre-existing (fix if touched).
