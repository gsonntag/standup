# Phase 4: API Routes

## Goal

Build all REST API endpoints. After this phase, every data operation the frontend needs is available via `fetch()`.

Every route must:
1. Call `getCurrentUser()` and return 401 if null
2. Return JSON responses
3. Use proper HTTP status codes

---

## Helper: `src/lib/api.js`

Create this helper to reduce boilerplate in every route:

```js
import { getCurrentUser } from './auth';
import { NextResponse } from 'next/server';

/**
 * Wraps an API handler with auth check.
 * Usage: export const GET = withAuth(async (request, user) => { ... })
 */
export function withAuth(handler) {
  return async (request, context) => {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    return handler(request, user, context);
  };
}

/**
 * Wraps an API handler with admin-only check.
 */
export function withAdmin(handler) {
  return withAuth(async (request, user, context) => {
    if (user.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    return handler(request, user, context);
  });
}

export function jsonOk(data) {
  return NextResponse.json(data);
}

export function jsonError(message, status = 400) {
  return NextResponse.json({ error: message }, { status });
}
```

---

## Route: `GET /api/tickets`

**File**: `src/app/api/tickets/route.js`

Returns all tickets. Accepts optional query params for filtering.

**Query params** (all optional):
- `sprint_id` — filter by sprint. Use `none` for unsprinted tickets.
- `status` — filter by status
- `assignee_id` — filter by assignee

**Response** (200):
```json
{
  "tickets": [
    {
      "id": "uuid",
      "number": 1,
      "title": "Fix login bug",
      "description": "...",
      "status": "todo",
      "priority": "high",
      "sort_order": 0,
      "sprint_id": "uuid" | null,
      "assignee_id": "uuid" | null,
      "assignee_username": "gavin" | null,
      "creator_id": "uuid",
      "creator_username": "gavin",
      "created_at": "2026-05-19T00:00:00.000Z",
      "updated_at": "2026-05-19T00:00:00.000Z",
      "labels": [{ "id": "uuid", "name": "bug", "color": "#e53e3e" }],
      "blocker_count": 0,
      "unresolved_blocker_count": 0
    }
  ]
}
```

**Implementation notes**:
- Base query joins `users` twice (assignee, creator)
- Labels: do a second query `SELECT l.* FROM labels l JOIN ticket_labels tl ON ...` for each ticket, OR use GROUP_CONCAT to inline them
- For blocker counts, use subqueries:
  - `blocker_count`: `SELECT COUNT(*) FROM ticket_dependencies WHERE ticket_id = t.id`
  - `unresolved_blocker_count`: `SELECT COUNT(*) FROM ticket_dependencies td JOIN tickets dep ON dep.id = td.depends_on_id WHERE td.ticket_id = t.id AND dep.status != 'done'`
- Order by `sort_order ASC, created_at DESC`

**Recommended approach for labels**: Query tickets first, then batch-query all labels for returned ticket IDs:

```js
const ticketIds = tickets.map(t => t.id);
const placeholders = ticketIds.map(() => '?').join(',');
const labelRows = db.prepare(`
  SELECT tl.ticket_id, l.id, l.name, l.color
  FROM ticket_labels tl
  JOIN labels l ON l.id = tl.label_id
  WHERE tl.ticket_id IN (${placeholders})
`).all(...ticketIds);
```

Then group by ticket_id and attach to each ticket.

---

## Route: `POST /api/tickets`

**File**: same file as GET

**Request body**:
```json
{
  "title": "Fix login bug",
  "description": "## Summary\n...",
  "priority": "high",
  "sprint_id": "uuid" | null,
  "assignee_id": "uuid" | null
}
```

**Validation**:
- `title` required, non-empty string
- `priority` must be one of: `low`, `medium`, `high`, `urgent`
- `sprint_id` if provided must exist in sprints table
- `assignee_id` if provided must exist in users table

**Logic**:
1. Generate UUID for `id`
2. `number` is set by the trigger (pass NULL)
3. `status` defaults to `backlog`
4. `creator_id` = current user's ID
5. `sort_order` = `(SELECT COALESCE(MAX(sort_order), 0) + 1 FROM tickets)` (add to end)
6. Insert and return the created ticket

**Response** (201):
```json
{ "ticket": { ...full ticket object... } }
```

---

## Route: `GET /api/tickets/[id]`

**File**: `src/app/api/tickets/[id]/route.js`

Returns a single ticket with all details including labels, dependencies (blockers), and tickets it unblocks.

