# Phase 1: Project Setup

## Goal

Set up the Next.js project, install all dependencies, create the database schema, and build two CLI scripts: one to initialize the database and one to create user accounts.

After this phase, you should be able to:
1. Run `npm run dev` and see the default Next.js page
2. Run `node scripts/migrate.mjs` to create the SQLite database with all tables
3. Run `node scripts/create-user.mjs` to create a user account

---

## Step 1: Initialize Next.js Project

Run from the project root `/Users/gavin/projects/scrum/`:

```bash
npx -y create-next-app@latest ./ --js --no-tailwind --no-eslint --no-turbopack --src-dir --app --no-import-alias
```

This creates a Next.js 15 project with:
- JavaScript (not TypeScript)
- No Tailwind CSS
- No ESLint
- `src/` directory
- App Router
- No import alias

## Step 2: Install Dependencies

```bash
npm install better-sqlite3 bcryptjs uuid
```

| Package | Purpose |
|---------|---------|
| `better-sqlite3` | SQLite database driver. Synchronous API. |
| `bcryptjs` | Pure JS bcrypt implementation for password hashing. No native compilation needed. |
| `uuid` | Generate unique IDs for database records. |

We will install `@dnd-kit/core` and `@dnd-kit/sortable` later in Phase 6 (Board). Don't install them now.

## Step 3: Create .gitignore additions

Append to the existing `.gitignore` file:

```
# Database
data/
```

## Step 4: Create `src/lib/constants.js`

This file contains all application constants. It must be easy to find and edit.

```js
// =============================================================================
// SCRUM PLATFORM CONSTANTS
// =============================================================================
// Edit these values to customize the application behavior.
// =============================================================================

/**
 * Base description template for new tickets.
 * This is pre-filled in the description field when creating a ticket.
 * Edit this to change what every new ticket starts with.
 */
export const TICKET_TEMPLATE = `## Summary
<!-- Brief description of what needs to be done -->

## Acceptance Criteria
- [ ] ...

## Notes
<!-- Any additional context, links, or references -->`;

/**
 * Ticket statuses in display order.
 * The 'value' is stored in the database. The 'label' is shown in the UI.
 */
export const STATUSES = [
  { value: 'backlog', label: 'Backlog' },
  { value: 'todo', label: 'To Do' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'in_review', label: 'In Review' },
  { value: 'done', label: 'Done' },
];

/**
 * Ticket priorities in order from lowest to highest.
 */
export const PRIORITIES = [
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
  { value: 'urgent', label: 'Urgent' },
];

/**
 * Sprint statuses.
 */
export const SPRINT_STATUSES = [
  { value: 'planning', label: 'Planning' },
  { value: 'active', label: 'Active' },
  { value: 'completed', label: 'Completed' },
];

/**
 * Preset colors available when creating a label.
 * Users must pick from this list — no custom colors.
 * Each entry is [hex, human-readable name].
 */
export const LABEL_COLORS = [
  { hex: '#e53e3e', name: 'Red' },
  { hex: '#dd6b20', name: 'Orange' },
  { hex: '#d69e2e', name: 'Yellow' },
  { hex: '#38a169', name: 'Green' },
  { hex: '#319795', name: 'Teal' },
  { hex: '#3182ce', name: 'Blue' },
  { hex: '#5a67d8', name: 'Indigo' },
  { hex: '#805ad5', name: 'Purple' },
  { hex: '#d53f8c', name: 'Pink' },
  { hex: '#718096', name: 'Gray' },
  { hex: '#2d3748', name: 'Dark Gray' },
  { hex: '#e2e8f0', name: 'Light Gray' },
  { hex: '#c05621', name: 'Brown' },
  { hex: '#2b6cb0', name: 'Dark Blue' },
  { hex: '#276749', name: 'Dark Green' },
  { hex: '#9b2c2c', name: 'Dark Red' },
];

/**
 * User roles.
 */
export const ROLES = {
  MEMBER: 'member',
  ADMIN: 'admin',
};

/**
 * Session duration in days. Sessions expire after this many days of inactivity.
 */
export const SESSION_DURATION_DAYS = 7;

/**
 * Maximum username length.
 */
export const MAX_USERNAME_LENGTH = 8;
```

## Step 5: Create `src/lib/db.js`

