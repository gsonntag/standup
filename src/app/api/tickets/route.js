import { NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { jsonError, withAuth } from '@/lib/api';
import { getDb } from '@/lib/db';
import { PRIORITIES, STATUSES, ticketRules } from '@/lib/constants';
import { notifyTicketCreated } from '@/lib/discord';
import { attachMarkdownImagesToTicket } from '@/lib/markdown-attachments';

const PRIORITY_VALUES = new Set(PRIORITIES.map((p) => p.value));
const STATUS_VALUES = new Set(STATUSES.map((s) => s.value));
const SORT_EXPRESSIONS = {
  number: 't.number',
  priority: "CASE t.priority WHEN 'urgent' THEN 4 WHEN 'high' THEN 3 WHEN 'medium' THEN 2 WHEN 'low' THEN 1 ELSE 0 END",
  assignee: 'LOWER(COALESCE(assignee_sort.username, assignee.username, \'\'))',
  sprint: 'LOWER(COALESCE(s.name, \'\'))',
};

function parsePositiveInteger(value, field) {
  if (value === null || value === undefined || value === '') return null;
  const parsed = parseInt(value, 10);
  if (Number.isNaN(parsed) || parsed < 1) {
    return { error: `${field} must be a positive integer.` };
  }
  return parsed;
}

function parseNonNegativeInteger(value, field) {
  if (value === null || value === undefined || value === '') return null;
  const parsed = parseInt(value, 10);
  if (Number.isNaN(parsed) || parsed < 0) {
    return { error: `${field} must be zero or a positive integer.` };
  }
  return parsed;
}

function normalizeIdList(value) {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.filter(Boolean).map((item) => String(item)))];
}

export function attachLabels(db, tickets) {
  if (!tickets.length) return tickets;
  const ticketIds = tickets.map((ticket) => ticket.id);
  const placeholders = ticketIds.map(() => '?').join(',');
  const labelRows = db.prepare(`
    SELECT tl.ticket_id, l.id, l.name, l.color
    FROM ticket_labels tl
    JOIN labels l ON l.id = tl.label_id
    WHERE tl.ticket_id IN (${placeholders})
    ORDER BY l.name ASC
  `).all(...ticketIds);
  const labelsByTicket = new Map();
  for (const row of labelRows) {
    if (!labelsByTicket.has(row.ticket_id)) labelsByTicket.set(row.ticket_id, []);
    labelsByTicket.get(row.ticket_id).push({
      id: row.id,
      name: row.name,
      color: row.color,
    });
  }
  return tickets.map((ticket) => ({
    ...ticket,
    labels: labelsByTicket.get(ticket.id) || [],
  }));
}

export function attachAssignees(db, tickets) {
  if (!tickets.length) return tickets;
  const ticketIds = tickets.map((ticket) => ticket.id);
  const placeholders = ticketIds.map(() => '?').join(',');
  const assigneeRows = db.prepare(`
    SELECT ta.ticket_id, u.id, u.username, u.discord_id
    FROM ticket_assignees ta
    JOIN users u ON u.id = ta.user_id
    WHERE ta.ticket_id IN (${placeholders})
    ORDER BY u.username ASC
  `).all(...ticketIds);
  const assigneesByTicket = new Map();
  for (const row of assigneeRows) {
    if (!assigneesByTicket.has(row.ticket_id)) assigneesByTicket.set(row.ticket_id, []);
    assigneesByTicket.get(row.ticket_id).push({
      id: row.id,
      username: row.username,
      discord_id: row.discord_id,
    });
  }
  return tickets.map((ticket) => {
    const assignees = assigneesByTicket.get(ticket.id) || [];
    const primaryAssignee = ticket.assignee_id
      ? assignees.find((assignee) => assignee.id === ticket.assignee_id)
      : null;
    return {
      ...ticket,
      assignees,
      assignee_username: primaryAssignee?.username || ticket.assignee_username || assignees[0]?.username || null,
    };
  });
}

export function attachReviewers(db, tickets) {
  if (!tickets.length) return tickets;
  const ticketIds = tickets.map((ticket) => ticket.id);
  const placeholders = ticketIds.map(() => '?').join(',');
  const reviewerRows = db.prepare(`
    SELECT tr.ticket_id, u.id, u.username, u.discord_id, tr.requested_by, requester.username AS requested_by_username, tr.created_at
    FROM ticket_reviewers tr
    JOIN users u ON u.id = tr.user_id
    LEFT JOIN users requester ON requester.id = tr.requested_by
    WHERE tr.ticket_id IN (${placeholders})
    ORDER BY tr.created_at ASC, u.username ASC
  `).all(...ticketIds);
  const reviewersByTicket = new Map();
  for (const row of reviewerRows) {
    if (!reviewersByTicket.has(row.ticket_id)) reviewersByTicket.set(row.ticket_id, []);
    reviewersByTicket.get(row.ticket_id).push({
      id: row.id,
      username: row.username,
      discord_id: row.discord_id,
      requested_by: row.requested_by,
      requested_by_username: row.requested_by_username,
      created_at: row.created_at,
    });
  }
  return tickets.map((ticket) => ({
    ...ticket,
    reviewers: reviewersByTicket.get(ticket.id) || [],
  }));
}

