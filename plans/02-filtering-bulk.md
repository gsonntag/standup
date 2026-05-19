# Filtering, Search, and Bulk Operations

The backlog and board return every ticket, with no filtering and no bulk actions. Past ~50 tickets the views become unusable.

## Goals

1. Filter on the backlog and board by assignee, label, priority, and free text (title + ticket number).
2. Bulk operations: select N tickets and assign to a sprint, add/remove a label, change status, or delete.

## API changes

`GET /api/tickets` already supports `sprint_id`, `status`, `assignee_id`. Extend with:

- `priority` — exact match.
- `label_id` — repeatable; AND semantics (`HAVING COUNT(DISTINCT label_id) = N`).
- `q` — case-insensitive substring match on `title`. Also matches if `q` parses to an integer matching `number`.
- All filters must compose with the existing ones.

New endpoint `POST /api/tickets/bulk`:

```jsonc
{
  "ids": ["..."],
  "set": {                // any subset; same validation as PATCH
    "sprint_id": "...",
    "status": "...",
    "priority": "...",
    "assignee_id": "..."
  },
  "add_label_ids":    ["..."],
  "remove_label_ids": ["..."],
  "delete": false
}
```

Run the whole operation in a single SQLite transaction. Authorization mirrors single PATCH/DELETE rules (see `10-data-integrity.md` — only creators or admins may delete).

## UI changes

- New `<TicketFilterBar />` component used by both `BacklogView.js` and `Board.js`:
  - Text input (`q`), assignee select, priority select, multi-select label chips.
  - Active filters reflected in the URL query string so they survive reloads.
  - Debounce `q` by 200ms before refetching.
- Add a checkbox column on `BacklogView` rows and a checkbox in the top-left of each `TicketCard` on the board.
- When any selection exists, show a sticky "N selected" action bar with: "Move to sprint…", "Set status…", "Set priority…", "Set assignee…", "Add label…", "Remove label…", "Delete", "Clear".
- After bulk apply, clear selection and refetch.

## Acceptance

- Filtering by any combination of fields narrows the result; URL reflects state.
- Selecting 10 tickets and assigning to a sprint produces 1 request, 1 transaction, 1 refetch.
- Bulk delete obeys per-ticket creator/admin authorization; partial failures return `{ ok: false, failed_ids: [...] }` and the UI shows which ones survived.
