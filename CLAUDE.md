# CLAUDE.md - Hush Private Bookmarks Conventions

## Project
Hush Private Bookmarks: Privacy-first browser extension for hidden bookmarks.
WXT + React + TypeScript + Tailwind CSS + shadcn/ui.
GPL-3.0 license. Repo: hush-private-bookmarks.

## Architecture Rules
- lib/ contains ZERO React/DOM imports. Pure TypeScript only.
- React components contain ZERO direct chrome.storage calls.
- All data flows through typed interfaces in lib/types.ts.
- No circular imports between lib/ modules.
- Use WXT's `browser` global, never raw `chrome.*`.
- Shared components/ directory imported by both popup and manager entrypoints.

## Crypto Rules (NON-NEGOTIABLE)
- All crypto via Web Crypto API. No external crypto libraries.
- PBKDF2 iterations >= 600,000. Never modify.
- AES-256-GCM only. Never ECB mode.
- Never hardcode IVs. Generate fresh for every operation.
- Never use Math.random() for anything crypto-related.
- Use @scure/bip39 for recovery phrase mnemonics.

## Code Quality
- Strict TypeScript: noImplicitAny, noUncheckedIndexedAccess.
- No empty catch blocks.
- No console.log in production code.
- Functions: ~50 lines max. Files: ~300 lines max.
- Tests required for every lib/ module.

## Error Handling
- Custom typed error classes (CryptoError, StorageError, etc.).
- No empty catch blocks. Always handle or rethrow.
- Sentry captures errors only — no URLs, no bookmark titles, no PII.

## Session Protocol
- One module per session.
- End every session: tsc --noEmit, vitest, eslint.
- Commit after every verified module.
- Start every session by reading this file + lib/types.ts.

## Import Rules
- Use WXT's browser global instead of chrome.*.
- Import types with `type` keyword.
- No circular imports between lib/ modules.
- Path aliases: @/components, @/lib.

## React Rules
- Functional components only. No class components.
- Hooks for state. No Redux/Zustand.
- shadcn/ui primitives in components/ui/ — never modify directly, extend via wrappers.
- React components: ~300 lines max.

## Sentry Rules (Privacy-Critical)
- beforeSend MUST strip all URLs and bookmark titles.
- Capture only: error class, stack trace, browser metadata.
- No breadcrumbs. No session replay. No user identifiers.
- DSN is public-facing — this is expected and safe.

## Bundle Budget
- Target: 200KB gzipped maximum.
- Alert at 180KB. Audit unused shadcn components and Tailwind classes.
- Check with: wxt build --analyze
```

