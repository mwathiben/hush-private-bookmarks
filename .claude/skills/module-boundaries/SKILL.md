---
name: module-boundaries
description: "Enforces layered architecture and import direction rules for Hush Private Bookmarks. Triggers on any new file creation, any import/export statement, any file in lib/, components/, hooks/, entrypoints/, any code calling browser.storage or chrome.storage directly from React components, any React hook in lib/, any DOM API usage in lib/, any shared utility or helper function, any type definition, any file restructuring or refactoring, or any code review. Prevents the #1 failure mode from the original Holy Private Bookmarks codebase: 50% code duplication between popup and manager entrypoints."
---

# Module Boundaries — Hush Private Bookmarks

Proactive guardrail for architectural layering and import direction in this project. Every rule exists to prevent the catastrophic failure mode of the original "Holy Private Bookmarks" codebase: **50% code duplication between popup.js and manager.js**. Both entrypoints independently implemented bookmark CRUD, encryption, storage access, and UI rendering — making bugs twice as hard to fix and security patches easy to miss.

This skill enforces a strict three-layer architecture where code flows downward only: entrypoints import from components and hooks, components import from hooks and lib, hooks import from lib, and lib imports from nothing above it. Violations are architecture defects that lead to duplication, not style issues.

**Scope**: All files in `lib/`, `components/`, `hooks/`, `entrypoints/`, any import or export statement crossing layer boundaries, any new file creation, any type definition, any React hook, any `browser.storage` or `browser.*` API call, any DOM API usage.

---

## When to Activate

```text
Creating or modifying a file in lib/? ────────────yes──▶ ACTIVATE
                │
                no
                │
Creating or modifying a file in components/? ─────yes──▶ ACTIVATE
                │
                no
                │
Creating or modifying a file in hooks/? ──────────yes──▶ ACTIVATE
                │
                no
                │
Creating or modifying a file in entrypoints/? ────yes──▶ ACTIVATE
                │
                no
                │
Adding an import or export statement? ────────────yes──▶ ACTIVATE
                │
                no
                │
Adding a type or interface definition? ───────────yes──▶ ACTIVATE
                │
                no
                │
Writing a React hook that calls lib/ functions? ──yes──▶ ACTIVATE
                │
                no
                │
Calling browser.storage from a React component? ──yes──▶ ACTIVATE
                │
                no
                │
Using DOM APIs (document, window) in lib/? ────────yes──▶ ACTIVATE
                │
                no
                │
Refactoring or moving files between directories? ──yes──▶ ACTIVATE
                │
                no
                │
Code review or PR review? ─────────────────────────yes──▶ ACTIVATE
                │
                no
                │
SKIP
```

**Keyword triggers**: `import`, `export`, `lib/`, `components/`, `hooks/`, `entrypoints/`, `browser.storage`, `chrome.storage`, `browser.runtime`, `useEffect`, `useState`, `useCallback`, `useMemo`, `React`, `react-dom`, `jsx-runtime`, `document.`, `window.`, `HTMLElement`, `addEventListener`, `querySelector`, `localStorage`, `sessionStorage`, `types.ts`, `errors.ts`, shared, helper, utility, duplicate, extract, refactor, move file, new module.

## When NOT to Activate

- Editing CSS, Tailwind classes, or styles within an existing component (no structural change)
- Modifying test files that import from the module under test
- Editing `wxt.config.ts`, `tsconfig.json`, `package.json`, or other config files
- Writing documentation or comments within existing files
- Modifying `.env` files, build scripts, or CI configuration

---

## Quick Reference

| Constraint | Required Value | Violation Severity |
|-----------|---------------|-------------------|
| lib/ React imports | Zero — no `react`, `react-dom`, `jsx-runtime` | CRITICAL |
| lib/ DOM APIs | Zero — no `document`, `window`, `HTMLElement`, `addEventListener` | CRITICAL |
| Component storage calls | Zero — no direct `browser.storage.*` in `.tsx` files | CRITICAL |
| Import direction | Downward only: entrypoints → components/hooks → lib | CRITICAL |
| Cross-entrypoint imports | Forbidden — entrypoints are isolated JS contexts | CRITICAL |
| Business logic in components | Zero — delegate to lib/ functions via hooks | HIGH |
| Shared types location | `lib/types.ts` for domain types; colocated for component-specific types | HIGH |
| Error classes location | `lib/errors.ts` only — never scattered across modules | HIGH |
| Hooks location | `hooks/` directory at project root — not in `lib/`, not in `entrypoints/` | HIGH |
| Entrypoint helpers | Inside entrypoint subdirectory or extracted to `lib/`/`components/` — never directly in `entrypoints/` root | HIGH |
| browser API | `browser` from `wxt/browser` — never raw `chrome.*` | HIGH |
| Type imports | `import type { X }` for type-only imports | MEDIUM |
| Path aliases | `@/lib/`, `@/components/`, `@/hooks/` — never `../../lib/` relative traversals | MEDIUM |

---

## Canonical Import Direction Diagram

