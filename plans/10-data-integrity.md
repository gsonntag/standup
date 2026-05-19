# Data Integrity & API Authorization

## 1. Dependency cycle prevention

`ticket_dependencies` has only a self-reference CHECK. `A blocks B, B blocks A` is insertable today.

### Fix

In the dependency insert endpoint, before inserting `(ticket_id=A, depends_on_id=B)`:

1. Reject if `A == B` (already covered by CHECK, defense in depth).
2. Walk the existing graph **from B following `depends_on_id`** edges — if A is reachable, refuse with 409 "Would create a cycle".

```sql
-- recursive CTE
WITH RECURSIVE reach(id) AS (
  SELECT depends_on_id FROM ticket_dependencies WHERE ticket_id = ?  -- start from B
  UNION
  SELECT td.depends_on_id
  FROM ticket_dependencies td
  JOIN reach r ON td.ticket_id = r.id
)
SELECT 1 FROM reach WHERE id = ? LIMIT 1;  -- look for A
```

If the SELECT returns a row, return `jsonError('Adding this dependency would create a cycle.', 409)`.

## 2. Delete authorization

`DELETE /api/tickets/[id]` (`tickets/[id]/route.js:107`) is open to any authed user.

### Fix

- Allow when actor is admin **or** actor is the ticket creator (`creator_id`).
- Otherwise 403.

```js
if (user.role !== 'admin' && existing.creator_id !== user.id) {
  return jsonError('Only the ticket creator or an admin can delete this ticket.', 403);
}
```

Apply the same rule to bulk delete (`02-filtering-bulk.md`) per ticket.

UI: hide the Delete button in `TicketDetail.js` when neither condition holds.

## 3. Pagination on GET /api/tickets

Currently returns every ticket. Add cursor- or offset-based pagination.

### Approach

Offset-based is simplest and fits the existing UI:

- Accept `limit` (default 100, max 500) and `offset` (default 0).
- Return `{ tickets: [...], total }` so the UI can render pagination controls or "Load more".

For the board, the board fetches by `sprint_id` — typical sprints are small, so a higher default cap (say 500) is fine and no UI paging is needed there.

For the backlog, add a `Load more` button under the list that bumps `offset` until `offset + tickets.length >= total`.

Combine cleanly with filters from `02-filtering-bulk.md`.

## Acceptance

- Attempting to create a cycle returns 409 and the dependency picker surfaces the error.
- A non-creator non-admin sees no Delete button and gets 403 from the API.
- `GET /api/tickets?limit=50` returns at most 50 plus a `total` count.
