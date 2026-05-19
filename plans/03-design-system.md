# Phase 3: Design System (CSS)

## Goal

Create `src/app/globals.css` with all styles for the entire application. This is the **only CSS file** in the project. Every component references classes from this file.

The design is **early-2000s utilitarian**: system fonts, flat colors, sharp edges, dense layouts, no animations.

---

## Complete `src/app/globals.css`

Replace the default Next.js `globals.css` with this. The file is organized into sections. Each section has a comment header.

```css
/* =============================================================================
   RESET
   ============================================================================= */

*, *::before, *::after {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

/* =============================================================================
   VARIABLES
   ============================================================================= */

:root {
  --bg: #ffffff;
  --bg-alt: #f5f5f5;
  --bg-hover: #ebebeb;
  --border: #cccccc;
  --text: #1a1a1a;
  --text-muted: #666666;
  --link: #0066cc;
  --link-hover: #004499;
  --danger: #cc0000;
  --success: #008800;
  --warning: #cc6600;
  --selected: #e8e8e8;
  --focus: #0066cc;

  --font: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
  --font-mono: "SFMono-Regular", Consolas, "Liberation Mono", Menlo, Courier, monospace;
  --font-size: 13px;
  --font-size-sm: 12px;
  --font-size-lg: 14px;
  --font-size-xl: 16px;
  --font-size-h1: 18px;

  --space-xs: 2px;
  --space-sm: 4px;
  --space-md: 8px;
  --space-lg: 12px;
  --space-xl: 16px;
  --space-2xl: 24px;

  --navbar-height: 36px;
}

/* =============================================================================
   BASE
   ============================================================================= */

html, body {
  font-family: var(--font);
  font-size: var(--font-size);
  color: var(--text);
  background: var(--bg);
  line-height: 1.4;
  -webkit-font-smoothing: antialiased;
}

a {
  color: var(--link);
  text-decoration: none;
}

a:hover {
  color: var(--link-hover);
  text-decoration: underline;
}

h1 { font-size: var(--font-size-h1); font-weight: 600; }
h2 { font-size: var(--font-size-xl); font-weight: 600; }
h3 { font-size: var(--font-size-lg); font-weight: 600; }

code, pre {
  font-family: var(--font-mono);
  font-size: var(--font-size-sm);
}

/* =============================================================================
   FORMS
   ============================================================================= */

input[type="text"],
input[type="password"],
input[type="date"],
input[type="search"],
input[type="number"],
textarea,
select {
  font-family: var(--font);
  font-size: var(--font-size);
  color: var(--text);
  background: var(--bg);
  border: 1px solid var(--border);
  padding: var(--space-sm) var(--space-md);
  width: 100%;
  outline: none;
  border-radius: 0;
  -webkit-appearance: none;
}

input:focus,
textarea:focus,
select:focus {
  border-color: var(--focus);
}

textarea {
  resize: vertical;
  min-height: 80px;
  font-family: var(--font-mono);
  line-height: 1.5;
}

label {
  display: block;
  font-size: var(--font-size-sm);
  font-weight: 600;
  color: var(--text-muted);
  margin-bottom: var(--space-xs);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.form-group {
  margin-bottom: var(--space-lg);
}

.form-error {
  color: var(--danger);
  font-size: var(--font-size-sm);
  margin-bottom: var(--space-md);
  padding: var(--space-sm) var(--space-md);
  border: 1px solid var(--danger);
  background: #fff0f0;
}

.form-row {
  display: flex;
  gap: var(--space-md);
}

.form-row .form-group {
  flex: 1;
}

/* =============================================================================
   BUTTONS
   ============================================================================= */

.btn {
  font-family: var(--font);
  font-size: var(--font-size);
  font-weight: 600;
  padding: var(--space-sm) var(--space-lg);
  border: 1px solid var(--border);
  background: var(--bg);
  color: var(--text);
  cursor: pointer;
  border-radius: 0;
  display: inline-flex;
  align-items: center;
  gap: var(--space-sm);
  white-space: nowrap;
}

.btn:hover {
  background: var(--bg-alt);
}

.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-primary {
  background: var(--text);
  color: var(--bg);
  border-color: var(--text);
}

.btn-primary:hover {
  background: #333333;
}

.btn-danger {
  color: var(--danger);
  border-color: var(--danger);
}

.btn-danger:hover {
  background: #fff0f0;
}

.btn-sm {
  font-size: var(--font-size-sm);
  padding: var(--space-xs) var(--space-md);
}

/* =============================================================================
   NAVBAR
   ============================================================================= */

.navbar {
  display: flex;
  align-items: center;
  height: var(--navbar-height);
  border-bottom: 1px solid var(--border);
  padding: 0 var(--space-xl);
  background: var(--bg);
  gap: 0;
}

.navbar-brand {
  font-weight: 700;
  font-size: var(--font-size-lg);
  color: var(--text);
  text-decoration: none;
  margin-right: var(--space-2xl);
  text-transform: lowercase;
}

.navbar-brand:hover {
  color: var(--text);
  text-decoration: none;
}

.navbar-links {
  display: flex;
  gap: 0;
  list-style: none;
  height: 100%;
}

.navbar-links a {
  display: flex;
  align-items: center;
  height: 100%;
  padding: 0 var(--space-lg);
  color: var(--text-muted);
  text-decoration: none;
  font-size: var(--font-size-sm);
  font-weight: 500;
  border-bottom: 2px solid transparent;
}

.navbar-links a:hover {
  color: var(--text);
  text-decoration: none;
  background: var(--bg-alt);
}

.navbar-links a.active {
  color: var(--text);
  border-bottom-color: var(--text);
}

.navbar-right {
  margin-left: auto;
  display: flex;
  align-items: center;
  gap: var(--space-md);
  font-size: var(--font-size-sm);
  color: var(--text-muted);
}

.navbar-user {
  font-weight: 600;
  color: var(--text);
}

/* =============================================================================
   LOGIN PAGE
   ============================================================================= */

.login-container {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
}

.login-box {
  width: 280px;
}

.login-box h1 {
  font-size: var(--font-size-xl);
  margin-bottom: var(--space-xl);
  text-transform: lowercase;
}

.login-box .btn {
  width: 100%;
  justify-content: center;
}

/* =============================================================================
   PAGE LAYOUT
   ============================================================================= */

.page {
  padding: var(--space-xl);
}

.page-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: var(--space-xl);
}

.page-header h1 {
  font-size: var(--font-size-h1);
}

/* =============================================================================
   BOARD (KANBAN)
   ============================================================================= */

.board {
  display: flex;
  gap: 1px;
  background: var(--border);
  border: 1px solid var(--border);
  height: calc(100vh - var(--navbar-height) - var(--space-xl) * 2 - 30px);
  overflow: hidden;
}

.board-column {
  flex: 1;
  background: var(--bg);
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.board-column-header {
  padding: var(--space-md) var(--space-lg);
  font-size: var(--font-size-sm);
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: var(--text-muted);
  border-bottom: 1px solid var(--border);
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-shrink: 0;
}

.board-column-count {
  font-weight: 400;
  color: var(--text-muted);
}

.board-column-body {
  flex: 1;
  overflow-y: auto;
  padding: var(--space-sm);
}

/* =============================================================================
   TICKET CARD
   ============================================================================= */

.ticket-card {
  border: 1px solid var(--border);
  padding: var(--space-md);
  margin-bottom: var(--space-sm);
  background: var(--bg);
  cursor: pointer;
}

.ticket-card:hover {
  background: var(--bg-alt);
}

.ticket-card-number {
  font-size: var(--font-size-sm);
  color: var(--text-muted);
  font-family: var(--font-mono);
}

.ticket-card-title {
  font-size: var(--font-size);
  font-weight: 500;
  margin-top: var(--space-xs);
  word-wrap: break-word;
}

.ticket-card-meta {
  display: flex;
  align-items: center;
  gap: var(--space-md);
  margin-top: var(--space-md);
  font-size: var(--font-size-sm);
}

.ticket-card-assignee {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  border: 1px solid var(--border);
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  color: var(--text-muted);
}

.ticket-card-blocked {
  font-size: var(--font-size-sm);
  color: var(--danger);
  font-weight: 600;
}

/* =============================================================================
   PRIORITY BADGES
   ============================================================================= */

.priority {
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  padding: 0 var(--space-sm);
  border: 1px solid;
}

.priority-low { color: var(--text-muted); border-color: var(--text-muted); }
.priority-medium { color: var(--warning); border-color: var(--warning); }
.priority-high { color: #cc4400; border-color: #cc4400; }
.priority-urgent { color: var(--danger); border-color: var(--danger); background: #fff0f0; }

/* =============================================================================
   LABELS
   ============================================================================= */

.label {
  display: inline-block;
  font-size: 10px;
  font-weight: 600;
  padding: 0 var(--space-sm);
  color: #ffffff;
  white-space: nowrap;
}

.label-list {
  display: flex;
  flex-wrap: wrap;
  gap: 2px;
}

/* =============================================================================
   TICKET DETAIL (MODAL)
   ============================================================================= */

.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.3);
  display: flex;
  align-items: flex-start;
  justify-content: center;
  padding-top: 60px;
  z-index: 100;
}

.modal {
  background: var(--bg);
  border: 1px solid var(--border);
  width: 700px;
  max-height: calc(100vh - 120px);
  overflow-y: auto;
}

.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-lg) var(--space-xl);
  border-bottom: 1px solid var(--border);
}

.modal-header h2 {
  font-size: var(--font-size-lg);
}

.modal-body {
  padding: var(--space-xl);
}

.modal-close {
  background: none;
  border: none;
  font-size: var(--font-size-xl);
  cursor: pointer;
  color: var(--text-muted);
  padding: var(--space-sm);
}

.modal-close:hover {
  color: var(--text);
}

.detail-grid {
  display: grid;
  grid-template-columns: 1fr 200px;
  gap: var(--space-xl);
}

.detail-main {
  min-width: 0;
}

.detail-sidebar {
  border-left: 1px solid var(--border);
  padding-left: var(--space-xl);
}

.detail-field {
  margin-bottom: var(--space-xl);
}

.detail-field-label {
  font-size: var(--font-size-sm);
  font-weight: 600;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-bottom: var(--space-sm);
}

/* =============================================================================
   COMMENTS
   ============================================================================= */

.comment {
  border-top: 1px solid var(--border);
  padding-top: var(--space-lg);
  margin-top: var(--space-lg);
}

.comment-header {
  display: flex;
  align-items: center;
  gap: var(--space-md);
  margin-bottom: var(--space-sm);
}

.comment-author {
  font-weight: 600;
  font-size: var(--font-size-sm);
}

.comment-date {
  font-size: var(--font-size-sm);
  color: var(--text-muted);
}

.comment-body {
  font-size: var(--font-size);
  line-height: 1.5;
  white-space: pre-wrap;
}

.comment-form {
  margin-top: var(--space-xl);
  border-top: 1px solid var(--border);
  padding-top: var(--space-lg);
}

.comment-form textarea {
  margin-bottom: var(--space-md);
}

/* =============================================================================
   TABLES (BACKLOG, SPRINT LIST, TEAM)
   ============================================================================= */

.table-container {
  border: 1px solid var(--border);
  overflow-x: auto;
}

table {
  width: 100%;
  border-collapse: collapse;
  font-size: var(--font-size);
}

th {
  text-align: left;
  font-size: var(--font-size-sm);
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: var(--text-muted);
  padding: var(--space-md) var(--space-lg);
  border-bottom: 1px solid var(--border);
  background: var(--bg-alt);
  white-space: nowrap;
}

td {
  padding: var(--space-md) var(--space-lg);
  border-bottom: 1px solid var(--border);
  vertical-align: middle;
}

tr:last-child td {
  border-bottom: none;
}

tr:hover td {
  background: var(--bg-alt);
}

/* =============================================================================
   SPRINT CARD
   ============================================================================= */

.sprint-card {
  border: 1px solid var(--border);
  padding: var(--space-lg);
  margin-bottom: var(--space-md);
}

.sprint-card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: var(--space-md);
}

.sprint-card-name {
  font-weight: 600;
}

.sprint-status {
  font-size: var(--font-size-sm);
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  padding: var(--space-xs) var(--space-md);
  border: 1px solid;
}

.sprint-status-planning { color: var(--text-muted); border-color: var(--text-muted); }
.sprint-status-active { color: var(--success); border-color: var(--success); }
.sprint-status-completed { color: var(--text-muted); border-color: var(--border); background: var(--bg-alt); }

.sprint-dates {
  font-size: var(--font-size-sm);
  color: var(--text-muted);
}

.sprint-progress {
  font-size: var(--font-size-sm);
  color: var(--text-muted);
  margin-top: var(--space-sm);
}

/* =============================================================================
   DEPENDENCY SECTION
   ============================================================================= */

.dep-list {
  list-style: none;
}

.dep-item {
  display: flex;
  align-items: center;
  gap: var(--space-md);
  padding: var(--space-sm) 0;
  font-size: var(--font-size-sm);
  border-bottom: 1px solid var(--border);
}

.dep-item:last-child {
  border-bottom: none;
}

.dep-status-done {
  color: var(--success);
}

.dep-status-pending {
  color: var(--danger);
}

.dep-remove {
  margin-left: auto;
  color: var(--text-muted);
  cursor: pointer;
  background: none;
  border: none;
  font-size: var(--font-size-sm);
}

.dep-remove:hover {
  color: var(--danger);
}

/* =============================================================================
   EMPTY STATES
   ============================================================================= */

.empty {
  text-align: center;
  padding: var(--space-2xl);
  color: var(--text-muted);
  font-size: var(--font-size-sm);
}

/* =============================================================================
   UTILITIES
   ============================================================================= */

.text-muted { color: var(--text-muted); }
.text-danger { color: var(--danger); }
.text-success { color: var(--success); }
.text-sm { font-size: var(--font-size-sm); }
.text-mono { font-family: var(--font-mono); }
.font-bold { font-weight: 600; }
.mt-md { margin-top: var(--space-md); }
.mt-lg { margin-top: var(--space-lg); }
.mt-xl { margin-top: var(--space-xl); }
.mb-md { margin-bottom: var(--space-md); }
.mb-lg { margin-bottom: var(--space-lg); }
.flex { display: flex; }
.flex-between { display: flex; justify-content: space-between; align-items: center; }
.gap-sm { gap: var(--space-sm); }
.gap-md { gap: var(--space-md); }
.hidden { display: none; }

/* =============================================================================
   DRAG AND DROP
   ============================================================================= */

.dragging {
  opacity: 0.5;
  border-style: dashed;
}

.drop-target {
  background: var(--bg-alt);
}
```