```text
┌─────────────────────────────────────────────────────────────────┐
│                        IMPORT RULES                             │
│                                                                 │
│  ✅ = allowed        ❌ = forbidden        ── = never exists    │
└─────────────────────────────────────────────────────────────────┘

                    ┌──────────────────────┐
                    │    entrypoints/      │
                    │  popup/  manager/    │
                    │  background.ts       │
                    │  content.ts          │
                    └──────┬───────────────┘
                           │
            ✅ imports from │          ❌ entrypoint → entrypoint
                           │             (isolated JS contexts,
                           ▼              import is impossible)
              ┌────────────────────────┐
              │     components/        │
              │  BookmarkList.tsx       │
              │  SearchBar.tsx         │
              │  ui/ (shadcn)          │
              └────────┬───────────────┘
                       │
          ✅ imports    │      ❌ components/ → entrypoints/
            from       │         (never import upward)
                       ▼
              ┌────────────────────────┐
              │       hooks/           │
              │  use-vault.ts          │
              │  use-bookmarks.ts      │
              └────────┬───────────────┘
                       │
          ✅ imports    │      ❌ hooks/ → components/
            from       │         (hooks don't know about UI)
                       │      ❌ hooks/ → entrypoints/
                       ▼
              ┌────────────────────────┐
              │        lib/            │
              │  types.ts  crypto.ts   │
              │  storage.ts errors.ts  │
              └────────────────────────┘
                       │
          ❌ lib/ → hooks/             (pure TS, no React)
          ❌ lib/ → components/        (pure TS, no React)
          ❌ lib/ → entrypoints/       (foundation, no upward deps)


  TYPE FLOW (import type only):
  ┌─────────────────────────────────────────────────────────────┐
  │  lib/types.ts ──────▶ imported by EVERYONE via import type  │
  │                       (entrypoints, components, hooks, lib) │
  └─────────────────────────────────────────────────────────────┘

  LAYER-SKIPPING (allowed):
  ┌─────────────────────────────────────────────────────────────┐
  │  entrypoints/ ──✅──▶ hooks/     (skip components layer)    │
  │  entrypoints/ ──✅──▶ lib/       (skip both layers)         │
  │  components/  ──✅──▶ lib/       (skip hooks layer)         │
  │  hooks/       ──✅──▶ lib/       (primary consumer)         │
  └─────────────────────────────────────────────────────────────┘

  INTRA-LAYER (allowed with constraints):
  ┌─────────────────────────────────────────────────────────────┐
  │  lib/module-A ──✅──▶ lib/module-B  (if no circular dep)    │
  │  lib/module-A ──❌──▶ lib/module-B ──▶ lib/module-A         │
  │                       (circular — FORBIDDEN)                │
  └─────────────────────────────────────────────────────────────┘

  WXT BROWSER API FLOW:
  ┌─────────────────────────────────────────────────────────────┐
  │  browser (from wxt/browser) used in:                        │
  │    ✅ lib/storage.ts    (primary storage abstraction)       │
  │    ✅ lib/             (messaging, alarms, runtime APIs)    │
  │    ✅ entrypoints/      (runtime setup, listeners)          │
  │    ❌ components/        (never — go through lib/ + hooks/) │
  │    ❌ hooks/             (never — go through lib/)          │
  └─────────────────────────────────────────────────────────────┘
```

---

## Hard Rules

### Rule 1: lib/ must be pure TypeScript — zero React, zero DOM

`lib/` is the foundation layer. It runs in every context: popup page, manager page, background service worker, content scripts. Service workers have no DOM. Content scripts have a different DOM. React is a UI concern.

Any React import (`react`, `react-dom`, `jsx-runtime`) or DOM API (`document`, `window`, `HTMLElement`, `addEventListener`, `querySelector`, `localStorage`, `sessionStorage`, `XMLHttpRequest`) in lib/ breaks portability and violates the architecture.

**WRONG — React import in lib/:**
```typescript
// lib/bookmarks.ts
import { useCallback } from 'react';

export function useBookmarkActions() {
  return useCallback(() => { /* ... */ }, []);
}
```

**WRONG — DOM API in lib/:**
```typescript
// lib/clipboard.ts
export function copyToClipboard(text: string): void {
  const el = document.createElement('textarea');
  el.value = text;
  document.body.appendChild(el);
  el.select();
  document.execCommand('copy');
  document.body.removeChild(el);
}
```

**WRONG — window reference in lib/:**
```typescript
// lib/storage.ts
export function getSessionToken(): string | null {
  return window.sessionStorage.getItem('token');
}
```

**WRONG — React JSX in lib/:**
```typescript
// lib/errors.ts
export function ErrorMessage({ error }: { error: Error }) {
  return <div className="error">{error.message}</div>;
}
```

**CORRECT — pure TypeScript in lib/:**
```typescript
// lib/bookmarks.ts
import type { Bookmark, BookmarkFolder } from '@/lib/types';

export function sortBookmarks(
  bookmarks: readonly Bookmark[],
  order: 'alpha' | 'date',
): Bookmark[] {
  return [...bookmarks].sort((a, b) =>
    order === 'alpha'
      ? a.title.localeCompare(b.title)
      : b.createdAt - a.createdAt
  );
}
```

