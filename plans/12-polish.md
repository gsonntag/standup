# Polish: Empty States & Timezone-Aware Dates

## 1. Empty-state guidance

Only the sprints page shows a useful empty state today ("No sprints"). New users see blank boards, empty backlogs, and no labels with no idea what to do.

### Add empty-state blocks to:

- **Backlog** (`BacklogView.js`): "Your backlog is empty. Create a ticket to get started." plus a primary "New Ticket" button (reuse the existing create form trigger).
- **Board** (`Board.js`): when there is no active sprint at all, render "No active sprint. Start one from the Sprints page." with a link. When there is an active sprint but no tickets, render "No tickets in this sprint. Move tickets from the backlog or create new ones."
- **Sprints** (`SprintView.js`): replace "No sprints" with "No sprints yet. Admins can create one with **+ New Sprint**." Show only the prompt that applies to the viewer's role.
- **Team** (`TeamView.js`): if labels list is empty on the labels page, prompt to create one. If team list shows only the current user, say "You're the only user. Admins can add team members on this page."
- **My Tasks** (when added — see `09-notifications.md`): per-section empty copy ("Nothing assigned to you", "No mentions", etc.).

Empty-state styling: reuse the existing `.empty` class so the look stays consistent.

## 2. Timezone-aware due dates

Sprint dates and (new) ticket due dates are stored as raw `YYYY-MM-DD` strings. Today's logic that compares to `new Date()` (browser) implicitly uses the user's system locale, which is fine — but server-side checks that decide "is overdue" must use the **user's** timezone, not the server's.

### Decision

Store dates as `YYYY-MM-DD` (unchanged). Comparison happens **only on the client**, using the browser's local timezone — which is "the user's timezone" for our purposes (we have no separate per-user TZ setting and we don't want one).

### Rules

- Server never decides "is overdue". It just stores and returns the date string.
- Any "due today" / "overdue" badge in `TicketCard` or `TicketDetail` computes the comparison on the client using `new Date()` against the parsed date.
- Use a single helper `src/lib/dates.js`:

```js
export function isOverdue(yyyyMmDd) {
  if (!yyyyMmDd) return false;
  const [y, m, d] = yyyyMmDd.split('-').map(Number);
  const due = new Date(y, m - 1, d);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return due < today;
}
export function daysUntil(yyyyMmDd) { /* same construction; return difference in days */ }
```

- Use the helper everywhere we need to decide overdue or "due soon". No `Date.parse(string)` — that uses UTC for `YYYY-MM-DD` and produces off-by-one errors at midnight UTC for users west of GMT.

### Server check exception

If `9-notifications.md`'s "Blockers cleared" or any future server-side "due soon" digest needs an overdue check, take the user's `timezone` from a new optional `users.timezone` field (IANA name like `America/Los_Angeles`) with a sensible default. Out of scope for this round — keep all date comparisons client-side for now.

## Acceptance

- Empty backlog/board/sprints/team views explain the next action.
- Setting a due date of "tomorrow" never renders as "overdue" for any browser timezone.
- No date comparison logic exists on the server beyond simple ordering.
