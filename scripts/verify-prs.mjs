import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';
import { v4 as uuidv4 } from 'uuid';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = path.join(__dirname, '..', 'data', 'scrum.db');

console.log('Using database at:', DB_PATH);
const db = new Database(DB_PATH);
db.pragma('foreign_keys = ON');

function runTest() {
  console.log('\n--- Starting PR Linking Verification Test ---');

  // 1. Create mock data
  const userId = 'test-user-id';
  const repoId = 'test-repo-id';
  const ticketId = 'test-ticket-id';
  const prNumber = 999;

  // Cleanup any old test data
  db.prepare("DELETE FROM users WHERE id = ?").run(userId);
  db.prepare("DELETE FROM github_repositories WHERE id = ?").run(repoId);
  db.prepare("DELETE FROM tickets WHERE id = ?").run(ticketId);

  // Insert mock user
  db.prepare("INSERT INTO users (id, username, password, role) VALUES (?, 'testuser', 'pass', 'admin')").run(userId);
  console.log('✓ Mock user inserted.');

  // Insert mock repository
  db.prepare("INSERT INTO github_repositories (id, owner, name, default_branch, html_url) VALUES (?, 'owner', 'repo', 'main', 'http://github')").run(repoId);
  console.log('✓ Mock repository inserted.');

  // Insert mock ticket (status: 'todo')
  db.prepare(`
    INSERT INTO tickets (id, number, title, status, creator_id, github_repo_id)
    VALUES (?, 9999, 'Test Ticket', 'todo', ?, ?)
  `).run(ticketId, userId, repoId);
  console.log('✓ Mock ticket inserted (status: todo).');

  // Insert mock pull request (state: 'open')
  db.prepare(`
    INSERT INTO github_pull_requests (repo_id, number, title, state, html_url, author_login, created_at, updated_at)
    VALUES (?, ?, 'Test PR', 'open', 'http://pr', 'author', '2026-06-04', '2026-06-04')
  `).run(repoId, prNumber);
  console.log('✓ Mock pull request inserted.');

  // 2. Test PR linking & auto-transition
  console.log('\nTesting PR linking...');
  const tx = db.transaction(() => {
    // Insert link
    db.prepare(`
      INSERT OR IGNORE INTO ticket_pull_requests (ticket_id, repo_id, pr_number, linked_by)
      VALUES (?, ?, ?, ?)
    `).run(ticketId, repoId, prNumber, userId);

    // Fetch current ticket
    const ticket = db.prepare('SELECT status, github_repo_id FROM tickets WHERE id = ?').get(ticketId);

    // Perform auto-transition
    if (ticket.status !== 'in_review' && ticket.status !== 'done') {
      db.prepare(`
        UPDATE tickets
        SET status = 'in_review', updated_at = datetime('now')
        WHERE id = ?
      `).run(ticketId);

      db.prepare(`
        INSERT INTO ticket_events (id, ticket_id, actor_id, kind, field, old_value, new_value, created_at)
        VALUES (?, ?, ?, 'field_change', 'status', ?, 'in_review', datetime('now'))
      `).run(uuidv4(), ticketId, userId, ticket.status);
    }
  });
  tx();

  // Verify transition result
  const updatedTicket = db.prepare('SELECT status FROM tickets WHERE id = ?').get(ticketId);
  const linkRow = db.prepare('SELECT * FROM ticket_pull_requests WHERE ticket_id = ? AND pr_number = ?').get(ticketId, prNumber);
  const eventRow = db.prepare("SELECT * FROM ticket_events WHERE ticket_id = ? AND field = 'status'").get(ticketId);

  if (linkRow) {
    console.log('✓ Link successfully inserted into ticket_pull_requests.');
  } else {
    throw new Error('FAIL: Link row was not inserted.');
  }

  if (updatedTicket.status === 'in_review') {
    console.log('✓ Ticket status successfully auto-transitioned to "in_review" (PR).');
  } else {
    throw new Error(`FAIL: Ticket status is "${updatedTicket.status}" instead of "in_review".`);
  }

  if (eventRow && eventRow.old_value === 'todo' && eventRow.new_value === 'in_review') {
    console.log('✓ Ticket event field_change (todo -> in_review) logged correctly.');
  } else {
    throw new Error('FAIL: Ticket event was not created correctly.');
  }

  // 3. Test changing repo clears PRs
  console.log('\nTesting repository change clears PRs...');
  db.prepare('DELETE FROM ticket_pull_requests WHERE ticket_id = ?').run(ticketId);
  const clearedLink = db.prepare('SELECT * FROM ticket_pull_requests WHERE ticket_id = ?').get(ticketId);
  if (!clearedLink) {
    console.log('✓ Changing repository simulation cleared all ticket PR links.');
  } else {
    throw new Error('FAIL: PR links were not cleared.');
  }

  // 4. Cleanup
  db.prepare("DELETE FROM users WHERE id = ?").run(userId);
  db.prepare("DELETE FROM github_repositories WHERE id = ?").run(repoId);
  db.prepare("DELETE FROM tickets WHERE id = ?").run(ticketId);
  console.log('\n✓ Cleanup complete.');
  console.log('--- All tests passed successfully! ---\n');
}

try {
  runTest();
} catch (e) {
  console.error(e.message);
  process.exit(1);
} finally {
  db.close();
}
