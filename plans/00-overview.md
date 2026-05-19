# Implementation Plans — Overview

This directory contains plans for the next round of improvements to the scrum app. Plans are grouped by topic and are intended to be implementable independently, though some build on each other.

## Files

| File | Topic |
|------|-------|
| `01-sprint-lifecycle.md` | Estimation, active-sprint guard, rollover-on-complete, retro page |
| `02-filtering-bulk.md` | Backlog/board filters, search, bulk operations |
| `03-ticket-ordering.md` | Per-column ordering wired to drag-and-drop |
| `04-ticket-model.md` | Story points, due dates, attachments, watchers |
| `05-audit-log.md` | Real history table; system-comment protection |
| `06-comments.md` | Comment soft-delete with admin visibility (no edits) |
| `07-description-save.md` | Single-write description save |
| `08-board-ux.md` | WIP limits, swimlanes, optimistic-rollback feedback |
| `09-notifications.md` | My Tasks page, @mentions, real-time updates |
| `10-data-integrity.md` | Dependency cycle prevention, delete authorization, pagination |
| `11-search.md` | Global search across tickets |
| `12-polish.md` | Empty states, timezone-aware due dates |

## Database migration approach

Every plan that requires schema changes must be added to `scripts/migrate.mjs` as additive, idempotent statements (using `CREATE TABLE IF NOT EXISTS` and the existing `PRAGMA table_info` pattern for new columns). Never drop or rename existing columns.

## Order of implementation (recommended)

1. **Audit log + comments + description save** (`05`, `06`, `07`) — straightforward, removes existing pollution.
2. **Ticket model + ordering** (`03`, `04`) — schema foundation many later features need.
3. **Sprint lifecycle + data integrity** (`01`, `10`) — correctness fixes.
4. **Filtering/bulk + search + board UX + polish** (`02`, `08`, `11`, `12`) — UX layer.
5. **Notifications** (`09`) — biggest scope, do last.
