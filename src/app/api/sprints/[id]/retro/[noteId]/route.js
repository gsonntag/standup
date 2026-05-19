import { NextResponse } from 'next/server';
import { jsonError, withAuth } from '@/lib/api';
import { getDb } from '@/lib/db';

export const DELETE = withAuth(async (_request, user, context) => {
  const db = getDb();
  const params = await context.params;
  const { id: sprintId, noteId } = params;
  const note = db.prepare('SELECT * FROM retro_notes WHERE id = ? AND sprint_id = ?').get(noteId, sprintId);
  if (!note) return jsonError('Note not found.', 404);
  if (note.author_id !== user.id && user.role !== 'admin') return jsonError('Forbidden.', 403);
  db.prepare('DELETE FROM retro_notes WHERE id = ?').run(noteId);
  return NextResponse.json({ ok: true });
});
