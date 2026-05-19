# Description Save: One Write Per Edit

`TicketDetail.js:140,147` saves the description on **both** blur and the explicit "Done" button. Two PATCHes per edit, and the order is race-prone if blur fires while the Done handler is in flight.

## Fix

Pick a single save trigger and remove the other.

Recommended: keep **"Done"** as the only commit action. Blur should not save, because users often blur to scroll, click an image picker, etc. — and a blur-save defeats the purpose of an explicit edit mode.

Behavior:

- Entering edit mode snapshots the current description into local state.
- Typing only updates local state.
- "Done" PATCHes if and only if the value differs from the snapshot, then exits edit mode.
- "Cancel" discards local state and exits edit mode.
- Navigating away with unsaved changes prompts via `beforeunload` (optional, keep simple).

Drop the blur handler entirely. If we want autosave later, add a debounced timer (≥1s of idle) and gate the Done button to no-op when nothing changed — but do not combine that with a blur save.

## Acceptance

- One PATCH per edit session.
- Blur does not save.
- Clicking Done with no change makes no network request.
