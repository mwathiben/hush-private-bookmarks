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
| 09 | Background Service Worker | 1 | ✅ Complete | 5/5 | 31/31 |
| 10 | Popup UI — Auth Screens | 1 | ✅ Complete | 4/4 | 29/29 |
| 11 | Popup UI — Bookmark Management | 1 | ✅ Complete | 4/4 | 31/31 |
| 12 | Popup UI — Settings & Utilities | 1 | ✅ Complete | 5/5 | 31/31 |
| 13 | Full-Page Manager | 1 | ✅ Complete | 3/3 | 18/18 |
| 14 | Hush 1.0 Import | 1 | 🔄 In Progress | 0/4 | 0/23 |
| 15a | Cloud Sync Client | 1 | ⬜ Not Started | 0/4 | 0/21 |
| 16a | Payment Integration (ProGate) | 1 | ⬜ Not Started | 0/3 | 0/18 |
| 16b | Folder Locking (Free) | 1 | ⬜ Not Started | 0/4 | 0/25 |
| 16c | Tags & Search (Pro) | 1 | ⬜ Not Started | 0/5 | 0/22 |
| 16d | Panic Button (Pro) | 1 | ⬜ Not Started | 0/3 | 0/18 |
| 16e | New-Tab Dashboard (Pro) | 1 | ⬜ Not Started | 0/4 | 0/20 |
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