**Response** (200):
```json
{
  "ticket": {
    "id": "uuid",
    "number": 1,
    "title": "...",
    "...all fields...",
    "labels": [{ "id": "...", "name": "bug", "color": "#e53e3e" }],
    "blockers": [
      { "id": "uuid", "number": 3, "title": "Setup DB", "status": "done" }
    ],
    "unblocks": [
      { "id": "uuid", "number": 5, "title": "Add tests", "status": "todo" }
    ]
  }
}
```

**Queries for dependencies**:
```sql
-- Blockers: tickets that THIS ticket depends on
SELECT t.id, t.number, t.title, t.status
FROM ticket_dependencies td
JOIN tickets t ON t.id = td.depends_on_id
WHERE td.ticket_id = ?

-- Unblocks: tickets that depend on THIS ticket
SELECT t.id, t.number, t.title, t.status
FROM ticket_dependencies td
JOIN tickets t ON t.id = td.ticket_id
WHERE td.depends_on_id = ?
```

---

## Route: `PATCH /api/tickets/[id]`

**File**: same as GET [id]

Updates a ticket. Only send fields you want to change.

**Request body** (all optional):
```json
{
  "title": "New title",
  "description": "...",
  "status": "in_progress",
  "priority": "urgent",
  "sprint_id": "uuid" | null,
  "assignee_id": "uuid" | null,
  "sort_order": 2
}
```

**Logic**:
1. Build UPDATE query dynamically based on which fields are present
2. Always set `updated_at = datetime('now')`
3. Validate enum values if status or priority are being changed
4. Return updated ticket

**Response** (200):
```json
{ "ticket": { ...updated ticket... } }
```

---

## Route: `DELETE /api/tickets/[id]`

**File**: same as GET [id]

Deletes a ticket and all its comments, labels, and dependencies (via CASCADE).

**Response** (200):
```json
{ "ok": true }
```

---

## Route: `GET /api/tickets/[id]/comments`

**File**: `src/app/api/tickets/[id]/comments/route.js`

**Response** (200):
```json
{
  "comments": [
    {
      "id": "uuid",
      "content": "Looks good to me",
      "author_id": "uuid",
      "author_username": "gavin",
      "created_at": "2026-05-19T..."
    }
  ]
}
```

Query: `SELECT c.*, u.username as author_username FROM comments c JOIN users u ON u.id = c.author_id WHERE c.ticket_id = ? ORDER BY c.created_at ASC`

---

## Route: `POST /api/tickets/[id]/comments`

**File**: same as GET comments

**Request body**:
```json
{ "content": "This looks good" }
```

**Validation**: `content` required, non-empty.

**Logic**: Insert with `author_id` = current user. Return created comment.

**Response** (201):
```json
{ "comment": { ...created comment... } }
```

---

## Route: `POST /api/tickets/[id]/dependencies`

**File**: `src/app/api/tickets/[id]/dependencies/route.js`

Adds a dependency. "This ticket is blocked by `depends_on_id`."

**Request body**:
```json
{ "depends_on_id": "uuid" }
```

**Validation**:
- `depends_on_id` must exist in tickets
- Cannot depend on self (`ticket_id != depends_on_id` — also enforced by DB CHECK)
- Cannot create duplicate dependency (use INSERT OR IGNORE or check first)

**Response** (201):
```json
{ "ok": true }
```

---

## Route: `DELETE /api/tickets/[id]/dependencies`

**File**: same as POST dependencies

Removes a dependency.

**Request body**:
```json
{ "depends_on_id": "uuid" }
```

**Response** (200):
```json
{ "ok": true }
```

---

## Route: `GET /api/sprints` and `POST /api/sprints`

**File**: `src/app/api/sprints/route.js`

### GET
Returns all sprints ordered by `start_date DESC`.

Include ticket counts per sprint:
```sql
SELECT s.*,
  (SELECT COUNT(*) FROM tickets WHERE sprint_id = s.id) as ticket_count,
  (SELECT COUNT(*) FROM tickets WHERE sprint_id = s.id AND status = 'done') as done_count
FROM sprints s
ORDER BY start_date DESC
```

**Response** (200):
```json
{
  "sprints": [
    {
      "id": "uuid",
      "name": "Sprint 1",
      "status": "active",
      "start_date": "2026-06-01",
      "end_date": "2026-06-14",
      "ticket_count": 8,
      "done_count": 3,
      "created_at": "..."
    }
  ]
}
```

### POST (admin only)
Creates a sprint.

