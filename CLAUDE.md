# CLAUDE.md - Hush Private Bookmarks Conventions

## Project

Hush Private Bookmarks: Privacy-first browser extension for hidden bookmarks.
WXT + React + TypeScript + Tailwind CSS + shadcn/ui.
GPL-3.0 license. Repo: hush-private-bookmarks.

## Skill Gate (MANDATORY before implementation)

### Step 1: Parse Task

Identify from the request:

- **Domain**: crypto | storage | UI | architecture | testing | extension | security | git/CI
- **Type**: feature | bugfix | refactor | review | debug | release

### Step 2: Match Skills

Every task matches at least one row. Read ALL matched skill files before writing code.

#### Always Active (every session)

| Trigger | Skills |
| ------- | ------ |
| Any implementation | `verification-before-completion`, `using-superpowers`, `deslop` |
| Any file in lib/ | `module-boundaries`, `strict-typescript-mode` |
| Any file in components/ or hooks/ | `module-boundaries` |
| Any import/export change | `module-boundaries` |
| Session start | `brainstorming` (if open-ended), `writing-plans` (if multi-step) |
| Session end | `finishing-a-development-branch`, `commit` |

#### By Domain

| Task Domain | Skills |
| ----------- | ------ |
| **Crypto / Encryption** | `crypto-guardrails`, `constant-time-analysis`, `constant-time-testing`, `wycheproof`, `sharp-edges`, `property-based-testing` |
| **Storage (browser.storage)** | `module-boundaries` (Rule 2), `chrome-extension-wxt` |
| **UI / Components** | `react`, `react-typescript`, `shadcn`, `shadcn-ui`, `shadcn-tailwind`, `tailwindcss`, `tailwind-design-system`, `frontend-design`, `ui-freeze`, `design-an-interface` |
| **Architecture / Refactor** | `module-boundaries`, `request-refactor-plan`, `spec-to-code-compliance` |
| **WXT / Extension** | `chrome-extension-wxt`, `wxt-extension`, `module-boundaries` |
| **Sentry / Error Reporting** | `privacy-sentry`, `sentry`, `sentry-react-sdk`, `sentry-fix-issues`, `sentry-code-review`, `sentry-pr-code-review` |
| **Security Audit** | `senior-security`, `sast-configuration`, `semgrep`, `semgrep-rule-creator`, `audit-context-building`, `audit-prep-assistant`, `insecure-defaults`, `differential-review`, `data-privacy-compliance`, `supply-chain-risk-auditor` |
| **Testing** | `tdd`, `tdd-strict`, `test-driven-development`, `e2e-testing-patterns`, `playwright-dev`, `coverage-analysis`, `code-quality-gate`, `qa-checklist`, `senior-qa`, `webapp-testing` |
| **Code Review** | `code-review`, `code-review-excellence`, `requesting-code-review`, `receiving-code-review`, `second-opinion`, `frontend-code-review` |
| **Debugging** | `systematic-debugging`, `debugging-strategies` |
| **Git / CI** | `commit`, `git-guardrails-claude-code`, `safe-git-guard`, `gh-cli`, `github`, `using-gh-cli`, `github-actions-templates`, `setup-pre-commit`, `changelog-generator`, `update-changelog`, `git-cleanup`, `using-git-worktrees` |
| **Planning / Product** | `product-requirements`, `kiro-skill`, `brainstorming`, `ask-questions-if-underspecified`, `clarify-spec`, `writing-plans`, `executing-plans`, `mermaid`, `doc-coauthoring`, `impactful-writing` |
| **Skill Authoring** | `skill-creator`, `skill-developer`, `write-a-skill`, `writing-skills`, `skill-finder`, `skill-improver`, `designing-workflow-skills` |
| **Agent Coordination** | `dispatching-parallel-agents`, `subagent-driven-development`, `multi-agent-patterns` |
| **Tailwind Theming** | `tailwind-theme-builder` |
| **Build / Bundling** | `vite`, `biome` |

### Step 3: Output Before Implementation

```text
## Skills Applied
- **[skill-name]**: [1-sentence summary of guidance being applied]
```

If no skills match (rare): `## Skills Applied — None matched (domain: [X], type: [Y])`

### Mid-Task Skill Check

When a blocking issue surfaces during implementation:

1. STOP
2. Re-run Steps 1-3 for the blocking issue
3. Output a new "Skills Applied" block
4. Then fix

### Violations

| Violation | Consequence |
| --------- | ----------- |
| Starting implementation without "Skills Applied" output | Invalid work — redo |
| Skipping skill read for matched domain | Invalid work — redo |
| Not re-running gate for mid-task blocking issues | Invalid fix — redo |

## Pre-Implementation Checklist