This file creates a singleton database connection. It is used by all server-side code (API routes, scripts).

```js
import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

const DB_PATH = path.join(process.cwd(), 'data', 'scrum.db');

let db;

export function getDb() {
  if (!db) {
    // Ensure data directory exists
    const dir = path.dirname(DB_PATH);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    db = new Database(DB_PATH);

    // Enable WAL mode for better concurrent read performance
    db.pragma('journal_mode = WAL');

    // Enable foreign keys (off by default in SQLite)
    db.pragma('foreign_keys = ON');
  }
  return db;
}
```

## Step 6: Create `scripts/migrate.mjs`

This script creates all database tables. It is safe to run multiple times — it uses `CREATE TABLE IF NOT EXISTS`.

Run with: `node scripts/migrate.mjs`

```js
import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = path.join(__dirname, '..', 'data', 'scrum.db');

// Ensure data directory exists
const dir = path.dirname(DB_PATH);
if (!fs.existsSync(dir)) {
  fs.mkdirSync(dir, { recursive: true });
}

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

console.log('Running migrations...');

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id         TEXT PRIMARY KEY,
    username   TEXT UNIQUE NOT NULL,
    password   TEXT NOT NULL,
    role       TEXT NOT NULL DEFAULT 'member',
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS sessions (
    id         TEXT PRIMARY KEY,
    user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expires_at TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS sprints (
    id         TEXT PRIMARY KEY,
    name       TEXT NOT NULL,
    status     TEXT NOT NULL DEFAULT 'planning',
    start_date TEXT NOT NULL,
    end_date   TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS labels (
    id    TEXT PRIMARY KEY,
    name  TEXT UNIQUE NOT NULL,
    color TEXT NOT NULL DEFAULT '#718096'
  );

  CREATE TABLE IF NOT EXISTS tickets (
    id          TEXT PRIMARY KEY,
    number      INTEGER UNIQUE,
    title       TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    status      TEXT NOT NULL DEFAULT 'backlog',
    priority    TEXT NOT NULL DEFAULT 'medium',
    sort_order  INTEGER NOT NULL DEFAULT 0,
    sprint_id   TEXT REFERENCES sprints(id) ON DELETE SET NULL,
    assignee_id TEXT REFERENCES users(id) ON DELETE SET NULL,
    creator_id  TEXT NOT NULL REFERENCES users(id),
    created_at  TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS ticket_labels (
    ticket_id TEXT NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
    label_id  TEXT NOT NULL REFERENCES labels(id) ON DELETE CASCADE,
    PRIMARY KEY (ticket_id, label_id)
  );

  CREATE TABLE IF NOT EXISTS ticket_dependencies (
    ticket_id     TEXT NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
    depends_on_id TEXT NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
    PRIMARY KEY (ticket_id, depends_on_id),
    CHECK (ticket_id != depends_on_id)
  );

  CREATE TABLE IF NOT EXISTS comments (
    id         TEXT PRIMARY KEY,
    content    TEXT NOT NULL,
    ticket_id  TEXT NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
    author_id  TEXT NOT NULL REFERENCES users(id),
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  -- Indexes for common queries
  CREATE INDEX IF NOT EXISTS idx_tickets_sprint    ON tickets(sprint_id);
  CREATE INDEX IF NOT EXISTS idx_tickets_assignee  ON tickets(assignee_id);
  CREATE INDEX IF NOT EXISTS idx_tickets_status    ON tickets(status);
  CREATE INDEX IF NOT EXISTS idx_comments_ticket   ON comments(ticket_id);
  CREATE INDEX IF NOT EXISTS idx_sessions_user     ON sessions(user_id);
  CREATE INDEX IF NOT EXISTS idx_ticket_deps_dep   ON ticket_dependencies(depends_on_id);
`);

// Create a trigger to auto-increment ticket numbers.
// This gives us human-readable ticket numbers (SCRUM-1, SCRUM-2, etc.)
// We use a trigger instead of AUTOINCREMENT because the 'number' field
// is separate from the 'id' field (which is a UUID).
db.exec(`
  CREATE TRIGGER IF NOT EXISTS set_ticket_number
  AFTER INSERT ON tickets
  WHEN NEW.number IS NULL
  BEGIN
    UPDATE tickets
    SET number = COALESCE((SELECT MAX(number) FROM tickets), 0) + 1
    WHERE id = NEW.id;
  END;
`);