**Allowed in lib/**: `globalThis.crypto` (Web Crypto API — available in all contexts including service workers), `browser` from `wxt/browser` (in lib/storage.ts only), `TextEncoder`/`TextDecoder`, `URL` constructor, `setTimeout`/`clearTimeout` (available in service workers), `fetch()`, `console` (dev only — no console.log in production per CLAUDE.md).

---

### Rule 2: React components must never directly call browser.storage

Components are the presentation layer. Storage is infrastructure. When components call storage directly, you get the original codebase's failure: both popup and manager independently implementing storage access, with divergent error handling, caching, and data transformation.

All storage access goes through `lib/storage.ts` functions, wrapped by React hooks in `hooks/` for reactivity.

**WRONG — direct storage call in component:**
```typescript
// components/BookmarkList.tsx
import { browser } from 'wxt/browser';

function BookmarkList() {
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);

  useEffect(() => {
    browser.storage.local.get('bookmarks').then((result) => {
      setBookmarks(JSON.parse(result.bookmarks));
    });
  }, []);
}
```

**WRONG — WXT storage API directly in component:**
```typescript
// components/BookmarkList.tsx
import { storage } from 'wxt/storage';

const bookmarkStore = storage.defineItem<string>('local:bookmarks');

function BookmarkList() {
  const [data, setData] = useState('');
  useEffect(() => {
    bookmarkStore.getValue().then(setData);
  }, []);
}
```

**WRONG — storage call hidden in a component utility function:**
```typescript
// components/BookmarkList.tsx
async function fetchBookmarks(): Promise<Bookmark[]> {
  const { vault } = await browser.storage.local.get('vault');
  return vault ? JSON.parse(vault) : [];
}

function BookmarkList() {
  useEffect(() => { fetchBookmarks().then(setBookmarks); }, []);
}
```

**CORRECT — lib/ function + hook + component:**
```typescript
// lib/storage.ts
import { browser } from 'wxt/browser';
import type { EncryptedVault } from '@/lib/types';
import { StorageError } from '@/lib/errors';

export async function loadEncryptedVault(): Promise<EncryptedVault | null> {
  try {
    const result = await browser.storage.local.get('vault');
    return result.vault ? (result.vault as EncryptedVault) : null;
  } catch (cause) {
    throw new StorageError('Failed to load vault', { cause });
  }
}

// hooks/use-vault.ts
import { useState, useEffect } from 'react';
import { loadEncryptedVault } from '@/lib/storage';
import type { EncryptedVault } from '@/lib/types';

export function useVault() {
  const [vault, setVault] = useState<EncryptedVault | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadEncryptedVault()
      .then(setVault)
      .finally(() => setLoading(false));
  }, []);

  return { vault, loading };
}

// components/BookmarkList.tsx — zero storage logic
import { useVault } from '@/hooks/use-vault';

function BookmarkList() {
  const { vault, loading } = useVault();
  if (loading) return <Spinner />;
  // ... pure rendering
}
```

---

### Rule 3: All shared domain types must live in lib/types.ts

Domain types (`Bookmark`, `BookmarkFolder`, `EncryptedVault`, `SessionState`) used across multiple modules must be defined in `lib/types.ts`. This is the single source of truth for the data model.

Component-specific types (prop interfaces, local state types, form field types) should be colocated with the component that uses them — not in `lib/types.ts`.

**WRONG — types scattered across modules:**
```typescript
// lib/crypto.ts
export interface EncryptedPayload {
  salt: Uint8Array;
  iv: Uint8Array;
  ciphertext: Uint8Array;
}

// lib/storage.ts — duplicate definition with different fields
interface Bookmark {
  id: string;
  title: string;
  url: string;
}
```

**WRONG — domain types defined in a component file:**
```typescript
// components/BookmarkList.tsx
export interface Bookmark {
  id: string;
  title: string;
  url: string;
  createdAt: number;
}
```

**WRONG — component-specific types polluting lib/types.ts:**
```typescript
// lib/types.ts
export interface BookmarkListProps {
  onSelect: (id: string) => void;
  className?: string;
}

export interface SearchBarFormState {
  query: string;
  isExpanded: boolean;
}
```

**CORRECT — domain types centralized in lib/types.ts:**
```typescript
// lib/types.ts
export interface Bookmark {
  readonly id: string;
  readonly title: string;
  readonly url: string;
  readonly createdAt: number;
  readonly folderId: string;
}

export interface BookmarkFolder {
  readonly id: string;
  readonly name: string;
  readonly parentId: string | null;
}

export interface EncryptedVault {
  readonly salt: Uint8Array;
  readonly iv: Uint8Array;
  readonly ciphertext: Uint8Array;
  readonly version: number;
}
```

**CORRECT — component-specific types colocated:**
```typescript
// components/BookmarkList.tsx
import type { Bookmark } from '@/lib/types';

interface BookmarkListProps {
  readonly bookmarks: readonly Bookmark[];
  readonly onSelect: (id: string) => void;
}

function BookmarkList({ bookmarks, onSelect }: BookmarkListProps) {
  // ...
}
```

---

### Rule 4: No circular imports between lib/ modules

Circular imports cause initialization order bugs (variables are `undefined` when accessed), make testing harder (mocking one module requires mocking the other), and indicate tangled responsibilities. Each lib/ module should have a clear, narrow purpose.

**WRONG — circular dependency:**
```typescript
// lib/crypto.ts
import { loadSalt } from '@/lib/storage';

export async function encryptBookmarks(password: string, data: string): Promise<EncryptedVault> {
  const salt = await loadSalt(); // crypto depends on storage
  // ...
}

// lib/storage.ts
import { encrypt } from '@/lib/crypto';

export async function saveBookmarks(password: string, bookmarks: Bookmark[]): Promise<void> {
  const encrypted = await encrypt(password, JSON.stringify(bookmarks)); // storage depends on crypto — CIRCULAR
  await browser.storage.local.set({ vault: encrypted });
}
```

**CORRECT — break the cycle by pushing orchestration up:**
```typescript
// lib/crypto.ts — only knows about cryptographic operations
import type { EncryptedPayload } from '@/lib/types';

export async function encrypt(
  password: string,
  plaintext: string,
  salt: Uint8Array,
): Promise<EncryptedPayload> { /* ... */ }

export async function decrypt(
  password: string,
  payload: EncryptedPayload,
): Promise<string> { /* ... */ }

// lib/storage.ts — only knows about persistence
import type { EncryptedVault } from '@/lib/types';
import { browser } from 'wxt/browser';

export async function saveVault(vault: EncryptedVault): Promise<void> {
  await browser.storage.local.set({ vault });
}

export async function loadVault(): Promise<EncryptedVault | null> {
  const result = await browser.storage.local.get('vault');
  return result.vault ?? null;
}