**Request body**:
```json
{
  "name": "Sprint 1",
  "start_date": "2026-06-01",
  "end_date": "2026-06-14"
}
```

**Validation**:
- `name` required
- `start_date` and `end_date` required, must be valid date strings (YYYY-MM-DD)
- `end_date` must be after `start_date`

**Response** (201): `{ "sprint": { ... } }`

---

## Route: `PATCH /api/sprints/[id]` and `DELETE /api/sprints/[id]`

**File**: `src/app/api/sprints/[id]/route.js`

### PATCH (admin only)
Updates sprint fields.

**Request body** (all optional):
```json
{
  "name": "Sprint 1 - Extended",
  "status": "active",
  "start_date": "2026-06-01",
  "end_date": "2026-06-14"
}
```

**Special logic for status changes**:
- When changing status to `active`: check no other sprint is currently active. If one is, return 400 with error "Another sprint is already active."
- When changing status to `completed`: move all non-done tickets in this sprint back to backlog:
  ```sql
  UPDATE tickets SET sprint_id = NULL, status = 'backlog' WHERE sprint_id = ? AND status != 'done'
  ```

### DELETE (admin only)
Deletes a sprint. All tickets in this sprint get `sprint_id = NULL` (via ON DELETE SET NULL).

**Response** (200): `{ "ok": true }`

---

## Route: `GET /api/labels` and `POST /api/labels`

**File**: `src/app/api/labels/route.js`

### GET
Returns all labels ordered by name.

**Response** (200):
```json
{
  "labels": [
    { "id": "uuid", "name": "bug", "color": "#e53e3e" }
  ]
}
```

### POST
Creates a label. Any authenticated user can create labels.

**Request body**:
```json
{ "name": "bug", "color": "#e53e3e" }
```

**Validation**:
- `name` required, non-empty, unique (return 400 if duplicate)
- `color` required, must be one of the 16 preset colors from `constants.js`

**Response** (201): `{ "label": { ... } }`

---

## Route: `DELETE /api/labels/[id]`

**File**: `src/app/api/labels/[id]/route.js`

Deletes a label. Removes from all tickets via CASCADE.

**Response** (200): `{ "ok": true }`

---

## Route: `POST /api/tickets/[id]/labels`

**File**: `src/app/api/tickets/[id]/labels/route.js`

Adds or removes a label from a ticket.

### POST — Add label
**Request body**: `{ "label_id": "uuid" }`
**Logic**: `INSERT OR IGNORE INTO ticket_labels (ticket_id, label_id) VALUES (?, ?)`
**Response** (200): `{ "ok": true }`

### DELETE — Remove label
**Request body**: `{ "label_id": "uuid" }`
**Logic**: `DELETE FROM ticket_labels WHERE ticket_id = ? AND label_id = ?`
**Response** (200): `{ "ok": true }`

---

## Route: `GET /api/users` and `POST /api/users`

**File**: `src/app/api/users/route.js`

### GET
Returns all users (without passwords).

**Response** (200):
```json
{
  "users": [
    { "id": "uuid", "username": "gavin", "role": "admin", "created_at": "..." }
  ]
}
```

Query: `SELECT id, username, role, created_at FROM users ORDER BY username ASC`

### POST (admin only)
Creates a new user from the web UI.

**Request body**:
```json
{ "username": "newuser", "password": "secret123" }
```

**Validation**:
- `username`: required, lowercase only, max 8 chars, must match `/^[a-z][a-z0-9]*$/`, unique
- `password`: required, min 4 chars

**Logic**:
1. Hash password with `bcrypt.hashSync(password, 10)`
2. Generate UUID
3. Insert with role `member`

**Response** (201): `{ "user": { "id": "...", "username": "...", "role": "member" } }`

---

## Verification

Test each endpoint with `curl` or a tool like Insomnia. You must be logged in (have a session cookie) for all endpoints except `/api/auth/login`.

Example test flow:
```bash
# Login and save cookie
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"yourpass"}' \
  -c cookies.txt

# Create a label
curl -X POST http://localhost:3000/api/labels \
  -H "Content-Type: application/json" \
  -d '{"name":"bug","color":"#e53e3e"}' \
  -b cookies.txt

# Create a ticket
curl -X POST http://localhost:3000/api/tickets \
  -H "Content-Type: application/json" \
  -d '{"title":"Fix login bug","priority":"high"}' \
  -b cookies.txt

# List tickets
curl http://localhost:3000/api/tickets -b cookies.txt
```

All endpoints return proper JSON and status codes → Phase 4 complete.
