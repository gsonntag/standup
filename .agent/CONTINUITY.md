# Continuity

## [PLANS]
- 2026-05-19T00:19:44-0700 [USER] Implement plans 01 through 11 from `plans/`, building the Scrum Platform MVP end to end.

## [DECISIONS]
- 2026-05-19T00:19:44-0700 [CODE] Workspace had plans only and no git repository; scaffolded a Next.js App Router project directly in place instead of relying on `create-next-app` generated files.
- 2026-05-19T00:39:05-0700 [CODE] Pinned Next to the 15 major line (`15.5.18` installed) to match the plans; added a PostCSS override to use `8.5.14` in the installed tree.
- 2026-05-19T00:39:05-0700 [CODE] Added minimal Dockerfile, docker-compose.yml, .dockerignore, and repo `AGENTS.md` because the workspace guidance requires a container workflow when none exists.

## [PROGRESS]
- 2026-05-19T00:19:44-0700 [TOOL] Read `plans/00-overview.md` through `plans/11-labels.md`; plan 12 is post-MVP/future Discord scope and is intentionally out of scope for "through plan 11".
- 2026-05-19T00:39:05-0700 [CODE] Implemented the MVP app through plan 11: auth/session APIs, database migrations, ticket/sprint/label/user APIs, board, backlog, ticket modal, comments, dependencies, labels, sprints, team admin UI, and utilitarian global CSS.
- 2026-05-19T10:56:25-0700 [CODE] Added admin-only role management on the team page: `PATCH /api/users/[id]` validates member/admin roles, blocks self role changes, and `TeamView` shows role selectors for other users when the current user is admin.
- 2026-05-19T10:57:48-0700 [TOOL] Reset local SQLite data at user request: deleted sessions, tickets, sprints, labels, comments, dependencies, ticket labels, and non-admin users; kept/created `admin` with role `admin` and reset its password.
- 2026-05-19T10:58:53-0700 [CODE] Added admin-only user deletion on team page: `DELETE /api/users/[id]` blocks self-delete, deletes the target user's sessions/comments, unassigns their tickets, reassigns created tickets to the deleting admin, and removes the user.
- 2026-05-19T11:03:45-0700 [CODE] Fixed stale-session auth flow: protected pages now call `requireCurrentUser()` and redirect to `/login` when `getCurrentUser()` returns null; protected client fetches use `apiFetch()` to redirect on API 401 responses.
- 2026-05-19T11:03:45-0700 [CODE] Added description image uploads: authenticated `POST /api/uploads` stores PNG/JPG/GIF/WebP files under `public/uploads` with a 5 MB limit; create/edit ticket description UIs can upload images, insert markdown, and show a local preview.
- 2026-05-19T11:06:36-0700 [CODE] Added sprint date preset buttons in `CreateSprintForm`: start date can be set to today; end date can be set to today + 1 week or today + 2 weeks.
- 2026-05-19T11:13:30-0700 [CODE] Enlarged backlog title presentation: backlog table now uses a fixed layout and ticket titles render as larger full-width clickable boxes.
- 2026-05-19T11:13:30-0700 [CODE] Replaced raw description preview with a dependency-free markdown-style renderer for headings, bullets, checkboxes, bold, inline code, links, and uploaded images.
- 2026-05-19T11:14:45-0700 [CODE] Made ticket description textareas taller in create/edit flows and hid the backlog table while the new-ticket form is open.
- 2026-05-19T11:16:51-0700 [CODE] Corrected title sizing request: removed heavier styling from the new-ticket title input and widened the backlog title column to 610px within a 1120px fixed-layout table.
- 2026-05-19T11:18:46-0700 [CODE] Added clipboard image paste support for ticket descriptions: create/edit textareas detect pasted image files, upload through `/api/uploads`, and insert returned markdown at the cursor/selection.
- 2026-05-19T11:19:52-0700 [CODE] Hardened ticket creator storage migration: `tickets.creator_id` already existed and new tickets already store `user.id`; `scripts/migrate.mjs` now upgrades older DBs missing `creator_id` and creates `idx_tickets_creator`.
- 2026-05-19T11:24:31-0700 [CODE] Changed ticket modal to read-first flow: opening a ticket shows rendered details, creator, metadata, labels, dependencies, and comments; edit controls appear only after pressing Edit. Non-creator ticket PATCH edits now insert an audit comment naming the editor, timestamp, and changed fields.
- 2026-05-19T11:33:32-0700 [CODE] Added Board card actions: Edit opens `TicketDetail` directly in edit mode, and Assign initially assigned the ticket to the current user via `PATCH assignee_id` with optimistic UI update.
- 2026-05-19T11:35:33-0700 [CODE] Superseded Board self-assign behavior: board cards now show an assignee dropdown with Unassigned plus all users; changing it patches `assignee_id` with optimistic UI update.
- 2026-05-19T11:38:32-0700 [CODE] Kept Board card click as view-mode open behavior and hardened Edit/assignee dropdown event handling so those controls do not bubble and accidentally open the view modal.
- 2026-05-19T11:40:55-0700 [CODE] Superseded Board card-click view behavior because it interfered with drag/drop: card body no longer opens tickets; explicit `View` button opens read mode and the modal still has its internal Edit button.