console.log('Migrations complete. Database at:', DB_PATH);
db.close();
```

## Step 7: Create `scripts/create-user.mjs`

This script creates a user account from the command line. It hides password input.

Run with: `node scripts/create-user.mjs` or `node scripts/create-user.mjs --admin`

```js
import Database from 'better-sqlite3';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import readline from 'readline';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = path.join(__dirname, '..', 'data', 'scrum.db');
const MAX_USERNAME_LENGTH = 8;
const isAdmin = process.argv.includes('--admin');

function ask(question) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer);
    });
  });
}

function askPassword(question) {
  return new Promise((resolve) => {
    process.stdout.write(question);
    const stdin = process.stdin;
    stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding('utf8');
    let password = '';
    const onData = (ch) => {
      // Ctrl+C
      if (ch === '\u0003') {
        console.log('\nAborted.');
        process.exit(1);
      }
      // Enter
      if (ch === '\r' || ch === '\n') {
        stdin.setRawMode(false);
        stdin.pause();
        stdin.removeListener('data', onData);
        console.log('');
        resolve(password);
        return;
      }
      // Backspace
      if (ch === '\u007F' || ch === '\b') {
        if (password.length > 0) {
          password = password.slice(0, -1);
          process.stdout.write('\b \b');
        }
        return;
      }
      password += ch;
      process.stdout.write('*');
    };
    stdin.on('data', onData);
  });
}

async function main() {
  // Check database exists
  const db = new Database(DB_PATH);
  db.pragma('foreign_keys = ON');

  // Get username
  const username = await ask('Username (lowercase, max 8 chars): ');

  // Validate username
  if (!username) {
    console.error('Error: Username is required.');
    process.exit(1);
  }
  if (username !== username.toLowerCase()) {
    console.error('Error: Username must be lowercase only.');
    process.exit(1);
  }
  if (username.length > MAX_USERNAME_LENGTH) {
    console.error(`Error: Username must be ${MAX_USERNAME_LENGTH} characters or fewer.`);
    process.exit(1);
  }
  if (!/^[a-z][a-z0-9]*$/.test(username)) {
    console.error('Error: Username must start with a letter and contain only lowercase letters and numbers.');
    process.exit(1);
  }

  // Check if username already exists
  const existing = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
  if (existing) {
    console.error(`Error: Username "${username}" already exists.`);
    process.exit(1);
  }

  // Get password
  const password = await askPassword('Password: ');
  if (!password || password.length < 4) {
    console.error('Error: Password must be at least 4 characters.');
    process.exit(1);
  }

  const confirmPassword = await askPassword('Confirm password: ');
  if (password !== confirmPassword) {
    console.error('Error: Passwords do not match.');
    process.exit(1);
  }

  // Hash password and insert
  const hash = bcrypt.hashSync(password, 10);
  const id = uuidv4();
  const role = isAdmin ? 'admin' : 'member';

  db.prepare(
    'INSERT INTO users (id, username, password, role) VALUES (?, ?, ?, ?)'
  ).run(id, username, hash, role);

  console.log(`\nUser created successfully.`);
  console.log(`  Username: ${username}`);
  console.log(`  Role:     ${role}`);
  console.log(`  ID:       ${id}`);

  db.close();
}

main().catch((err) => {
  console.error('Error:', err.message);
  process.exit(1);
});
```

## Step 8: Create the `data/` directory

Create an empty `data/.gitkeep` file so the directory exists in git but the database file is ignored:

```bash
mkdir -p data
touch data/.gitkeep
```

## Verification

After completing all steps:

1. **Run the dev server**: `npm run dev` → should show default Next.js page at `http://localhost:3000`
2. **Run migrations**: `node scripts/migrate.mjs` → should print "Migrations complete" and create `data/scrum.db`
3. **Create a test user**: `node scripts/create-user.mjs --admin` → enter username `admin` and a password → should confirm creation
4. **Verify the database**: `node -e "const Database = require('better-sqlite3'); const db = new Database('data/scrum.db'); console.log(db.prepare('SELECT * FROM users').all());"` → should show the admin user (with hashed password)

If all 4 checks pass, Phase 1 is complete. Move to Phase 2.
