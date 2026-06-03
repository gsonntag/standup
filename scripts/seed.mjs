import bcrypt from 'bcryptjs';
import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';
import { v4 as uuidv4 } from 'uuid';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const db = new Database(path.join(__dirname, '..', 'data', 'scrum.db'));
db.pragma('foreign_keys = ON');

// ── helpers ──────────────────────────────────────────────────────────────────
const run = (sql, ...args) => db.prepare(sql).run(...args);
const get = (sql, ...args) => db.prepare(sql).get(...args);

// ── users ────────────────────────────────────────────────────────────────────
const pw = bcrypt.hashSync('preview', 10);
const users = [
  { id: uuidv4(), username: 'alice',   role: 'admin'  },
  { id: uuidv4(), username: 'bob',     role: 'member' },
  { id: uuidv4(), username: 'carol',   role: 'member' },
  { id: uuidv4(), username: 'dave',    role: 'member' },
  { id: uuidv4(), username: 'eve',     role: 'member' },
];
for (const u of users) {
  if (!get('SELECT id FROM users WHERE username = ?', u.username)) {
    run('INSERT INTO users (id, username, password, role) VALUES (?, ?, ?, ?)', u.id, u.username, pw, u.role);
    console.log('created user', u.username);
  } else {
    u.id = get('SELECT id FROM users WHERE username = ?', u.username).id;
    console.log('existing user', u.username, u.id);
  }
}

// get preview user id
const previewId = get('SELECT id FROM users WHERE username = ?', 'preview').id;
const allUserIds = [previewId, ...users.map(u => u.id)];

// ── labels ───────────────────────────────────────────────────────────────────
const labelDefs = [
  { name: 'frontend',  color: '#3b82f6' },
  { name: 'backend',   color: '#10b981' },
  { name: 'bug',       color: '#ef4444' },
  { name: 'feature',   color: '#8b5cf6' },
  { name: 'infra',     color: '#f59e0b' },
  { name: 'design',    color: '#ec4899' },
  { name: 'urgent',    color: '#dc2626' },
  { name: 'docs',      color: '#6b7280' },
];
const labelIds = {};
for (const l of labelDefs) {
  let row = get('SELECT id FROM labels WHERE name = ?', l.name);
  if (!row) {
    const id = uuidv4();
    run('INSERT INTO labels (id, name, color) VALUES (?, ?, ?)', id, l.name, l.color);
    labelIds[l.name] = id;
  } else {
    labelIds[l.name] = row.id;
  }
}

// ── sprints ──────────────────────────────────────────────────────────────────
const sprint1Id = get("SELECT id FROM sprints WHERE name = 'i love sprints'").id;
const sprint2Id = get("SELECT id FROM sprints WHERE name = 'sptin 2'").id;

// Add a future sprint
let sprint3Id;
const s3 = get("SELECT id FROM sprints WHERE name = 'Sprint 3 – Hardening'");
if (!s3) {
  sprint3Id = uuidv4();
  run("INSERT INTO sprints (id, name, status, start_date, end_date) VALUES (?, ?, 'planned', '2026-06-30', '2026-07-13')",
    sprint3Id, 'Sprint 3 – Hardening');
} else {
  sprint3Id = s3.id;
}

// ── tickets ──────────────────────────────────────────────────────────────────
const statuses = ['todo', 'in_progress', 'pr', 'done'];
const priorities = ['low', 'medium', 'high', 'critical'];