// hooks/use-vault.ts — coordinates crypto + storage
import { encrypt, decrypt } from '@/lib/crypto';
import { saveVault, loadVault } from '@/lib/storage';
```

**Detection heuristic**: If module A imports from module B AND module B imports from module A (directly or transitively through other lib/ modules), this is a circular dependency. Extract shared logic into a third module, or push the coordination up to the hooks/entrypoint layer.

---

### Rule 5: Shared React components go in components/, not duplicated in entrypoints

The entire point of this architecture is to prevent the 50% duplication disaster. Any React component used by both popup and manager (or potentially usable by both) must live in `components/`.

**WRONG — duplicate component in each entrypoint:**
```
entrypoints/
  popup/
    BookmarkItem.tsx    ← copy A
    App.tsx
  manager/
    BookmarkItem.tsx    ← copy B (diverges over time)
    App.tsx
```

**WRONG — shared component placed in one entrypoint, imported by another:**
```typescript
// entrypoints/manager/App.tsx
import { BookmarkItem } from '../popup/BookmarkItem';
// TypeScript may compile this, but at runtime popup/ and manager/
// are separate HTML pages with separate JS bundles — this import
// pulls popup code into manager's bundle in unpredictable ways
```

**CORRECT — shared components in components/:**
```
components/
  BookmarkItem.tsx      ← single source of truth
  BookmarkList.tsx
  SearchBar.tsx
  LockScreen.tsx
  ui/                   ← shadcn/ui primitives (never modify directly)
    button.tsx
    input.tsx
    dialog.tsx
entrypoints/
  popup/
    App.tsx              ← imports from @/components/
  manager/
    App.tsx              ← imports from @/components/
```

**Guideline**: If a component is currently used by only one entrypoint but is domain-generic (e.g., `BookmarkItem`, `LockScreen`, `FolderTree`), put it in `components/` anyway. Duplication sneaks in when the second entrypoint is built and the developer creates a "quick copy" instead of importing the shared version.

**Exception**: Layout components specific to one entrypoint (e.g., `PopupLayout.tsx` that sets 400x600 dimensions, `ManagerSidebar.tsx` for the full-page view) may live inside that entrypoint's directory, since they are genuinely entrypoint-specific and will never be shared.

---

### Rule 6: entrypoints/ directories must not contain shared helper files

WXT auto-discovers entrypoints. Every `.ts`/`.tsx`/`.html` file directly in `entrypoints/` becomes an entrypoint (background script, content script, unlisted page, or unlisted script). Placing shared code directly in `entrypoints/` turns helpers into entrypoints that get bundled separately and included in the manifest.

**WRONG — helper file directly in entrypoints/:**
```
entrypoints/
  background.ts
  utils.ts              ← WXT treats this as an unlisted script entrypoint!
  constants.ts          ← WXT treats this as an unlisted script entrypoint!
  helpers.ts            ← WXT treats this as an unlisted script entrypoint!
```

**WRONG — "shared" file inside one entrypoint, imported by another:**
```
entrypoints/
  popup/
    shared-helpers.ts   ← lives in popup's bundle
  manager/
    App.tsx             ← import from '../popup/shared-helpers' compiles but
                           pulls popup helpers into manager bundle incorrectly
```

**CORRECT — shared code outside entrypoints/:**
```
lib/
  bookmarks.ts          ← shared logic
  formatters.ts         ← shared formatters
components/
  BookmarkItem.tsx      ← shared UI
hooks/
  use-vault.ts          ← shared hooks
entrypoints/
  popup/
    App.tsx             ← imports from @/lib, @/components, @/hooks
  manager/
    App.tsx             ← imports from @/lib, @/components, @/hooks
```

**Exception**: Helper files private to a single entrypoint may live inside that entrypoint's subdirectory (e.g., `entrypoints/popup/popup-layout.tsx`). They must never be imported by another entrypoint.

---

### Rule 7: Use WXT's browser global, never raw chrome.*

WXT's `browser` abstraction works across Chrome, Firefox, Edge, and Safari. It provides a promise-based API in both MV2 and MV3. Raw `chrome.*` calls break in Firefox, use callbacks instead of promises, and fail type-checking.

**WRONG — raw chrome API:**
```typescript
chrome.storage.local.get('key', (result) => {
  console.log(result);
});

chrome.runtime.sendMessage({ type: 'unlock' });
chrome.bookmarks.getTree((tree) => { /* ... */ });
```

**WRONG — mixing chrome and browser:**
```typescript
const data = await browser.storage.local.get('key');
chrome.runtime.sendMessage({ type: 'lock' }); // inconsistent
```

**CORRECT — auto-imported global in entrypoints:**
```typescript
// entrypoints/background.ts — browser is auto-imported by WXT
export default defineBackground(() => {
  browser.runtime.onInstalled.addListener((details) => {
    if (details.reason === 'install') {
      // first install setup
    }
  });
});
```

**CORRECT — explicit import in lib/ files:**
```typescript
// lib/storage.ts
import { browser } from 'wxt/browser';

