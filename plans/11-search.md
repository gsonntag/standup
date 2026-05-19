# Global Search

There is no way to find a ticket by number, title text, or label without navigating to the right view and scrolling.

## Goal

A keyboard-accessible global search that finds tickets across all sprints and the backlog by number, title, or label.

## API

`GET /api/search?q=...&limit=20` returns up to 20 matches, ranked:

1. Exact `number` match (when `q` parses as an integer).
2. Title prefix match.
3. Title substring match.
4. Label name match (return tickets carrying that label).

Each result: `{ id, number, title, status, sprint_id, sprint_name, labels: [...] }`. Reuse `attachLabels`.

Implementation note: SQLite `LIKE` with `?||'%'` for prefix and `'%'||?||'%'` for substring. Use `COLLATE NOCASE`. This is fine for our scale; no FTS needed.

## UI

- `Navbar.js` gets a search input. Pressing `/` (when not focused in another input) focuses it.
- A dropdown popover shows results as the user types (debounced 150ms). Arrow keys navigate, Enter opens the ticket.
- Each result row: `#42 Fix login redirect — Sprint 7  [bug]`.
- Esc closes the popover and blurs.

## Acceptance

- Typing `42` jumps to the ticket numbered 42 as the first result.
- Typing `login` finds tickets whose title contains "login" (case-insensitive).
- Typing a label name finds tickets carrying that label.
- `/` focuses the search input from anywhere on the page.