const ticketData = [
  // Sprint 1 (completed) – mix of done + leftover
  { title: 'Set up CI/CD pipeline', status: 'done',        priority: 'high',     sprint: sprint1Id, pts: 5,  rem: 0,  labels: ['infra'],              due: '2026-06-10' },
  { title: 'Design system tokens',  status: 'done',        priority: 'medium',   sprint: sprint1Id, pts: 3,  rem: 0,  labels: ['design','frontend'],  due: '2026-06-08' },
  { title: 'Auth middleware',        status: 'done',        priority: 'high',     sprint: sprint1Id, pts: 8,  rem: 0,  labels: ['backend'],            due: '2026-06-12' },
  { title: 'Fix login redirect bug', status: 'done',        priority: 'critical', sprint: sprint1Id, pts: 2,  rem: 0,  labels: ['bug','frontend'],     due: '2026-06-05' },
  { title: 'Sprint retrospective page', status: 'done',    priority: 'low',      sprint: sprint1Id, pts: 3,  rem: 0,  labels: ['frontend'],           due: '2026-06-14' },
  // Sprint 2 (active) – spread across columns
  { title: 'Dashboard overview stats',   status: 'done',        priority: 'high',   sprint: sprint2Id, pts: 5,  rem: 0,  labels: ['frontend'],          due: '2026-06-25' },
  { title: 'Kanban drag-and-drop',       status: 'pr',          priority: 'high',   sprint: sprint2Id, pts: 8,  rem: 1,  labels: ['frontend','feature'], due: '2026-06-27' },
  { title: 'Ticket comments threading',  status: 'in_progress', priority: 'medium', sprint: sprint2Id, pts: 5,  rem: 3,  labels: ['backend','frontend'], due: '2026-06-28' },
  { title: 'Fix points calculation',     status: 'in_progress', priority: 'critical', sprint: sprint2Id, pts: 3, rem: 2, labels: ['bug','backend'],      due: '2026-06-24' },
  { title: 'Add label filtering',        status: 'todo',        priority: 'medium', sprint: sprint2Id, pts: 3,  rem: 3,  labels: ['frontend'],          due: '2026-06-29' },
  { title: 'Burndown chart widget',      status: 'todo',        priority: 'low',    sprint: sprint2Id, pts: 5,  rem: 5,  labels: ['frontend','feature'], due: '2026-06-29' },
  { title: 'Email notification on assign', status: 'todo',      priority: 'low',    sprint: sprint2Id, pts: 3,  rem: 3,  labels: ['backend'],           due: '2026-06-29' },
  { title: 'Improve mobile responsiveness', status: 'pr',       priority: 'medium', sprint: sprint2Id, pts: 5,  rem: 1,  labels: ['frontend','design'],  due: '2026-06-26' },
  { title: 'API rate limiting',          status: 'done',        priority: 'high',   sprint: sprint2Id, pts: 5,  rem: 0,  labels: ['backend','infra'],   due: '2026-06-23' },
  // Sprint 3 (planned)
  { title: 'Load testing suite',         status: 'todo',        priority: 'high',   sprint: sprint3Id, pts: 8,  rem: 8,  labels: ['infra'],             due: '2026-07-07' },
  { title: 'Accessibility audit',        status: 'todo',        priority: 'medium', sprint: sprint3Id, pts: 5,  rem: 5,  labels: ['frontend','docs'],   due: '2026-07-08' },
  { title: 'Dark mode polish',           status: 'todo',        priority: 'low',    sprint: sprint3Id, pts: 3,  rem: 3,  labels: ['design','frontend'], due: '2026-07-10' },
  { title: 'Webhook integrations',       status: 'todo',        priority: 'high',   sprint: sprint3Id, pts: 13, rem: 13, labels: ['backend','feature'], due: '2026-07-11' },
  { title: 'Onboarding walkthrough',     status: 'todo',        priority: 'medium', sprint: sprint3Id, pts: 5,  rem: 5,  labels: ['frontend','docs'],   due: '2026-07-12' },
];

// get current max ticket number
let maxNum = get('SELECT MAX(number) as m FROM tickets').m || 3;