export async function loadVault(): Promise<EncryptedVault | null> {
  const result = await browser.storage.local.get('vault');
  return result.vault ?? null;
}
```

---

### Rule 8: Import types with the type keyword

TypeScript's `import type` syntax ensures type-only imports are erased at compile time, producing zero runtime code. This prevents accidentally pulling a module into the bundle for side effects when you only need its types. It also makes import intent explicit — reviewers can immediately see which imports are for types vs. runtime values.

**WRONG — importing types as values:**
```typescript
import { Bookmark, BookmarkFolder } from '@/lib/types';
```

**WRONG — mixed import without type separation:**
```typescript
import { encrypt, EncryptedPayload } from '@/lib/crypto';
// EncryptedPayload is a type but imported alongside runtime values
```

**CORRECT — type-only import:**
```typescript
import type { Bookmark, BookmarkFolder } from '@/lib/types';
```

**CORRECT — mixed value and type imports with inline type modifier:**
```typescript
import { encrypt, type EncryptedPayload } from '@/lib/crypto';
```

**CORRECT — separate import statements:**
```typescript
import { encrypt } from '@/lib/crypto';
import type { EncryptedPayload } from '@/lib/crypto';
```

---

### Rule 9: Path alias usage conventions

Use `@/lib/`, `@/components/`, `@/hooks/` path aliases for all cross-layer imports. Never use relative paths that traverse upward beyond the current directory (`../../`). This makes imports readable, refactor-safe, and consistent across the codebase.

**WRONG — deep relative paths:**
```typescript
// entrypoints/popup/App.tsx
import { sortBookmarks } from '../../lib/bookmarks';
import { BookmarkList } from '../../components/BookmarkList';
import { useVault } from '../../hooks/use-vault';
```

**WRONG — inconsistent alias usage in the same file:**
```typescript
import { encrypt } from '@/lib/crypto';
import { loadVault } from '../../lib/storage';
```

**WRONG — using ~/ instead of @/ (both work but pick one):**
```typescript
import { encrypt } from '~/lib/crypto';
import type { Bookmark } from '@/lib/types'; // mixed aliases
```

**CORRECT — consistent @/ aliases:**
```typescript
// entrypoints/popup/App.tsx
import { BookmarkList } from '@/components/BookmarkList';
import { useVault } from '@/hooks/use-vault';
import type { Bookmark } from '@/lib/types';
```

**Exception**: Relative imports within the same directory are fine and preferred:
```typescript
// entrypoints/popup/App.tsx
import './App.css';
```

---

### Rule 10: No business logic in React components

Components render UI and dispatch user actions. Business logic — data transformation, validation, encryption orchestration, bookmark CRUD operations, sorting, filtering, deduplication — belongs in `lib/` functions. Components access business logic through hooks that wrap lib/ calls with React state management.

This is the second most important rule after the duplication rule (Rule 5). When business logic lives in components, the same logic must be duplicated when a different component needs it.

**WRONG — business logic in event handler:**
```typescript
// components/AddBookmark.tsx
function AddBookmark() {
  const handleSave = async () => {
    const id = crypto.randomUUID();
    const bookmark = { id, title, url, createdAt: Date.now(), folderId: currentFolder };
    const json = JSON.stringify(bookmarks.concat(bookmark));
    const key = await deriveKey(password, salt);
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, encoder.encode(json));
    await browser.storage.local.set({ vault: { salt, iv, ciphertext: encrypted } });
  };
}
```

**WRONG — inline data transformation:**
```typescript
// components/BookmarkList.tsx
function BookmarkList({ bookmarks }: { bookmarks: Bookmark[] }) {
  const sorted = [...bookmarks].sort((a, b) => b.createdAt - a.createdAt);
  const filtered = sorted.filter(b => b.title.toLowerCase().includes(query.toLowerCase()));
  const grouped = filtered.reduce((acc, b) => {
    (acc[b.folderId] ??= []).push(b);
    return acc;
  }, {} as Record<string, Bookmark[]>);
  // ...
}
```

**CORRECT — thin component, thick lib/:**
```typescript
// lib/bookmarks.ts
export function createBookmark(title: string, url: string, folderId: string): Bookmark {
  return { id: crypto.randomUUID(), title, url, createdAt: Date.now(), folderId };
}

export function filterBookmarks(bookmarks: readonly Bookmark[], query: string): Bookmark[] {
  const lower = query.toLowerCase();
  return bookmarks.filter(b => b.title.toLowerCase().includes(lower));
}

export function groupByFolder(bookmarks: readonly Bookmark[]): ReadonlyMap<string, Bookmark[]> {
  const map = new Map<string, Bookmark[]>();
  for (const b of bookmarks) {
    const group = map.get(b.folderId) ?? [];
    group.push(b);
    map.set(b.folderId, group);
  }
  return map;
}

// hooks/use-bookmarks.ts — wraps lib/ with React state
import { createBookmark, filterBookmarks } from '@/lib/bookmarks';
import { saveVault } from '@/lib/storage';
import { encrypt } from '@/lib/crypto';

export function useBookmarks() {
  // orchestrates lib/ calls with React state management
}

// components/AddBookmark.tsx — thin
function AddBookmark() {
  const { addBookmark } = useBookmarks();
  const handleSave = () => addBookmark(title, url);
}
```

---

### Rule 11: No direct DOM manipulation in lib/

`lib/` modules run in the background service worker context (MV3), where `document` and `window` do not exist. Even if a lib/ function is only called from popup/manager today, it may be called from the background script tomorrow. Keep lib/ context-agnostic.

This is related to Rule 1 but specifically targets DOM APIs that aren't React but are still DOM-dependent.

**WRONG — DOM API in lib/:**
```typescript
// lib/export.ts
export function downloadAsFile(data: string, filename: string): void {
  const blob = new Blob([data], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}
```

**WRONG — DOM event listener in lib/:**
```typescript
// lib/session.ts
export function startAutoLockTimer(timeout: number): void {
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      window.setTimeout(lockSession, timeout);
    }
  });
}
```

**WRONG — window.location in lib/:**
```typescript
// lib/navigation.ts
export function openManagerPage(): void {
  window.open(browser.runtime.getURL('/manager.html'), '_blank');
}
```

**CORRECT — pure data in lib/, DOM interaction in hooks/components:**
```typescript
// lib/export.ts — pure data transformation only
export function serializeBookmarksForExport(
  bookmarks: readonly Bookmark[],
): string {
  return JSON.stringify({ version: 1, bookmarks }, null, 2);
}

// hooks/use-export.ts — DOM interaction
import { serializeBookmarksForExport } from '@/lib/export';

export function useExportBookmarks() {
  const download = useCallback((bookmarks: readonly Bookmark[]) => {
    const data = serializeBookmarksForExport(bookmarks);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'hush-bookmarks-export.json';
    a.click();
    URL.revokeObjectURL(url);
  }, []);

  return { download };
}