| Pattern | Required Approach | Anti-Pattern |
| ------- | ----------------- | ------------ |
| Storage access | `lib/storage.ts` → `hooks/` → component | Direct `browser.storage.*` in .tsx |
| Crypto | Web Crypto API, PBKDF2 ≥600k, AES-256-GCM, fresh IVs | External crypto libs, hardcoded IVs, Math.random() |
| Browser API | `browser` from `wxt/browser` | Raw `chrome.*` calls |
| Domain types | Centralized in `lib/types.ts`, `import type` | Types scattered across files, value imports for types |
| Error classes | All in `lib/errors.ts` | Inline error classes, empty catches |
| lib/ purity | Zero React/DOM imports, zero browser.storage | Any `react`, `document`, `window` import |
| Components | Thin — render + dispatch only, ≤300 lines | Business logic in event handlers |
| Hooks | In `hooks/` at project root, bridge lib/ ↔ components/ | Hooks in `lib/` or inside entrypoints/ |
| Shared code | `components/`, `hooks/`, `lib/` — never in entrypoints/ | Duplicated between popup/ and manager/ |
| TypeScript | Strict: noImplicitAny, noUncheckedIndexedAccess | `as any`, `@ts-ignore`, `@ts-expect-error` |
| Functions | ≤50 lines | God functions |
| Files | ≤300 lines | God files |
| Sentry | beforeSend strips URLs + titles, no breadcrumbs/replay/PII | Leaking URLs, bookmark titles, user identifiers |
| Bundle | <200KB gzipped, alert at 180KB | Unused shadcn/Tailwind bloat |
| Recovery phrase | @scure/bip39 only | Custom mnemonic generation |
| Path aliases | `@/lib/`, `@/components/`, `@/hooks/` | `../../lib/` relative traversals |
| Functional components | Hooks for state, no Redux/Zustand | Class components, external state libs |
| shadcn/ui | Primitives in components/ui/ — never modify directly | Editing shadcn source files |
| Production code | Zero console.log | Debug logging left in |
| Circular imports | Zero between lib/ modules | A → B → A dependency chains |

**Violation of these patterns requires fixing before the work is considered complete.**

## Crypto Rules (NON-NEGOTIABLE)

- All crypto via Web Crypto API. No external crypto libraries.
- PBKDF2 iterations >= 600,000. Never modify.
- AES-256-GCM only. Never ECB mode.
- Never hardcode IVs. Generate fresh for every operation.
- Never use Math.random() for anything crypto-related.
- Use @scure/bip39 for recovery phrase mnemonics.

## Sentry Rules (Privacy-Critical)

- beforeSend MUST strip all URLs and bookmark titles.
- Capture only: error class, stack trace, browser metadata.
- No breadcrumbs. No session replay. No user identifiers.
- DSN is public-facing — this is expected and safe.

## TDD Workflow (MANDATORY for lib/ modules)

| Phase | Action |
| ----- | ------ |
| **RED** | Write failing test first. Confirm it fails for the right reason. |
| **GREEN** | Write simplest code to pass. No extras. |
| **REFACTOR** | Clean up while tests stay green. |

Every lib/ module must have corresponding tests. No exceptions.
Skill references: `tdd`, `tdd-strict`, `test-driven-development`

## Verification Commands

| Check | Command | When |
| ----- | ------- | ---- |
| Type check | `npx tsc --noEmit` | After every file edit |
| Unit tests | `npx vitest run` | After every lib/ change |
| Lint | `npx eslint .` | Before marking task complete |
| Bundle size | `wxt build --analyze` | Before any PR |
| Architecture | Run module-boundaries checklist | After any import change |

**Violation of these checks = task NOT complete.**

## Session Protocol

- One module per session.
- Start every session by reading this file + lib/types.ts.
- Run Verification Commands at session end.
- Commit after every verified module.

## Bundle Budget

- Target: 200KB gzipped maximum.
- Alert at 180KB. Audit unused shadcn components and Tailwind classes.
- Check with: `wxt build --analyze`

## Progress Logging Protocol

Each module has a `prd.json` and a companion `progress.md` in `.prd/<module>/`.

1. After completing each story, append a session entry to progress.md — NEVER overwrite previous entries.
2. Entry format:
   - `## Session: {ISO timestamp}`
   - `**Task**: {story_id} - {story_title}`
   - `**Status**: PASSED or FAILED (attempt {n})`
3. Required subsections per entry:
   - `### Work Done` — bullet points of changes
   - `### Files Created` — table: File | Purpose
   - `### Files Modified` — table: File | Changes
   - `### Acceptance Criteria Verification` — numbered checklist with pass/fail
   - `### Verification Results` — exact command output
4. If FAILED, add `### Failure Analysis` with root cause before retrying.
5. After appending to progress.md, update prd.json: set story `passes` to true, increment `attempt_count`, update `metadata.passing_stories`.
6. Update the Story Tracker table at the top of progress.md.
7. After ALL stories in a module complete, append `## Module Summary`.
8. Each prd.json's `progress_log.format_rules` is authoritative for that module.
9. Progress files are append-only audit logs. Treat them as immutable history.

## Licensing & Architecture Rules

- The hush repo is GPL-3.0. Every source file is GPL-3.0.
- Holy Private Bookmarks attribution preserved in extracted files (crypto.ts, data-model.ts).
- Pro features are GPL-3.0 but gated by ExtensionPay license checks via `useProGate()` hook.
- All Pro-gated features keep business logic in `lib/` (not components) for Option B readiness.
- The sync backend (hush-sync) is a SEPARATE proprietary repo. Never import hush-sync code into this extension.
- `lib/sync-client.ts` talks to the backend via HTTPS API only — zero backend logic in the extension.

## Tool Selection: LSP vs Grep/Glob

- **LSP** (goToDefinition, findReferences, hover): Use for navigating to definitions, finding all references to a symbol, and getting type info. Gives exact results.
- **Grep/Glob**: Use for discovery — finding files by pattern, searching for text across the codebase.
- After locating a file with Grep/Glob, prefer LSP to navigate within it rather than reading the whole file.