export function attachGitHubRepositories(db, tickets) {
  if (!tickets.length) return tickets;
  const ticketIds = tickets.map((ticket) => ticket.id);
  const placeholders = ticketIds.map(() => '?').join(',');
  const repoRows = db.prepare(`
    SELECT tr.ticket_id, gr.id, gr.owner, gr.name, gr.default_branch, gr.html_url
    FROM ticket_repositories tr
    JOIN github_repositories gr ON gr.id = tr.repo_id
    WHERE tr.ticket_id IN (${placeholders})
    ORDER BY gr.owner ASC, gr.name ASC
  `).all(...ticketIds);
  const reposByTicket = new Map();
  for (const row of repoRows) {
    if (!reposByTicket.has(row.ticket_id)) reposByTicket.set(row.ticket_id, []);
    reposByTicket.get(row.ticket_id).push({
      id: row.id,
      owner: row.owner,
      name: row.name,
      default_branch: row.default_branch,
      html_url: row.html_url,
      full_name: `${row.owner}/${row.name}`,
    });
  }
  return tickets.map((ticket) => {
    const repos = reposByTicket.get(ticket.id) || [];
    const githubRepository = repos[0] || null;
    const githubRepoId = ticket.github_repo_id || githubRepository?.id || null;
    const {
      github_repository_id,
      github_repository_owner,
      github_repository_name,
      github_repository_default_branch,
      github_repository_html_url,
      ...rest
    } = ticket;
    return {
      ...rest,
      github_repo_id: githubRepoId,
      github_repository: githubRepository,
      github_repositories: repos,
    };
  });
}

export function getTicketById(db, id) {
  const ticket = db.prepare(`
    SELECT t.*,
      assignee.username AS assignee_username,
      creator.username AS creator_username,
      gr.id AS github_repository_id,
      gr.owner AS github_repository_owner,
      gr.name AS github_repository_name,
      gr.default_branch AS github_repository_default_branch,
      gr.html_url AS github_repository_html_url,
      (SELECT COUNT(*) FROM ticket_dependencies WHERE ticket_id = t.id) AS blocker_count,
      (
        SELECT COUNT(*)
        FROM ticket_dependencies td
        JOIN tickets dep ON dep.id = td.depends_on_id
        WHERE td.ticket_id = t.id AND dep.status != 'done'
      ) AS unresolved_blocker_count
    FROM tickets t
    LEFT JOIN users assignee ON assignee.id = t.assignee_id
    JOIN users creator ON creator.id = t.creator_id
    LEFT JOIN github_repositories gr ON gr.id = t.github_repo_id
    WHERE t.id = ?
  `).get(id);
  if (!ticket) return null;
  return attachGitHubRepositories(db, attachLabels(db, attachReviewers(db, attachAssignees(db, [ticket]))))[0];
}

