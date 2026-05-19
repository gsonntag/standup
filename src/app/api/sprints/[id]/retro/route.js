import { NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { jsonError, withAuth } from '@/lib/api';
import { getDb } from '@/lib/db';

async function getSprintId(context) {
  const params = await context.params;
  return params.id;
}

export const GET = withAuth(async (_request, _user, context) => {
  const db = getDb();
  const sprintId = await getSprintId(context);
  const notes = db.prepare(`
    SELECT id, category, content, created_at
    FROM retro_notes
    WHERE sprint_id = ?
    ORDER BY created_at DESC
  `).all(sprintId);
  return NextResponse.json({ notes });
});

export const POST = withAuth(async (request, user, context) => {
  const db = getDb();
  const sprintId = await getSprintId(context);
  if (!db.prepare('SELECT id FROM sprints WHERE id = ?').get(sprintId)) {
    return jsonError('Sprint not found.', 404);
  }
  const { category, content } = await request.json();
  if (!['went_well', 'improve'].includes(category)) return jsonError('Invalid category.');
  const trimmed = content?.trim();
  if (!trimmed) return jsonError('Content is required.');
  if (trimmed.length > 2000) return jsonError('Content too long (max 2000 chars).');
  const id = uuidv4();
  db.prepare('INSERT INTO retro_notes (id, sprint_id, category, content, author_id) VALUES (?, ?, ?, ?, ?)')
    .run(id, sprintId, category, trimmed, user.id);
  const note = db.prepare('SELECT id, category, content, created_at FROM retro_notes WHERE id = ?').get(id);
  return NextResponse.json({ note }, { status: 201 });
});
