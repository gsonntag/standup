# Scrum Platform — Overview & Architecture

## What We're Building

A lightweight sprint planning tool for a 6-person engineering team. It tracks tickets through a sprint cycle, lets users assign work, comment on tickets, and manage dependencies. There is no self-registration — user accounts are created by admins only.

## Core Concepts

| Concept | Description |
|---------|-------------|
| **Ticket** | A unit of work (bug, feature, task). Has a title, description, status, priority, assignee, labels, and dependencies. |
| **Sprint** | A time-boxed period of work. Has a name, start/end dates, and a status (planning/active/completed). Only one sprint can be active at a time. |
| **Backlog** | Tickets not assigned to any sprint. The default home for new tickets. |
| **Label** | A colored tag applied to tickets for categorization (e.g., `bug`, `frontend`). User-creatable. |
| **Dependency** | A ticket can be "blocked by" other tickets. When a blocker is marked Done, the dependent ticket becomes unblocked. |

## Tech Stack

| Layer | Technology | Why |
|-------|-----------|-----|
| Framework | **Next.js 15** (App Router) | Fullstack React framework. Server components, API routes, file-based routing. |
| Database | **SQLite** via **better-sqlite3** | Zero config, single file, synchronous API. Perfect for small team. |
| Auth | **bcrypt** + cookie sessions | Simple, secure. No JWT complexity. |
| Styling | **Vanilla CSS** | No build step, no framework. System fonts, flat colors. |
| Drag & Drop | **@dnd-kit/core** + **@dnd-kit/sortable** | Lightweight, accessible drag-and-drop for the Kanban board. |

## Design Philosophy

This is an **early-2000s utilitarian web app**. It should feel fast, dense, and handmade.

- **System fonts only** — `font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif`
- **No rounded corners** — `border-radius: 0` everywhere
- **No shadows** — `box-shadow: none` everywhere
- **No gradients** — solid flat colors only
- **No animations** — instant state changes, no transitions
- **Dense layouts** — small padding, small margins, lots of information visible
- **Sharp borders** — 1px solid borders for separation
- **Small font sizes** — 13px base, 12px for secondary text

## Color Palette

```
--bg:          #ffffff     White background
--bg-alt:      #f5f5f5     Alternate row / subtle bg
--border:      #cccccc     All borders
--text:        #1a1a1a     Primary text
--text-muted:  #666666     Secondary text
--link:        #0066cc     Links and interactive elements
--link-hover:  #004499     Link hover state
--danger:      #cc0000     Delete actions, errors
--success:     #008800     Success states
--warning:     #cc6600     Warning states
--selected:    #e8e8e8     Selected/active items
```

## User Roles

| Role | Can do |
|------|--------|
| **member** | Create/edit tickets, comment, create labels, assign tickets |
| **admin** | Everything above + create/manage sprints, create users from web UI |

Admin role is assigned **only by directly editing the database**. The CLI `create-user` script has an `--admin` flag. There is no UI to change roles.

## Project Structure

```
/Users/gavin/projects/scrum/
├── plans/                     # These documents
├── scripts/
│   ├── create-user.mjs        # CLI: create a user account
│   └── migrate.mjs            # CLI: create/reset database tables
├── data/
│   └── scrum.db               # SQLite database file (gitignored)
├── src/
│   ├── app/
│   │   ├── globals.css        # All CSS
│   │   ├── layout.js          # Root layout with top navbar
│   │   ├── page.js            # Board view (default / home)
│   │   ├── login/
│   │   │   └── page.js        # Login page
│   │   ├── backlog/
│   │   │   └── page.js        # Backlog list page
│   │   ├── sprints/
│   │   │   └── page.js        # Sprint management page
│   │   ├── team/
│   │   │   └── page.js        # Team members page
│   │   └── api/
│   │       ├── auth/
│   │       │   ├── login/route.js
│   │       │   ├── logout/route.js
│   │       │   └── me/route.js
│   │       ├── tickets/
│   │       │   ├── route.js               # GET list, POST create
│   │       │   └── [id]/
│   │       │       ├── route.js           # GET one, PATCH update, DELETE
│   │       │       ├── dependencies/route.js  # GET, POST, DELETE
│   │       │       └── comments/route.js  # GET, POST
│   │       ├── sprints/
│   │       │   ├── route.js               # GET list, POST create
│   │       │   └── [id]/route.js          # PATCH update, DELETE
│   │       ├── labels/
│   │       │   ├── route.js               # GET list, POST create
│   │       │   └── [id]/route.js          # DELETE
│   │       └── users/
│   │           └── route.js               # GET list, POST create (admin)
│   ├── components/
│   │   ├── Navbar.js
│   │   ├── Board.js
│   │   ├── BoardColumn.js
│   │   ├── TicketCard.js
│   │   ├── TicketDetail.js
│   │   ├── BacklogTable.js
│   │   ├── SprintList.js
│   │   ├── CreateTicketForm.js
│   │   ├── CommentThread.js
│   │   ├── LabelPicker.js
│   │   ├── DependencyPicker.js
│   │   └── UserForm.js
│   └── lib/
│       ├── db.js              # better-sqlite3 singleton
│       ├── auth.js            # Session helpers (create, validate, destroy)
│       └── constants.js       # Template, label colors, statuses
├── .gitignore
├── package.json
├── jsconfig.json
├── next.config.mjs
└── README.md
```

## Database File

The SQLite database lives at `data/scrum.db`. This path is relative to the project root. The `data/` directory should be gitignored. The `migrate.mjs` script creates this file and all tables.

## Session Flow

1. User visits any page → server checks for `session` cookie
2. If no cookie or expired session → redirect to `/login`
3. User submits login form → POST `/api/auth/login` → server validates credentials, creates session row, sets httpOnly cookie
4. Subsequent requests include cookie → server looks up session → attaches user to request context
5. Logout → POST `/api/auth/logout` → server deletes session row, clears cookie

## Build Order

Each subsequent document covers one phase. Implement them in order — each phase depends on the previous ones.

| Doc | Phase | Depends On |
|-----|-------|-----------|
| `01-project-setup.md` | Next.js init, dependencies, DB, scripts | Nothing |
| `02-auth.md` | Login, sessions, middleware | 01 |
| `03-design-system.md` | globals.css | 01 |
| `04-api-routes.md` | All API endpoints | 01, 02 |
| `05-layout-navbar.md` | Root layout, Navbar component | 02, 03 |
| `06-board.md` | Kanban board page | 04, 05 |
| `07-backlog.md` | Backlog page | 04, 05 |
| `08-ticket-detail.md` | Ticket detail modal | 04, 05 |
| `09-sprints.md` | Sprint management page | 04, 05 |
| `10-team.md` | Team page + admin user creation | 04, 05 |
| `11-labels.md` | Label creation + assignment | 04, 05, 08 |