export const GET = withAuth(async (request) => {
  const db = getDb();
  const { searchParams } = new URL(request.url);
  const where = [];
  const args = [];

  if (searchParams.has('sprint_id')) {
    const sprintId = searchParams.get('sprint_id');
    if (sprintId === 'none') {
      where.push('t.sprint_id IS NULL');
    } else {
      where.push('t.sprint_id = ?');
      args.push(sprintId);
    }
  }
  if (searchParams.has('status')) {
    where.push('t.status = ?');
    args.push(searchParams.get('status'));
  }
  if (searchParams.has('exclude_status')) {
    where.push('t.status != ?');
    args.push(searchParams.get('exclude_status'));
  }
  if (searchParams.has('assignee_id')) {
    where.push('(t.assignee_id = ? OR t.id IN (SELECT ticket_id FROM ticket_assignees WHERE user_id = ?))');
    args.push(searchParams.get('assignee_id'));
    args.push(searchParams.get('assignee_id'));
  }
  if (searchParams.has('priority')) {
    where.push('t.priority = ?');
    args.push(searchParams.get('priority'));
  }
  if (searchParams.has('q')) {
    const q = searchParams.get('q');
    where.push('(t.title LIKE ? OR CAST(t.number AS TEXT) = ?)');
    args.push('%' + q + '%', q);
  }
  const labelIds = searchParams.getAll('label_id');
  if (labelIds.length) {
    const ph = labelIds.map(() => '?').join(',');
    where.push(`t.id IN (SELECT ticket_id FROM ticket_labels WHERE label_id IN (${ph}) GROUP BY ticket_id HAVING COUNT(DISTINCT label_id) = ${labelIds.length})`);
    args.push(...labelIds);
  }

  const total = db.prepare(`
    SELECT COUNT(*) AS count
    FROM tickets t
    ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
  `).get(...args).count;

  const limit = Math.min(parseInt(searchParams.get('limit') || '100', 10), 500);
  const offset = parseInt(searchParams.get('offset') || '0', 10);
  const sortBy = SORT_EXPRESSIONS[searchParams.get('sort_by')] ? searchParams.get('sort_by') : 'sort_order';
  const sortDir = searchParams.get('sort_dir') === 'desc' ? 'DESC' : 'ASC';
  const orderBy = sortBy === 'sort_order'
    ? 't.sort_order ASC, t.created_at DESC'
    : `${SORT_EXPRESSIONS[sortBy]} ${sortDir}, t.sort_order ASC, t.created_at DESC`;

  const tickets = db.prepare(`
    SELECT t.*,
      assignee.username AS assignee_username,
      creator.username AS creator_username,
      s.name AS sprint_name,
      gr.id AS github_repository_id,
      gr.owner AS github_repository_owner,
      gr.name AS github_repository_name,
      gr.default_branch AS github_repository_default_branch,
      gr.html_url AS github_repository_html_url,
      (SELECT COUNT(*) FROM ticket_dependencies WHERE ticket_id = t.id) AS blocker_count,
      (
        SELECT COUNT(*)
        FROM ticket_dependencies td
        JOIN tickets dep ON dep.id = td.depends_on_id
        WHERE td.ticket_id = t.id AND dep.status != 'done'
      ) AS unresolved_blocker_count
    FROM tickets t
    LEFT JOIN users assignee ON assignee.id = t.assignee_id
    LEFT JOIN users assignee_sort ON assignee_sort.id = COALESCE(t.assignee_id, (
      SELECT ta.user_id
      FROM ticket_assignees ta
      JOIN users au ON au.id = ta.user_id
      WHERE ta.ticket_id = t.id
      ORDER BY LOWER(au.username) ASC
      LIMIT 1
    ))
    JOIN users creator ON creator.id = t.creator_id
    LEFT JOIN sprints s ON s.id = t.sprint_id
    LEFT JOIN github_repositories gr ON gr.id = t.github_repo_id
    ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
    ORDER BY ${orderBy}
    LIMIT ? OFFSET ?
  `).all(...args, limit, offset);

  return NextResponse.json({ tickets: attachGitHubRepositories(db, attachLabels(db, attachReviewers(db, attachAssignees(db, tickets)))), total });
});

