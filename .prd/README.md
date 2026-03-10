# Hush Private Bookmarks — Build Plan

## Module Index

| # | Module | PRD Files | Status | Stories | Points |
| --- | --- | --- | --- | --- | --- |
| 01 | Project Scaffold | 1 | ✅ Complete | 12/12 | 48/48 |
| 02 | Crypto Engine | 1 | ✅ Complete | 8/8 | 25/25 |
| 03 | Storage Layer | 1 | ✅ Complete | 6/6 | 25/25 |
| 04 | Data Model | 1 | ✅ Complete | 6/6 | 32/32 |
| 05 | Bookmark Import | 1 | ✅ Complete | 4/4 | 23/23 |
| 06 | Password Sets | 1 | ✅ Complete | 4/4 | 19/19 |
| 07 | BIP39 Recovery | 1 | ✅ Complete | 3/3 | 16/16 |
| 08 | Incognito Mode | 1 | ✅ Complete | 2/2 | 8/8 |
| 09 | Background Service Worker | - | ⬜ Not Started | - | - |
| 10 | Popup UI — Auth Screens | - | ⬜ Not Started | - | - |
| 11 | Popup UI — Bookmark Management | - | ⬜ Not Started | - | - |
| 12 | Popup UI — Settings & Utilities | - | ⬜ Not Started | - | - |
| 13 | Full-Page Manager | - | ⬜ Not Started | - | - |
| 14 | Hush 1.0 Import | - | ⬜ Not Started | - | - |
| 15a | Cloud Sync Client | - | ⬜ Not Started | - | - |
| 16a | Payment Integration (ProGate) | - | ⬜ Not Started | - | - |
| 16b | Folder Locking (Free) | - | ⬜ Not Started | - | - |
| 16c | Tags & Search (Pro) | - | ⬜ Not Started | - | - |
| 16d | Panic Button (Pro) | - | ⬜ Not Started | - | - |
| 16e | New-Tab Dashboard (Pro) | - | ⬜ Not Started | - | - |
| 17 | Cross-Browser & E2E Tests | - | ⬜ Not Started | - | - |
| 18 | Store Prep & Launch Assets | - | ⬜ Not Started | - | - |

## Structure

Each module directory contains:

- `prd.json` — User stories, acceptance criteria, verification commands
- `progress.md` — Append-only session log (never overwrite previous entries)

For modules needing multiple PRDs: `prd-01-core.json`, `prd-02-advanced.json`, etc.

## Rules

- PRD files are git-tracked (progress is project history)
- Follow `progress_log.format_rules` in each `prd.json` for entry format
- Update this README after each module completes
