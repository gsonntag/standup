import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = path.join(__dirname, '..', 'data', 'scrum.db');
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
    total_points     INTEGER,
    points_remaining INTEGER,
    created_at       TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at       TEXT NOT NULL DEFAULT (datetime('now'))
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

  CREATE INDEX IF NOT EXISTS idx_tickets_sprint ON tickets(sprint_id);
  CREATE INDEX IF NOT EXISTS idx_tickets_assignee ON tickets(assignee_id);
  CREATE INDEX IF NOT EXISTS idx_tickets_creator ON tickets(creator_id);
  CREATE INDEX IF NOT EXISTS idx_tickets_status ON tickets(status);
  CREATE INDEX IF NOT EXISTS idx_comments_ticket ON comments(ticket_id);
  CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
  CREATE INDEX IF NOT EXISTS idx_ticket_deps_dep ON ticket_dependencies(depends_on_id);
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS ticket_events (
    id         TEXT PRIMARY KEY,
    ticket_id  TEXT NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
    actor_id   TEXT NOT NULL REFERENCES users(id),
    kind       TEXT NOT NULL,
    field      TEXT,
    old_value  TEXT,
    new_value  TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS idx_events_ticket ON ticket_events(ticket_id, created_at);
`);

const commentColumns = db.prepare('PRAGMA table_info(comments)').all().map(c => c.name);
if (!commentColumns.includes('kind')) {
  db.exec("ALTER TABLE comments ADD COLUMN kind TEXT NOT NULL DEFAULT 'user'");
  db.prepare("UPDATE comments SET kind = 'system' WHERE content LIKE '% edited this ticket at %' AND content LIKE '%Changed:%'").run();
}
if (!commentColumns.includes('deleted_at')) {
  db.exec('ALTER TABLE comments ADD COLUMN deleted_at TEXT');
}
if (!commentColumns.includes('deleted_by')) {
  db.exec('ALTER TABLE comments ADD COLUMN deleted_by TEXT REFERENCES users(id)');
}

const ticketColumns = db.prepare('PRAGMA table_info(tickets)').all().map((column) => column.name);
if (!ticketColumns.includes('creator_id')) {
  const fallbackUser = db.prepare(`
    SELECT id FROM users
    ORDER BY CASE role WHEN 'admin' THEN 0 ELSE 1 END, created_at ASC
    LIMIT 1
  `).get();
  if (!fallbackUser) {
    throw new Error('Cannot migrate tickets.creator_id without at least one user.');
  }

  db.exec('ALTER TABLE tickets ADD COLUMN creator_id TEXT REFERENCES users(id)');
  db.prepare('UPDATE tickets SET creator_id = ? WHERE creator_id IS NULL').run(fallbackUser.id);
}

db.exec('CREATE INDEX IF NOT EXISTS idx_tickets_creator ON tickets(creator_id);');

db.exec(`
  CREATE TRIGGER IF NOT EXISTS set_ticket_number
  AFTER INSERT ON tickets
  WHEN NEW.number IS NULL
  BEGIN
    UPDATE tickets
    SET number = COALESCE((SELECT MAX(number) FROM tickets WHERE id != NEW.id), 0) + 1
    WHERE id = NEW.id;
  END;
`);

// Due date and points columns
const ticketCols = db.prepare('PRAGMA table_info(tickets)').all().map(c => c.name);
if (!ticketCols.includes('due_date')) {
  db.exec('ALTER TABLE tickets ADD COLUMN due_date TEXT');
}
if (!ticketCols.includes('story_points')) {
  db.exec('ALTER TABLE tickets ADD COLUMN story_points INTEGER');
}
if (!ticketCols.includes('total_points')) {
  db.exec('ALTER TABLE tickets ADD COLUMN total_points INTEGER');
  db.prepare('UPDATE tickets SET total_points = story_points WHERE story_points IS NOT NULL AND total_points IS NULL').run();
}
if (!ticketCols.includes('points_remaining')) {
  db.exec('ALTER TABLE tickets ADD COLUMN points_remaining INTEGER');
  db.prepare(`
    UPDATE tickets
    SET points_remaining = CASE WHEN status = 'done' THEN 0 ELSE story_points END
    WHERE story_points IS NOT NULL AND points_remaining IS NULL
  `).run();
}

// Attachments and watchers tables
db.exec(`
  CREATE TABLE IF NOT EXISTS ticket_attachments (
    id          TEXT PRIMARY KEY,
    ticket_id   TEXT NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
    url         TEXT NOT NULL,
    filename    TEXT NOT NULL,
    mime_type   TEXT NOT NULL,
    size_bytes  INTEGER NOT NULL,
    uploader_id TEXT NOT NULL REFERENCES users(id),
    created_at  TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS idx_attachments_ticket ON ticket_attachments(ticket_id);

  CREATE TABLE IF NOT EXISTS ticket_watchers (
    ticket_id TEXT NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
    user_id   TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    PRIMARY KEY (ticket_id, user_id)
  );
`);

// retro_notes table
db.exec(`
  CREATE TABLE IF NOT EXISTS retro_notes (
    id         TEXT PRIMARY KEY,
    sprint_id  TEXT NOT NULL REFERENCES sprints(id) ON DELETE CASCADE,
    category   TEXT NOT NULL CHECK (category IN ('went_well', 'improve')),
    content    TEXT NOT NULL,
    author_id  TEXT NOT NULL REFERENCES users(id),
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS idx_retro_notes_sprint ON retro_notes(sprint_id);
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS sprint_wip_limits (
    sprint_id TEXT NOT NULL REFERENCES sprints(id) ON DELETE CASCADE,
    status    TEXT NOT NULL,
    max_count INTEGER NOT NULL,
    PRIMARY KEY (sprint_id, status)
  );
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS mentions (
    id           TEXT PRIMARY KEY,
    comment_id   TEXT NOT NULL REFERENCES comments(id) ON DELETE CASCADE,
    ticket_id    TEXT NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
    user_id      TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    acknowledged INTEGER NOT NULL DEFAULT 0,
    created_at   TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS idx_mentions_user ON mentions(user_id, acknowledged);
`);

const userColumns = db.prepare('PRAGMA table_info(users)').all().map(c => c.name);
if (!userColumns.includes('discord_id')) {
  db.exec('ALTER TABLE users ADD COLUMN discord_id TEXT');
}

console.log('Migrations complete. Database at:', DB_PATH);
db.close();