export const POST = withAuth(async (request, user) => {
  const db = getDb();
  const body = await request.json();
  const title = body.title?.trim();
  const priority = body.priority || 'medium';
  const requestedStatus = body.status || null;
  const sprintId = body.sprint_id || null;
  const assigneeIds = normalizeIdList(body.assignee_ids || (body.assignee_id ? [body.assignee_id] : []));
  const assigneeId = assigneeIds[0] || null;
  const githubRepoIds = normalizeIdList(body.github_repo_ids || (body.github_repo_id ? [body.github_repo_id] : []));
  const githubRepoId = githubRepoIds[0] || null;
  const labelIds = normalizeIdList(body.label_ids);
  const watcherIds = normalizeIdList(body.watcher_ids);
  const blockerIds = normalizeIdList(body.blocker_ids);
  const totalPoints = parsePositiveInteger(body.total_points ?? body.story_points, 'total_points');
  if (totalPoints?.error) return jsonError(totalPoints.error);
  const pointsRemainingInput = parseNonNegativeInteger(body.points_remaining, 'points_remaining');
  if (pointsRemainingInput?.error) return jsonError(pointsRemainingInput.error);
  if (pointsRemainingInput != null && totalPoints == null) {
    return jsonError('points_remaining requires total_points.');
  }
  let pointsRemaining = totalPoints == null ? null : pointsRemainingInput ?? totalPoints;
  if (pointsRemaining != null && pointsRemaining > totalPoints) {
    return jsonError('points_remaining cannot exceed total_points.');
  }
  let status = requestedStatus || (sprintId ? 'todo' : 'backlog');
  // Backlog boundary: no sprint means backlog; a sprinted ticket cannot be backlog.
  if (!sprintId) status = 'backlog';
  else if (status === 'backlog') status = 'todo';

  if (!title) return jsonError('Title is required.');
  if (!PRIORITY_VALUES.has(priority)) return jsonError('Invalid priority.');
  if (!STATUS_VALUES.has(status)) return jsonError('Invalid status.');
  if (assigneeIds.length && !ticketRules.canAssign(status)) {
    return jsonError('Backlog tickets cannot be assigned. Add the ticket to a sprint first.');
  }
  if (body.due_date && !ticketRules.canSetDueDate(sprintId)) {
    return jsonError('Due dates can only be set once a ticket is in a sprint.');
  }
  if (status === 'done' && totalPoints != null) pointsRemaining = 0;
  if (pointsRemaining === 0 && status !== 'done' && status !== 'in_review') status = 'in_review';
  let sprintEndDate = null;
  if (sprintId) {
    const sprint = db.prepare('SELECT end_date FROM sprints WHERE id = ?').get(sprintId);
    if (!sprint) return jsonError('Sprint not found.', 404);
    sprintEndDate = sprint.end_date || null;
  }
  for (const nextAssigneeId of assigneeIds) {
    if (!db.prepare('SELECT id FROM users WHERE id = ?').get(nextAssigneeId)) {
      return jsonError('Assignee not found.', 404);
    }
  }
  for (const repoId of githubRepoIds) {
    if (!db.prepare('SELECT id FROM github_repositories WHERE id = ?').get(repoId)) {
      return jsonError('GitHub repository not found.', 404);
    }
  }
  for (const labelId of labelIds) {
    if (!db.prepare('SELECT id FROM labels WHERE id = ?').get(labelId)) {
      return jsonError('Label not found.', 404);
    }
  }
  for (const watcherId of watcherIds) {
    if (!db.prepare('SELECT id FROM users WHERE id = ?').get(watcherId)) {
      return jsonError('Watcher not found.', 404);
    }
  }
  for (const blockerId of blockerIds) {
    if (!db.prepare('SELECT id FROM tickets WHERE id = ?').get(blockerId)) {
      return jsonError('Blocker ticket not found.', 404);
    }
  }

  const dueDate = body.due_date || sprintEndDate;
  if (dueDate && !/^\d{4}-\d{2}-\d{2}$/.test(dueDate)) return jsonError('Invalid due_date format. Use YYYY-MM-DD.');

  const id = uuidv4();
  const sortOrder = db.prepare('SELECT COALESCE(MAX(sort_order), 0) + 1 AS next FROM tickets').get().next;
  const createTx = db.transaction(() => {
    db.prepare(`
      INSERT INTO tickets (
        id, number, title, description, status, priority, sort_order, sprint_id, assignee_id,
        creator_id, total_points, points_remaining, github_repo_id, due_date
      )
      VALUES (?, NULL, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, title, body.description || '', status, priority, sortOrder, sprintId, assigneeId, user.id, totalPoints, pointsRemaining, githubRepoId, dueDate);

    for (const repoId of githubRepoIds) {
      db.prepare('INSERT OR IGNORE INTO ticket_repositories (ticket_id, repo_id) VALUES (?, ?)').run(id, repoId);
    }

    for (const labelId of labelIds) {
      db.prepare('INSERT OR IGNORE INTO ticket_labels (ticket_id, label_id) VALUES (?, ?)').run(id, labelId);
    }
    for (const watcherId of watcherIds) {
      db.prepare('INSERT OR IGNORE INTO ticket_watchers (ticket_id, user_id) VALUES (?, ?)').run(id, watcherId);
    }
    for (const nextAssigneeId of assigneeIds) {
      db.prepare('INSERT OR IGNORE INTO ticket_assignees (ticket_id, user_id) VALUES (?, ?)').run(id, nextAssigneeId);
      db.prepare('INSERT OR IGNORE INTO ticket_watchers (ticket_id, user_id) VALUES (?, ?)').run(id, nextAssigneeId);
    }
    for (const blockerId of blockerIds) {
      db.prepare('INSERT OR IGNORE INTO ticket_dependencies (ticket_id, depends_on_id) VALUES (?, ?)').run(id, blockerId);
    }
    attachMarkdownImagesToTicket(db, { ticketId: id, description: body.description || '', userId: user.id });
  });
  createTx();

  const created = getTicketById(db, id);
  // Don't ping the creator if they assigned the ticket to themselves.
  const assigneeDiscordIds = assigneeIds
    .filter((nextAssigneeId) => nextAssigneeId !== user.id)
    .map((nextAssigneeId) => db.prepare('SELECT discord_id FROM users WHERE id = ?').get(nextAssigneeId)?.discord_id)
    .filter(Boolean);
  notifyTicketCreated(created, { creatorName: user.username, assigneeDiscordIds });

  return NextResponse.json({ ticket: created }, { status: 201 });
});
