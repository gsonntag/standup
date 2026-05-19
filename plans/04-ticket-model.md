# Ticket Model Extensions

Add fields most teams expect on a ticket: story points (covered in `01-sprint-lifecycle.md`), due date, attachments listed as first-class entries, and watchers.

## Schema changes (`scripts/migrate.mjs`)

```sql
ALTER TABLE tickets ADD COLUMN due_date TEXT;   -- ISO date 'YYYY-MM-DD' or NULL

CREATE TABLE IF NOT EXISTS ticket_attachments (
  id          TEXT PRIMARY KEY,
  ticket_id   TEXT NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  url         TEXT NOT NULL,            -- /uploads/<filename>
  filename    TEXT NOT NULL,
  mime_type   TEXT NOT NULL,
  size_bytes  INTEGER NOT NULL,
  uploader_id TEXT NOT NULL REFERENCES users(id),
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_attachments_ticket ON ticket_attachments(ticket_id);

CREATE TABLE IF NOT EXISTS ticket_watchers (
  ticket_id TEXT NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  user_id   TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  PRIMARY KEY (ticket_id, user_id)
);
```

(Per-column `PRAGMA table_info` guard for `due_date`.)

## API changes

- `tickets` endpoints accept and return `due_date`. Validate `^\d{4}-\d{2}-\d{2}$` and parseable; null clears.
- Reuse the existing `/api/uploads` route to upload files; record a row in `ticket_attachments` on success (extend the upload endpoint to optionally take `ticket_id` and create the row).
- `GET /api/tickets/[id]` returns `attachments: [...]` and `watchers: [{ id, username }]`.
- `POST /api/tickets/[id]/watchers` and `DELETE /api/tickets/[id]/watchers/[userId]` — any user may watch/unwatch themselves; admins may add/remove anyone.
- When a user is assigned to a ticket, auto-insert them as a watcher (`INSERT OR IGNORE`).
- When a user comments on a ticket, auto-insert them as a watcher.

## UI changes

- `TicketDetail.js`: sidebar additions:
  - **Due** field with a `<input type="date">` (timezone handling in `12-polish.md`).
  - **Attachments** section listing rows (filename, size, link) with an "Attach file" button reusing `ImageUploadButton`.
  - **Watchers** section listing avatars/usernames with a "Watch / Unwatch" toggle for the current user. Admins see an "Add watcher…" picker.
- `TicketCard.js`: show a small calendar icon + due date when within 3 days or overdue.

## Acceptance

- Setting/clearing due date persists.
- Uploading an image via the description toolbar still inlines it; the "Attach file" button instead lists the file under Attachments and does not insert into description.
- Assigning a ticket auto-adds the assignee as watcher.
