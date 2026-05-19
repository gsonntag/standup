# Audit Log

`PATCH /api/tickets/[id]` currently fakes history by inserting a synthetic comment when a non-creator edits (`tickets/[id]/route.js:93`). This pollutes the comment thread and is lost if a comment is deleted.

## Goals

1. Move change tracking out of `comments` into a dedicated, append-only `ticket_events` table.
2. Render events inline in the ticket detail timeline alongside comments, but as a distinct event type.
3. Stop writing synthetic system comments.
4. For any synthetic comments that already exist in the database, leave them in place but ensure they cannot be deleted (see `06-comments.md`).

## Schema (`scripts/migrate.mjs`)

```sql
CREATE TABLE IF NOT EXISTS ticket_events (
  id         TEXT PRIMARY KEY,
  ticket_id  TEXT NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  actor_id   TEXT NOT NULL REFERENCES users(id),
  kind       TEXT NOT NULL,              -- 'field_change', 'comment_deleted', etc.
  field      TEXT,                       -- e.g. 'status', 'assignee_id'
  old_value  TEXT,
  new_value  TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_events_ticket ON ticket_events(ticket_id, created_at);
```

## API changes

- `PATCH /api/tickets/[id]`: in the transaction that updates the row, also insert one `ticket_events` row per changed field (kind=`field_change`). Drop the existing synthetic-comment insert at line 93. Record events even when the editor is the creator — the old special-case only existed because thread spam was undesirable; with a separate table that concern goes away.
- `GET /api/tickets/[id]`: return `events: [...]` alongside `comments`. Each event includes `actor_username` for display.
- The timeline in `TicketDetail.js` merges events + comments by `created_at`. Events render as a one-line system row like `gavin changed status: in_progress → done`.

## Migration of existing synthetic comments

Don't try to retroactively translate them. They survive as comments but become undeletable (enforced in the comment delete endpoint by matching a known prefix or by a new `comments.kind` column — see `06-comments.md`).

## Acceptance

- Editing any field writes a `ticket_events` row.
- No new system comments are created.
- Ticket timeline shows events and comments interleaved chronologically.
