import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import { getDb } from '@/lib/db';
import { jsonError } from '@/lib/api';
import { PRIORITIES } from '@/lib/constants';
import { notifyTicketCreated } from '@/lib/discord';
import { getTicketById } from '../../tickets/route';

const PRIORITY_VALUES = new Set(PRIORITIES.map((p) => p.value));

// Called by external integrations (e.g. the Discord bot) rather than a browser
// session, so it authenticates with a shared secret instead of a cookie.
function authorized(request) {
  const secret = process.env.BOT_API_SECRET;
  if (!secret) return false;
  const header = request.headers.get('authorization') || '';
  const expected = `Bearer ${secret}`;
  const a = Buffer.from(header);
  const b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export async function POST(request) {
  if (!authorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const db = getDb();
  let body;
  try {
    body = await request.json();
  } catch {
    return jsonError('Invalid JSON body.');
  }

  const title = body.title?.trim();
  if (!title) return jsonError('Title is required.');

  const priority = body.priority || 'medium';
  if (!PRIORITY_VALUES.has(priority)) return jsonError('Invalid priority.');

  let totalPoints = null;
  if (body.total_points != null && body.total_points !== '') {
    totalPoints = parseInt(body.total_points, 10);
    if (Number.isNaN(totalPoints) || totalPoints < 1) {
      return jsonError('total_points must be a positive integer.');
    }
  }

  // Attribute the ticket to the scrum user linked to the calling Discord user
  // when known; otherwise fall back to an admin so the creator FK is satisfied.
  let creator = null;
  if (body.discord_id) {
    creator = db.prepare('SELECT id, username, discord_id FROM users WHERE discord_id = ?').get(String(body.discord_id));
  }
  if (!creator) {
    creator = db.prepare("SELECT id, username, discord_id FROM users WHERE role = 'admin' ORDER BY created_at ASC LIMIT 1").get();
  }
  if (!creator) return jsonError('No user available to attribute the ticket to.', 500);

  const id = uuidv4();
  const sortOrder = db.prepare('SELECT COALESCE(MAX(sort_order), 0) + 1 AS next FROM tickets').get().next;
  db.prepare(`
    INSERT INTO tickets (
      id, number, title, description, status, priority, sort_order,
      creator_id, total_points, points_remaining
    )
    VALUES (?, NULL, ?, ?, 'backlog', ?, ?, ?, ?, ?)
  `).run(id, title, body.description || '', priority, sortOrder, creator.id, totalPoints, totalPoints);

  const created = getTicketById(db, id);
  notifyTicketCreated(created, { creatorName: creator.username });

  return NextResponse.json({ ticket: created }, { status: 201 });
}
