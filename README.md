# Hush Private Bookmarks

Privacy-first browser extension for hidden bookmarks. Your bookmarks are encrypted locally and never leave your device unencrypted.

## Tech Stack

- **Framework**: [WXT](https://wxt.dev) (WebExtension Tooling)
- **UI**: React 19 + Tailwind CSS v4 + shadcn/ui
- **Language**: TypeScript (strict mode)
- **Crypto**: Web Crypto API (AES-256-GCM, PBKDF2)
- **Testing**: Vitest + Playwright
- **Targets**: Chrome, Firefox, Edge

## Features

- AES-256-GCM encryption with PBKDF2 key derivation (600K+ iterations)
- Encrypted bookmark storage via `browser.storage.local`
- Immutable bookmark tree with full CRUD operations
- Import from Chrome Bookmarks API and Netscape HTML format
- Encrypted JSON backup export/import
- Multiple password sets (separate encrypted vaults)
- BIP39 recovery phrases for password recovery
- Incognito mode detection and auto-unlock

## Development Progress

| Module | Status | Stories |
| ------ | ------ | ------- |
| Project Scaffold | Complete | 12/12 |
| Crypto Engine | Complete | 8/8 |
| Storage Layer | Complete | 6/6 |
| Data Model | Complete | 6/6 |
| Bookmark Import | Complete | 4/4 |
| Password Sets | Complete | 4/4 |
| BIP39 Recovery | Complete | 3/3 |
| Incognito Mode | Complete | 2/2 |
| Background Service Worker | Not Started | - |
| Popup UI | Not Started | - |
| Full-Page Manager | Not Started | - |
| Cloud Sync Client | Not Started | - |

**8 of 22 modules complete** (47 stories, 198 story points delivered)

## Development

```bash
npm install --legacy-peer-deps
npm run dev              # Dev mode (Chrome)
npm run dev:firefox      # Dev mode (Firefox)
npm run build            # Production build
npm run test             # Unit tests
npm run test:coverage    # Unit tests with coverage
npm run test:e2e         # Playwright E2E tests
npm run lint             # ESLint
npm run verify           # Full check: types + lint + tests + build
```

## Security

- All cryptography uses the Web Crypto API. No external crypto libraries.
- PBKDF2 iterations >= 600,000 (OWASP 2025 recommendation for SHA-256).
- Fresh random IV generated for every encryption operation.
- Recovery phrases use [@scure/bip39](https://github.com/nicolo-ribaudo/scure-bip39).
- Sentry error reporting strips all URLs, bookmark titles, and PII before transmission.

## License

GPL-3.0 -- see [LICENSE](LICENSE) for details.