// lib/session.ts — pure function, no DOM
export function isSessionExpired(lastActivity: number, timeout: number): boolean {
  return Date.now() - lastActivity > timeout;
}

// hooks/use-auto-lock.ts — DOM-dependent behavior
import { isSessionExpired } from '@/lib/session';

export function useAutoLock(timeout: number) {
  useEffect(() => {
    const handler = () => {
      if (document.hidden && isSessionExpired(lastActivity, timeout)) {
        lock();
      }
    };
    document.addEventListener('visibilitychange', handler);
    return () => document.removeEventListener('visibilitychange', handler);
  }, [timeout, lastActivity]);
}
```

---

### Rule 12: Error classes centralized in lib/errors.ts

All custom error classes live in `lib/errors.ts`. This prevents duplicate error class definitions, ensures consistent error typing across the codebase, and provides a single registry of all error types for Sentry filtering and `beforeSend` scrubbing.

**WRONG — error class defined inline in another module:**
```typescript
// lib/crypto.ts
class CryptoError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CryptoError';
  }
}

// lib/storage.ts — different pattern, different location
class StorageError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'StorageError';
  }
}
```

**WRONG — error class defined in a component:**
```typescript
// components/BookmarkForm.tsx
class ValidationError extends Error {
  constructor(public readonly field: string, message: string) {
    super(message);
  }
}
```

**CORRECT — all error classes in lib/errors.ts:**
```typescript
// lib/errors.ts
export class CryptoError extends Error {
  constructor(
    message: string,
    readonly operation: 'encrypt' | 'decrypt' | 'deriveKey' | 'generateSalt',
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = 'CryptoError';
  }
}

export class StorageError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = 'StorageError';
  }
}

export class SessionError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = 'SessionError';
  }
}

export class ValidationError extends Error {
  constructor(
    message: string,
    readonly field: string,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = 'ValidationError';
  }
}

// lib/crypto.ts — imports from errors.ts
import { CryptoError } from '@/lib/errors';

export async function encrypt(/* ... */): Promise<EncryptedPayload> {
  try {
    // ...
  } catch (cause) {
    throw new CryptoError('Encryption failed', 'encrypt', { cause });
  }
}
```

---

### Rule 13: Hooks that wrap lib/ calls go in hooks/, not in lib/

React hooks (functions starting with `use`) depend on React's `useState`, `useEffect`, `useCallback`, etc. They belong in the presentation layer. Placing them in `lib/` violates Rule 1 (pure TypeScript, no React). Hooks serve as the bridge between lib/ pure functions and React component state.

WXT auto-imports exports from the `hooks/` directory, so hooks placed there are automatically available throughout the project without explicit imports (though explicit imports are recommended for clarity).

**WRONG — hook in lib/:**
```typescript
// lib/use-bookmarks.ts
import { useState, useEffect } from 'react'; // VIOLATES Rule 1

export function useBookmarks() {
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);
  // ...
}
```

**WRONG — hook in a random location:**
```typescript
// utils/hooks.ts — ambiguous, not in the standard hooks/ directory
```

**WRONG — hook inside an entrypoint directory:**
```typescript
// entrypoints/popup/use-vault.ts — only available to popup, not manager
```

**CORRECT — hooks in hooks/ at project root:**
```
hooks/
  use-vault.ts
  use-bookmarks.ts
  use-session.ts
  use-search.ts
```

```typescript
// hooks/use-vault.ts
import { useState, useEffect, useCallback } from 'react';
import { loadEncryptedVault, saveEncryptedVault } from '@/lib/storage';
import { decrypt, encrypt } from '@/lib/crypto';
import type { EncryptedVault, Bookmark } from '@/lib/types';

export function useVault(password: string | null) {
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!password) return;
    loadEncryptedVault()
      .then((vault) => vault ? decrypt(password, vault) : '[]')
      .then((json) => setBookmarks(JSON.parse(json)))
      .finally(() => setLoading(false));
  }, [password]);

  return { bookmarks, loading };
}
```

---

## Claude-Specific Pitfalls

These are failure modes observed in Claude-generated code for browser extensions. Each one has been seen in practice or is a high-probability mistake given Claude's training data.

### Pitfall 1: Inlining storage calls directly in React components

The single most common violation. Claude generates `useEffect` blocks that call `browser.storage.local.get()` directly inside components, because it's the shortest path to working code. This is the exact pattern that caused the original 50% duplication.

**WRONG:**
```typescript
// components/BookmarkList.tsx
function BookmarkList() {
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);

  useEffect(() => {
    const load = async () => {
      const { vault } = await browser.storage.local.get('vault');
      if (vault) {
        const decrypted = await decrypt(password, vault);
        setBookmarks(JSON.parse(decrypted));
      }
    };
    load();
  }, [password]);
}
```

**Why it fails**: This component contains storage access, decryption orchestration, and JSON parsing. When the manager page needs the same data, the developer copies the entire `useEffect` — creating divergent implementations.

**Fix**: `lib/storage.ts` → `hooks/use-vault.ts` → component.

---

### Pitfall 2: Duplicating helper functions between popup/ and manager/

Claude builds popup first, gets it working, then when asked to build the manager page, copies utility functions into the manager's directory instead of extracting them to `lib/` or `components/`.

**WRONG:**
```
entrypoints/popup/utils.ts     ← formatDate, sortBookmarks, filterBySearch
entrypoints/manager/utils.ts   ← formatDate, sortBookmarks, filterBySearch (copy-pasted)
```

**Fix**: Before creating any function in an entrypoint directory, check: "Does this function depend on React or DOM?" If no → `lib/`. If yes (hook) → `hooks/`. If yes (component) → `components/`.

---

### Pitfall 3: Putting React hooks in lib/

Claude sees that hooks contain "logic" and places them in `lib/` alongside other logic modules. But hooks import from `react`, which violates Rule 1.

**WRONG:**
```typescript
// lib/use-session.ts
import { useState, useCallback } from 'react';

