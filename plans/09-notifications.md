# Notifications & Real-Time

There are no notifications, no @mentions, and no real-time updates. Two users on the same board see drift until they refresh.

## A. "My Tasks" page (replaces notifications inbox for now)

A single page that surfaces everything personally relevant to the current user.

### Route

`src/app/my-tasks/page.js` — a server component that loads the current user, plus a `MyTasksView` client component for interactivity. Add a "My Tasks" link to `Navbar.js`.

### Sections

1. **Assigned to me** — open tickets where `assignee_id = me`, grouped by status, sorted by due date then priority.
2. **Mentioned me** (depends on B) — recent comments containing `@me` not yet acknowledged.
3. **Watching** — tickets where I'm a watcher (see `04-ticket-model.md`) with recent activity.
4. **Blockers cleared** — tickets I'm assigned to whose blockers have all moved to `done` in the last 7 days but whose own status is still backlog/in_progress.

### API

`GET /api/me/tasks` → returns `{ assigned: [...], mentions: [...], watching: [...], blockers_cleared: [...] }`. Reuse the existing ticket shape. All queries are scoped to the authenticated user.

### Styling

Reuse `TicketCard` and the existing list patterns. No new visual language — this is the "existing styling" the user asked for.

## B. @mentions in comments

When a comment contains `@username` (matching a real user), record a mention.

### Schema

```sql
CREATE TABLE IF NOT EXISTS mentions (
  id           TEXT PRIMARY KEY,
  comment_id   TEXT NOT NULL REFERENCES comments(id) ON DELETE CASCADE,
  ticket_id    TEXT NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  user_id      TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  acknowledged INTEGER NOT NULL DEFAULT 0,
  created_at   TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_mentions_user ON mentions(user_id, acknowledged);
```

### API

- `POST /api/tickets/[id]/comments`: after inserting the comment, parse `@(\w{1,8})` from the content, resolve each to a user, dedupe, insert one mention row per recipient (skipping the author).
- `GET /api/me/mentions` → unacknowledged mentions for the current user (used by My Tasks and a navbar badge).
- `POST /api/me/mentions/[id]/ack` → mark acknowledged (called when the user opens the ticket the mention points to).

### UI

- `CommentThread.js` comment composer: on `@`, open a small popover with users whose usernames match the typed prefix; insert `@username` on selection. Keep it lightweight — no rich text editor.
- Rendered comment content: highlight `@username` substrings.
- `Navbar.js` shows a small `(N)` next to "My Tasks" when unacknowledged mentions exist.

## C. Real-time updates

Replace poll-on-action with server-pushed events so concurrent users stay in sync. Use **Server-Sent Events** — it works in plain Next.js route handlers, no extra dependency, and we only need server→client push.

### Bus

A simple in-memory pub/sub in `src/lib/events.js`:

```js
const subscribers = new Set();
export function publish(event) { for (const s of subscribers) s(event); }
export function subscribe(handler) { subscribers.add(handler); return () => subscribers.delete(handler); }
```

Wire `publish` calls into the write endpoints:
- ticket created/updated/deleted → `{ kind: 'ticket', id, action }`
- comment posted/deleted → `{ kind: 'comment', ticket_id }`
- sprint status changed → `{ kind: 'sprint', id, action }`

### SSE endpoint

`GET /api/events` (auth required) — opens a `text/event-stream` response, subscribes the connection, writes JSON events, sends a keepalive ping every 25s, unsubscribes on close.

### Client

`src/lib/realtime.js` exposes a `useRealtime()` hook that opens a single `EventSource` per tab and dispatches events to subscribers. Components subscribe and refetch the slice they care about (`Board` refetches tickets, `TicketDetail` refetches the one ticket, etc.). Keep refetch granular to avoid full-page churn.

### Caveat

In-memory bus only works with a single Node process. The app already runs single-process (better-sqlite3 implies that), so this is fine. If we later scale, swap the bus for a tiny pg/redis pub/sub — interface stays the same.

## Acceptance

- "My Tasks" link in the navbar with a badge for unacknowledged mentions.
- Typing `@gav` in a comment shows a popover; selecting inserts `@gavin`; posting creates a mention row; the mentioned user sees a badge and entry in "Mentioned me".
- Two users on the same board: when one moves a card, the other's board updates within ~1s.
