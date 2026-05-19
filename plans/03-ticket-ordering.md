# Per-Column Ticket Ordering

`tickets.sort_order` is a single global integer (set to max+1 on create). The board's drag-and-drop in `Board.js` only PATCHes the status of the dragged ticket; it does not reorder within a column. There is no way to prioritize within a column.

## Approach

Keep a single `sort_order` column but make it meaningful **within the scope of (sprint_id, status)** — that is the only scope that needs ordering today. When a ticket changes status or sprint, recompute its `sort_order` relative to its new column.

## API changes

Extend `PATCH /api/tickets/[id]` to accept a positional move:

```jsonc
{
  "status": "in_progress",       // optional; may be unchanged
  "sprint_id": "...",            // optional; may be unchanged
  "position": {
    "before_id": "...",          // place immediately before this ticket
    "after_id":  "...",          // OR after this ticket
    "index":     3               // OR a 0-based index in the column
  }
}
```

Server logic (single transaction):

1. Resolve the target column = `(sprint_id, status)` after the update.
2. Load all ticket IDs in that column ordered by `sort_order ASC, created_at DESC`.
3. Remove the moved ticket from the list (if present), splice it in at the requested position.
4. Rewrite `sort_order` for the affected rows with a monotonic sequence (e.g. multiples of 1024) so future single-row inserts don't require a full rewrite.

For `BacklogView` (no status column on the backlog itself), order within `(sprint_id IS NULL, status='backlog')` — same logic, just one column.

## UI changes

- `Board.js`: wrap each column's cards with `@dnd-kit/sortable`'s `SortableContext`. On drop, compute the target column and the neighbor IDs (`before_id`/`after_id`) and PATCH once. Keep the existing optimistic update; on failure, revert (see `08-board-ux.md`).
- `BacklogView.js`: make rows sortable too (single column).

## Migration notes

- No schema change required.
- On first deploy, run a one-off `UPDATE` to renumber existing `sort_order` per column so the spacing is sane. Add this as a migrate step keyed on a `migrations_applied` row, or just accept the first manual move per column will rewrite a column's worth of rows.

## Acceptance

- Dragging within a column persists across reload.
- Dragging across columns updates both `status` and `sort_order` atomically.
- API rejects `position` references to tickets in a different column.