export function useSession() {
  const [isLocked, setIsLocked] = useState(true);
  // ...
}
```

**Fix**: Hooks go in `hooks/` at project root. They bridge `lib/` (pure) and `components/` (React).

---

### Pitfall 4: Using chrome.storage instead of WXT's browser.storage

Claude's training data contains far more `chrome.*` examples than WXT's `browser.*`. It defaults to `chrome.storage.local.get()` even in a WXT project.

**WRONG:**
```typescript
chrome.storage.local.get('key', (result) => {
  // callback style — not even promise-based
});
```

**CORRECT:**
```typescript
const result = await browser.storage.local.get('key');
```

---

### Pitfall 5: Creating utility files inside entrypoints/ root

Claude creates `entrypoints/helpers.ts` or `entrypoints/constants.ts` to share between entrypoints. WXT treats every file directly in `entrypoints/` as an entrypoint — `helpers.ts` becomes an unlisted script bundled into the extension.

**WRONG:**
```
entrypoints/
  background.ts
  constants.ts    ← becomes an unlisted script!
  formatters.ts   ← becomes an unlisted script!
```

**Fix**: Move to `lib/constants.ts`, `lib/formatters.ts`.

---

### Pitfall 6: Importing from one entrypoint into another

Claude treats entrypoint directories like normal directories and writes cross-imports. This may compile but fails conceptually — each entrypoint runs in an isolated JavaScript context (separate HTML page or service worker). The import works at build time because the bundler resolves it, but it means manager's bundle now contains popup code, duplicating rather than sharing.

**WRONG:**
```typescript
// entrypoints/manager/App.tsx
import { LockScreen } from '../popup/LockScreen';
```

**Fix**: `LockScreen` goes in `components/LockScreen.tsx`, imported by both entrypoints via `@/components/LockScreen`.

---

### Pitfall 7: Putting business logic in React event handlers

Claude inlines multi-step operations in `onClick`/`onSubmit` handlers instead of delegating to lib/ functions. This makes the logic untestable (can't test without rendering the component) and non-reusable.

**WRONG:**
```typescript
const handleDelete = async (id: string) => {
  const updated = bookmarks.filter(b => b.id !== id);
  const json = JSON.stringify(updated);
  const encrypted = await encrypt(password, json);
  await browser.storage.local.set({ vault: encrypted });
  setBookmarks(updated);
};
```

**Fix**: `lib/bookmarks.ts` exports `removeBookmark()`. `hooks/use-bookmarks.ts` wraps it. Component calls `deleteBookmark(id)`.

---

### Pitfall 8: Creating "god modules" in lib/

Claude consolidates all coordination logic into a single `lib/vault.ts` that imports from every other lib/ module. This creates a module that depends on everything and is impossible to test in isolation.

**WRONG:**
```typescript
// lib/vault.ts — god module
import { encrypt, decrypt, deriveKey } from '@/lib/crypto';
import { loadVault, saveVault, loadSalt } from '@/lib/storage';
import { sortBookmarks, filterBookmarks, createBookmark } from '@/lib/bookmarks';
import { createSession, validateSession, isExpired } from '@/lib/session';
import { CryptoError, StorageError, SessionError } from '@/lib/errors';
```

**Why it fails**: This module is now impossible to test without mocking 5 other modules. It also creates potential circular dependency chains as other lib/ modules start needing vault utilities.

**Fix**: Orchestration happens at the hooks/entrypoint layer, not inside lib/. Each lib/ module has a focused responsibility and imports from at most 1-2 other lib/ modules (types and errors).

---

### Pitfall 9: Circular imports between lib/crypto.ts and lib/storage.ts

Claude makes `crypto.ts` load salts from storage and `storage.ts` encrypt data before saving. This creates a circular dependency that causes subtle initialization bugs.

**WRONG:**
```typescript
// lib/crypto.ts
import { getSalt } from '@/lib/storage'; // crypto → storage

// lib/storage.ts
import { encrypt } from '@/lib/crypto';  // storage → crypto — CIRCULAR
```

**Fix**: `crypto.ts` receives salt as a parameter. `storage.ts` receives encrypted data as a parameter. The coordination (load salt → derive key → encrypt → save) happens in `hooks/use-vault.ts`.

---

### Pitfall 10: Using window or document in lib/ modules

Claude uses `window.addEventListener`, `document.visibilityState`, or `window.location` in lib/ for session timeout, auto-lock, or URL detection. These APIs do not exist in the MV3 background service worker, where `lib/` modules may also be imported.

**WRONG:**
```typescript
// lib/session.ts
export function startAutoLockTimer(timeout: number): void {
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      window.setTimeout(lockSession, timeout);
    }
  });
}
```

**Fix**: lib/ exports pure functions. DOM-dependent behavior goes in hooks.

---

### Pitfall 11: Forgetting that background.ts is a service worker

Claude uses `localStorage`, `sessionStorage`, `document.cookie`, `XMLHttpRequest`, or `window` in background script code. MV3 service workers have none of these.

**WRONG:**
```typescript
// entrypoints/background.ts
export default defineBackground(() => {
  const token = localStorage.getItem('session');
  window.addEventListener('focus', () => { /* ... */ });
  const xhr = new XMLHttpRequest();
});
```

**Fix**:
- `localStorage` → `browser.storage.local` or `browser.storage.session`
- `window.addEventListener('focus')` → `browser.windows.onFocusChanged.addListener()`
- `XMLHttpRequest` → `fetch()`
- `document.*` → not available, rethink the approach

---

### Pitfall 12: Type assertions (as any) to work around missing type exports

When `lib/types.ts` is incomplete, Claude reaches for `as any`, `as unknown as X`, or `@ts-ignore` to silence type errors instead of adding the missing type definition.

**WRONG:**
```typescript
const vault = result.vault as any;
const bookmarks = JSON.parse(data) as Bookmark[]; // no runtime validation
(event.target as any).value; // lazy casting
```

**CORRECT:**
```typescript
// Add the missing type to lib/types.ts, then use it properly
import type { EncryptedVault } from '@/lib/types';