const insertedTickets = [];
for (const t of ticketData) {
  maxNum++;
  const id = uuidv4();
  const assignee = allUserIds[maxNum % allUserIds.length];
  const creator = allUserIds[(maxNum + 1) % allUserIds.length];
  run(
    `INSERT INTO tickets (id, number, title, status, priority, sort_order, sprint_id, assignee_id, creator_id, total_points, points_remaining, due_date, story_points, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`,
    id, maxNum, t.title, t.status, t.priority, maxNum * 10, t.sprint, assignee, creator,
    t.pts, t.rem, t.due, t.pts
  );
  for (const lname of t.labels) {
    run('INSERT OR IGNORE INTO ticket_labels (ticket_id, label_id) VALUES (?, ?)', id, labelIds[lname]);
  }
  insertedTickets.push({ id, number: maxNum, title: t.title, sprint: t.sprint });
  console.log('ticket #' + maxNum, t.title);
}

// ── comments ─────────────────────────────────────────────────────────────────
const sampleComments = [
  "Looks good, just needs a bit more error handling.",
  "I'll pick this up after the design review.",
  "Blocked on the API changes from the backend team.",
  "PR up — please review when you get a chance.",
  "Found a regression in Safari, investigating now.",
  "This is trickier than estimated — might need an extra point.",
  "Done! Tested on Chrome, Firefox, and Safari.",
  "Can we bump this priority? Customer is waiting.",
  "Added unit tests, coverage at 87%.",
  "Merged to main. Monitoring for errors.",
];

for (let i = 0; i < insertedTickets.length; i++) {
  const ticket = insertedTickets[i];
  const numComments = (i % 3) + 1;
  for (let c = 0; c < numComments; c++) {
    run(
      `INSERT INTO comments (id, content, ticket_id, author_id, created_at, kind)
       VALUES (?, ?, ?, ?, datetime('now', '-' || ? || ' hours'), 'comment')`,
      uuidv4(),
      sampleComments[(i + c) % sampleComments.length],
      ticket.id,
      allUserIds[(i + c) % allUserIds.length],
      String((i + c) * 3 + 1)
    );
  }
}

// ── retro notes ──────────────────────────────────────────────────────────────
const retroNotes = [
  { category: 'went_well',    content: 'Deployment pipeline was smooth this sprint.' },
  { category: 'went_well',    content: 'Great collaboration on the auth feature.' },
  { category: 'went_well',    content: 'Daily standups were focused and short.' },
  { category: 'improve',      content: 'Tickets were too large — need better splitting.' },
  { category: 'improve',      content: 'PR reviews took too long, blocking others.' },
  { category: 'improve',      content: 'We underestimated the backend complexity.' },
  { category: 'improve',      content: 'Set up automated end-to-end tests before next sprint.' },
  { category: 'improve',      content: 'Define a PR review SLA: 24 hours max.' },
  { category: 'improve',      content: 'Break epics into sub-tasks at sprint planning.' },
];

for (let i = 0; i < retroNotes.length; i++) {
  const n = retroNotes[i];
  run(
    `INSERT INTO retro_notes (id, sprint_id, category, content, author_id, created_at)
     VALUES (?, ?, ?, ?, ?, datetime('now', '-' || ? || ' hours'))`,
    uuidv4(), sprint1Id, n.category, n.content,
    allUserIds[i % allUserIds.length], String(i * 2)
  );
}

// Sprint 2 retro notes (partial — sprint is active)
const retroNotes2 = [
  { category: 'went_well',    content: 'Drag-and-drop shipped ahead of schedule.' },
  { category: 'improve',      content: 'Need clearer acceptance criteria on tickets.' },
];
for (let i = 0; i < retroNotes2.length; i++) {
  const n = retroNotes2[i];
  run(
    `INSERT INTO retro_notes (id, sprint_id, category, content, author_id, created_at)
     VALUES (?, ?, ?, ?, ?, datetime('now'))`,
    uuidv4(), sprint2Id, n.category, n.content, allUserIds[i % allUserIds.length]
  );
}

db.close();
console.log('\nSeed complete.');
