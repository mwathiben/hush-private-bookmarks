# Module 10: Popup UI — Auth Screens — Progress Log

## Story Tracker

| ID | Title | Status | Attempts |
| --- | --- | --- | --- |
| AUTH-001 | App shell: state machine router, contexts, message hooks | PASSED | 1 |
| AUTH-002 | LoginScreen with password input, set picker, and unlock flow | NOT STARTED | 0 |
| AUTH-003 | SetupScreen with password creation and BIP39 recovery phrase | NOT STARTED | 0 |
| AUTH-004 | Dark mode, E2E, and full verification | NOT STARTED | 0 |

**Critical Path**: 001 → 002/003 → 004

---

## Session: 2026-03-13T15:15:00Z
**Task**: AUTH-001 - App shell: state machine router, contexts, message hooks
**Status**: PASSED (attempt 1)

### Work Done
- Fixed pre-existing bug: GET_STATE returned static LOCKED_STATE with empty sets, making first-time user detection impossible
- Replaced static LOCKED_STATE with dynamic `buildLockedState()` that calls `listSets()` + `hasSetData()` when locked
- Added `hasData: boolean` to `SessionState` in background-types.ts
- Created `useSendMessage` hook with typed `browser.runtime.sendMessage` wrapper and exponential backoff retry (100/200/400ms, 3 retries)
- Created `useSession` hook: GET_STATE on mount, AbortController cleanup for StrictMode safety, dependency injection of sendMessage
- Created App.tsx with `useReducer` state machine, split React 19 contexts (SessionStateContext, SessionDispatchContext, TreeContext), screen routing via `deriveScreen(session)` → hasData/isUnlocked logic
- Created screen stubs: LoginScreen, SetupScreen, TreeScreen with data-testid
- Installed shadcn components: select, label, badge
- Updated existing background tests for new `buildLockedState()` behavior
- Updated E2E sanity test for new popup UI
- Created new E2E popup-auth smoke test

### Files Created
| File | Purpose |
| --- | --- |
| hooks/useSendMessage.ts | Typed browser.runtime.sendMessage wrapper with exponential backoff |
| hooks/useSession.ts | GET_STATE on mount, AbortController cleanup, session state |
| components/screens/LoginScreen.tsx | Stub for AUTH-002 |
| components/screens/SetupScreen.tsx | Stub for AUTH-003 |
| components/screens/TreeScreen.tsx | Stub placeholder |
| tests/unit/hooks/useSendMessage.test.ts | 4 tests: send, retry backoff, exhaust retries, stable ref |
| tests/unit/hooks/useSession.test.ts | 6 tests: loading, mount, unlock, error, throw, abort |
| tests/unit/entrypoints/popup/App.test.tsx | 10 tests: screens, transitions, contexts, error |
| tests/e2e/popup-auth.test.ts | 2 E2E tests: first-time user setup screen, dimensions |

### Files Modified
| File | Changes |
| --- | --- |
| lib/background-types.ts | Added `hasData: boolean` to SessionState |
| entrypoints/background.ts | Replaced static LOCKED_STATE with dynamic buildLockedState(), added hasSetData import |
| entrypoints/popup/App.tsx | Complete rewrite: state machine router with contexts |
| tests/unit/entrypoints/background.test.ts | Added hasSetData mock, updated GET_STATE assertions |
| tests/unit/lib/background-types.test.ts | Added hasData to SessionState literals |
| tests/unit/integration/scaffold-smoke.test.ts | Added hasData to SessionState literal |
| tests/e2e/sanity.test.ts | Updated for new popup UI (setup/login screen instead of h1) |

### Acceptance Criteria Verification
1. Screen type: 'login' | 'setup' | 'tree' | 'settings' | 'import' — PASS
2. TRANSITIONS: Record<Screen, Screen[]> enforcing valid flows — PASS
3. navigate validates against TRANSITIONS, throws on invalid — PASS
4. SessionContext split into SessionStateContext + SessionDispatchContext — PASS
5. TreeContext: { tree, setTree } shell — PASS
6. useSession: sends GET_STATE on mount, loading state, AbortController — PASS
7. useSendMessage: typed wrapper with retry — PASS
8. Hooks in hooks/ at project root — PASS
9. App routes: locked+hasData→Login, !hasData→Setup, unlocked→Tree — PASS
10. Popup CSS: 380px width (w-95), 550px max-height (max-h-137.5) — PASS
11. ErrorBoundary already wraps App in main.tsx — verified, not re-added — PASS
12. shadcn Select, Label, Badge installed — PASS

### Verification Results
```
tsc --noEmit: clean (0 errors)
vitest run: 676 tests passed (35 suites)
eslint .: 0 errors, 0 warnings
wxt build: 615.58 kB total, succeeded in 14.8s
playwright (sanity + popup-auth): 4 passed (11.3s)
```
