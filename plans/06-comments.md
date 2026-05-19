# Comments: Soft Delete, No Edits, System-Comment Protection

Currently comments have no edit and no delete. The user wants:

- Users may "delete" their own textual comments — but the row is **never** removed from the database. Non-author users see the comment as struck through with placeholder text; admins still see the original content (also struck through).
- Users may **not** edit comments at all.
- Synthetic "System message" comments produced by the old audit-log behavior (see `05-audit-log.md`) must never be deletable.

## Schema (`scripts/migrate.mjs`)

```sql
ALTER TABLE comments ADD COLUMN kind         TEXT NOT NULL DEFAULT 'user';   -- 'user' | 'system'
ALTER TABLE comments ADD COLUMN deleted_at   TEXT;                            -- NULL = visible
ALTER TABLE comments ADD COLUMN deleted_by   TEXT REFERENCES users(id);
```

Use `PRAGMA table_info(comments)` guards.

Backfill: on first run, mark existing synthetic comments as `kind='system'`. Detect by the prefix pattern used today (`"<username> edited this ticket at"`). One-shot UPDATE in the migration is fine.

## API changes

`src/app/api/tickets/[id]/comments/route.js`:

- `POST` — unchanged, but always sets `kind='user'`.

New `src/app/api/tickets/[id]/comments/[commentId]/route.js`:

- `DELETE`:
  - 404 if not found.
  - 403 if `kind='system'` — system comments are never deletable, regardless of role.
  - 403 if `kind='user'` and the actor is neither the author nor an admin.
  - Soft-delete: set `deleted_at=datetime('now')`, `deleted_by=actor.id`. Do not `DELETE` the row.
- No `PATCH` endpoint — edits are not supported.

`GET /api/tickets/[id]` (and the comments list endpoint) returns each comment with:

```jsonc
{
  "id": "...",
  "content": "...",         // see redaction rule below
  "kind": "user" | "system",
  "author_username": "...",
  "created_at": "...",
  "deleted_at": "..." | null,
  "deleted_by_username": "..." | null
}
```

Redaction rule, applied server-side:

- If `deleted_at` is set **and** the requester is not admin, replace `content` with `"[deleted]"`.
- If the requester is admin, return the original `content` and let the UI render the strikethrough.

## UI changes

`CommentThread.js`:

- Render `kind='system'` rows with a muted, italicized style and no Delete button (covers existing synthetic rows after the system-comment-protection rule lands; new system rows shouldn't be created — see `05-audit-log.md`).
- For each `kind='user'` row:
  - Show a Delete button if `comment.author_username === currentUser.username` or `currentUser.role === 'admin'`, **and** `deleted_at` is null.
  - When `deleted_at` is set, render the content with `text-decoration: line-through` and append `(deleted by <username>)`.
- No edit affordance anywhere.

## Acceptance

- Deleting a comment hits the API once; the row remains; the visible content shows as struck-through (admin) or `[deleted]` (non-admin).
- A second delete returns 404/409 since `deleted_at` is already set.
- System-comment rows have no Delete button and the API rejects deletion attempts with 403.
- No way to edit comment text exists in UI or API.
