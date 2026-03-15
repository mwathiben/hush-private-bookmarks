# Module 12 — Process Lessons

## SETTINGS-001a (2026-03-15)

### Directory-Based Entrypoint Extraction

WXT supports `entrypoints/background/index.ts` + companion files. When a single entrypoint file approaches 300 lines, extract to directory structure. Import paths (`@/entrypoints/background`) resolve to `index.ts` automatically — no import changes needed in tests or other files.

### HandlerContext Pattern

Dependency injection via interface works well for background handlers. Benefits: testable without browser mocks, consistent abstraction (no mixing direct browser.* calls with context methods). CodeRabbit correctly flagged 4 leaked browser.* calls that broke the pattern — always audit for consistency after extraction.

### loadAndActivateSet Shared Helper

handleUnlock and handleSwitchSet shared ~25 lines of identical logic. Extracting to a private helper reduced handlers.ts from 339 to 288 lines. Look for duplication across handlers before considering the file "done."

### CodeRabbit Review Patterns

Medium-priority findings were all legitimate:
1. **Abstraction consistency** — if you create a context/DI pattern, ALL browser calls must go through it. Partial adoption is worse than none.
2. **Orphaned resource tests** — test the case where step 1 succeeds but step 2 fails (e.g., createSet succeeds but saveSetData fails).
3. **Re-encryption failure test** — test that CHANGE_PASSWORD handles saveSetData failure after successful loadSetData.

### scaffold-smoke.test.ts Maintenance

When restructuring entrypoint files, update the scaffold smoke test that checks file existence and line counts. Easy to forget — causes immediate CI failure.

### E2E Test Updates After Handler Wiring

Existing E2E tests that checked NOT_IMPLEMENTED responses need updating to check actual behavior. Plan for this when wiring handlers — it's not just unit tests that change.