## What This Covers

Every component in the application uses classes from this file:

| Component | CSS classes used |
|-----------|-----------------|
| Navbar | `.navbar`, `.navbar-brand`, `.navbar-links`, `.navbar-right`, `.navbar-user` |
| Login | `.login-container`, `.login-box` |
| Board | `.board`, `.board-column`, `.board-column-header`, `.board-column-body` |
| Ticket Card | `.ticket-card`, `.ticket-card-*`, `.priority-*`, `.label`, `.label-list` |
| Ticket Detail | `.modal-overlay`, `.modal`, `.detail-grid`, `.detail-main`, `.detail-sidebar`, `.detail-field` |
| Comments | `.comment`, `.comment-*`, `.comment-form` |
| Tables | `.table-container`, `table`, `th`, `td` |
| Sprints | `.sprint-card`, `.sprint-status-*` |
| Dependencies | `.dep-list`, `.dep-item`, `.dep-status-*` |
| Forms | `.form-group`, `.form-error`, `.form-row`, `input`, `textarea`, `select`, `label` |
| Buttons | `.btn`, `.btn-primary`, `.btn-danger`, `.btn-sm` |
| DnD | `.dragging`, `.drop-target` |

## Verification

After replacing `globals.css`:
1. `npm run dev` → the login page should look utilitarian: centered box, system font, flat input fields, sharp edges
2. Check that there are **no rounded corners, no shadows, no gradients** anywhere

Phase 3 complete. Move to Phase 4.