## [DISCOVERIES]
- 2026-05-19T00:19:44-0700 [TOOL] `date -Is` is unavailable on this BSD/macOS host; used `date +%Y-%m-%dT%H:%M:%S%z` for ISO-like timestamps.
- 2026-05-19T00:39:05-0700 [TOOL] `npm audit --omit=dev` still reports two moderate advisories against `next@15.5.18` metadata even though `npm ls postcss` resolves the installed tree to patched `postcss@8.5.14`; npm's suggested forced fix would downgrade to `next@9.3.3`, so it was not applied.

## [OUTCOMES]
- 2026-05-19T00:39:05-0700 [TOOL] Verification completed: `npm run migrate` passed, `npm run build` passed on Next 15.5.18, `docker compose config` passed, dev server started at `http://localhost:3000`, and local API smoke tests passed for login/session, sprint creation/activation, and ticket creation/listing.
- 2026-05-19T10:56:25-0700 [TOOL] Verification completed for team role management: `npm run build` passed and included the new `/api/users/[id]` route.
- 2026-05-19T10:57:48-0700 [TOOL] SQLite verification after reset: only `admin|admin` remains in `users`; sessions/tickets/sprints/labels/comments/dependency tables all count 0.
- 2026-05-19T10:58:53-0700 [TOOL] Verification completed for team user deletion: `npm run build` passed.
- 2026-05-19T11:03:45-0700 [TOOL] Verification completed for auth redirect and image uploads: `npm run build` passed and source scan shows only login/logout use raw `fetch`; protected client calls use `apiFetch`.
- 2026-05-19T11:06:36-0700 [TOOL] Verification completed for sprint date presets: `npm run build` passed.
- 2026-05-19T11:13:30-0700 [TOOL] Verification completed for backlog title sizing and markdown description preview: `npm run build` passed.
- 2026-05-19T11:14:45-0700 [TOOL] Verification completed for taller descriptions and focused new-ticket form: `npm run build` passed.
- 2026-05-19T11:16:51-0700 [TOOL] Verification completed for corrected title width: `npm run build` passed.
- 2026-05-19T11:18:46-0700 [TOOL] Verification completed for clipboard image paste support: `npm run build` passed.
- 2026-05-19T11:19:52-0700 [TOOL] Verification completed for ticket creator DB support: `npm run migrate` passed, `npm run build` passed, and SQLite schema shows `tickets.creator_id` plus `idx_tickets_creator`.
- 2026-05-19T11:24:31-0700 [TOOL] Verification completed for read-first ticket modal and non-creator audit comments: `npm run migrate` passed and `npm run build` passed.
- 2026-05-19T11:33:32-0700 [TOOL] Verification completed for Board edit/self-assign buttons: `npm run build` passed.
- 2026-05-19T11:35:33-0700 [TOOL] Verification completed for Board assignee dropdown: `npm run build` passed.
- 2026-05-19T11:38:32-0700 [TOOL] Verification completed for Board view-click event handling: `npm run build` passed.
- 2026-05-19T11:40:55-0700 [TOOL] Verification completed for Board explicit View button: `npm run build` passed.
