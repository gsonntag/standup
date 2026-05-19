# Sprint Lifecycle

Currently a sprint has dates and a status, and "complete" silently dumps unfinished tickets back to backlog. Tickets have no estimate, so there is no concept of capacity or velocity. There is also no retro.

## Goals

1. Add **story points** to tickets so a sprint has a measurable capacity and a computed velocity.
2. Make "Start sprint" reject a second active sprint (the API already does — surface the error).
3. On "Complete sprint", roll unfinished tickets into the next planning sprint (or back to backlog if none exists), as an explicit, confirmed choice.
4. Add a **retro page** per sprint where members anonymously post "went well" / "to improve" notes.

## Schema changes (`scripts/migrate.mjs`)

```sql
-- tickets: add story_points
ALTER TABLE tickets ADD COLUMN story_points INTEGER;

-- retros: notes attached to a sprint, anonymous
CREATE TABLE IF NOT EXISTS retro_notes (
  id         TEXT PRIMARY KEY,
  sprint_id  TEXT NOT NULL REFERENCES sprints(id) ON DELETE CASCADE,
  category   TEXT NOT NULL CHECK (category IN ('went_well', 'improve')),
  content    TEXT NOT NULL,
  author_id  TEXT NOT NULL REFERENCES users(id), -- stored for moderation; never returned in API
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_retro_notes_sprint ON retro_notes(sprint_id);
```

Use the `PRAGMA table_info(tickets)` pattern that already exists in `migrate.mjs` to add `story_points` conditionally.

## API changes

- `POST/PATCH /api/tickets` and `/api/tickets/[id]`: accept `story_points` (positive integer or null).
- `GET /api/sprints`: include `total_points` and `done_points` aggregates.
- `PATCH /api/sprints/[id]` when transitioning to `completed`: accept `rollover_to` body field:
  - `"backlog"` → current behavior (unfinished tickets to backlog).
  - `"<sprint_id>"` → move unfinished tickets to that sprint (must be `status='planning'`).
  - `"next_planning"` (default) → resolve server-side to the oldest planning sprint, or fall back to backlog if none.
  Wrap the move + status update in a single transaction.
- `GET /api/sprints/[id]/retro` → returns `{ notes: [{ id, category, content, created_at }] }` (no `author_id`).
- `POST /api/sprints/[id]/retro` → body `{ category, content }`. Any authed user. Content trimmed, max 2000 chars.
- `DELETE /api/sprints/[id]/retro/[noteId]` → admin only, or the original author if they want to delete their own. Server enforces via stored `author_id`; do not send it to the client.

## UI changes

- `CreateTicketForm.js` / `TicketDetail.js`: add a `Points` numeric field next to Priority.
- `SprintCard` in `SprintView.js`: show `points done / total points` alongside the ticket counts.
- `handleAction('start', ...)` in `SprintView.js` already alerts on a 409 from the API — keep that; just confirm the API returns a clear message.
- `handleAction('complete', ...)`: replace the confirm() with a small dialog offering "Move unfinished tickets to:" with a select listing planning sprints + "Backlog". Send `rollover_to` on PATCH.
- New route `src/app/sprints/[id]/retro/page.js` with a `RetroBoard` component:
  - Two columns: "Went well" / "To improve".
  - Inline "add a note" textarea per column.
  - Notes are listed anonymously, newest first.
  - Each note shows a Delete button only when the current user authored it (the client can track its own posted IDs in component state for the current session) or when the current user is admin.
- Add a "Retro" link on each sprint card.

## Acceptance

- Cannot have two active sprints (existing guard now surfaces in UI).
- Completing a sprint prompts the admin for a destination; tickets move there atomically.
- Tickets accept and display points; sprint header shows aggregated points.
- Any user can post a retro note; the API response never includes author info; admins and original authors can delete.