const vault: EncryptedVault | undefined = result.vault;
if (!vault) throw new StorageError('Vault not found');
```

---

### Pitfall 13: Putting component-specific types in lib/types.ts

Claude over-centralizes by dumping every interface into `lib/types.ts`, including React prop types, form state types, and UI-only types that no other module needs. This bloats the types file and creates false coupling.

**WRONG:**
```typescript
// lib/types.ts
export interface BookmarkListProps {
  onSelect: (id: string) => void;
  className?: string;
}

export interface SearchBarFormState {
  query: string;
  isExpanded: boolean;
}

export interface ConfirmDialogOptions {
  title: string;
  description: string;
  confirmLabel: string;
}
```

**Fix**: Only domain types shared across 2+ modules go in `lib/types.ts`. `BookmarkListProps` belongs in `components/BookmarkList.tsx`. `SearchBarFormState` belongs in `components/SearchBar.tsx`.

---

### Pitfall 14: Importing an entire lib module when only types are needed

Claude writes `import { encrypt, type EncryptedPayload } from '@/lib/crypto'` when the file only uses `EncryptedPayload` as a type annotation. This pulls the entire crypto module (with its Web Crypto API dependencies) into the bundle unnecessarily.

**WRONG:**
```typescript
// components/VaultStatus.tsx
import { encrypt, decrypt, type EncryptedPayload } from '@/lib/crypto';
// encrypt and decrypt are runtime imports pulled into the bundle
// but only EncryptedPayload is used for a type annotation

function VaultStatus({ vault }: { vault: EncryptedPayload }) {
  return <span>{vault.version}</span>;
}
```

**CORRECT:**
```typescript
import type { EncryptedVault } from '@/lib/types';

function VaultStatus({ vault }: { vault: EncryptedVault }) {
  return <span>{vault.version}</span>;
}
```

---

## Pre-Commit Verification Checklist

Before marking any architecture-related task as complete, verify ALL of the following.

### Layer Purity

- [ ] Zero `react`, `react-dom`, or `jsx-runtime` imports in any `lib/` file
- [ ] Zero `document.*`, `window.*`, `HTMLElement`, `addEventListener`, `querySelector` in any `lib/` file
- [ ] Zero `localStorage`, `sessionStorage`, `XMLHttpRequest` in any `lib/` file
- [ ] Zero `browser.storage.*` or `chrome.storage.*` calls in any `components/` or `hooks/` file
- [ ] Zero `browser.*` calls in `components/` files (all browser API access through lib/)
- [ ] Zero `browser.*` calls in `hooks/` files (all browser API access through lib/)
- [ ] Zero React hooks (`useState`, `useEffect`, `useCallback`, `useMemo`, `useRef`) in any `lib/` file
- [ ] Zero JSX syntax (`<Component />`, `React.createElement`) in any `lib/` file
- [ ] Zero business logic (data transformation, validation, CRUD, filtering, sorting) in React event handlers
- [ ] All error classes defined exclusively in `lib/errors.ts`

### Import Direction

- [ ] No `lib/` file imports from `components/`, `hooks/`, or `entrypoints/`
- [ ] No `hooks/` file imports from `components/` or `entrypoints/`
- [ ] No `components/` file imports from `entrypoints/`
- [ ] No entrypoint imports from a different entrypoint directory
- [ ] No circular imports between `lib/` modules (A → B → A, or A → B → C → A)
- [ ] All cross-layer imports use path aliases (`@/lib/`, `@/components/`, `@/hooks/`)
- [ ] Zero relative imports with `../../` traversal across layer boundaries
- [ ] All type-only imports use `import type` or inline `type` modifier

### No Duplication

- [ ] No function, hook, or component exists in both `entrypoints/popup/` and `entrypoints/manager/`
- [ ] No domain type (`Bookmark`, `EncryptedVault`, etc.) is defined in multiple files
- [ ] No error class is defined outside `lib/errors.ts`
- [ ] Shared React components live in `components/`, not copied into entrypoint directories
- [ ] Shared hooks live in `hooks/`, not copied into entrypoint directories
- [ ] Shared pure functions live in `lib/`, not duplicated anywhere

### WXT Compliance

- [ ] Zero `chrome.*` API calls anywhere — all use `browser` from `wxt/browser`
- [ ] No helper files placed directly in `entrypoints/` root (they become entrypoints)
- [ ] No helper files in one entrypoint subdirectory imported by another
- [ ] Background service worker code uses zero DOM APIs
- [ ] `browser` is explicitly imported (`import { browser } from 'wxt/browser'`) in `lib/` files
- [ ] `browser` is used as auto-imported global in entrypoint files (no explicit import needed)

### Type Safety

- [ ] Zero `as any` type assertions on cross-layer boundaries
- [ ] Zero `@ts-ignore` or `@ts-expect-error` suppressing import errors
- [ ] All exported `lib/` functions have explicit return type annotations
- [ ] Component-specific types (props, local state) are colocated with their component
- [ ] Domain types shared across 2+ modules are defined in `lib/types.ts`
- [ ] All `lib/types.ts` interfaces use `readonly` on properties that should not be mutated
- [ ] `tsc --noEmit` passes with zero errors
