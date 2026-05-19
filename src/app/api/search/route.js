import { NextResponse } from 'next/server';
import { withAuth } from '@/lib/api';
import { getDb } from '@/lib/db';
import { attachLabels } from '../tickets/route';

export const GET = withAuth(async (request) => {
  const db = getDb();
  const { searchParams } = new URL(request.url);
  const q = searchParams.get('q')?.trim() || '';
  const limit = Math.min(parseInt(searchParams.get('limit') || '20', 10), 50);
  if (!q) return NextResponse.json({ results: [] });

  const results = [];
  const seen = new Set();

  // 1. Exact number match
  const num = parseInt(q, 10);
  if (!isNaN(num) && String(num) === q) {
    const t = db.prepare(`
      SELECT t.id, t.number, t.title, t.status, t.sprint_id, s.name AS sprint_name
      FROM tickets t LEFT JOIN sprints s ON s.id = t.sprint_id
      WHERE t.number = ?
    `).get(num);
    if (t) { seen.add(t.id); results.push(t); }
  }

  // 2. Title prefix match
  const prefix = db.prepare(`
    SELECT t.id, t.number, t.title, t.status, t.sprint_id, s.name AS sprint_name
    FROM tickets t LEFT JOIN sprints s ON s.id = t.sprint_id
    WHERE t.title LIKE ? COLLATE NOCASE
    ORDER BY t.number ASC LIMIT ?
  `).all(q + '%', limit);
  for (const t of prefix) { if (!seen.has(t.id)) { seen.add(t.id); results.push(t); } }

  // 3. Title substring match
  if (results.length < limit) {
    const sub = db.prepare(`
      SELECT t.id, t.number, t.title, t.status, t.sprint_id, s.name AS sprint_name
      FROM tickets t LEFT JOIN sprints s ON s.id = t.sprint_id
      WHERE t.title LIKE ? COLLATE NOCASE
      ORDER BY t.number ASC LIMIT ?
    `).all('%' + q + '%', limit);
    for (const t of sub) { if (!seen.has(t.id)) { seen.add(t.id); results.push(t); } }
  }

  // 4. Label name match
  if (results.length < limit) {
    const byLabel = db.prepare(`
      SELECT DISTINCT t.id, t.number, t.title, t.status, t.sprint_id, s.name AS sprint_name
      FROM tickets t
      LEFT JOIN sprints s ON s.id = t.sprint_id
      JOIN ticket_labels tl ON tl.ticket_id = t.id
      JOIN labels l ON l.id = tl.label_id
      WHERE l.name LIKE ? COLLATE NOCASE
      ORDER BY t.number ASC LIMIT ?
    `).all('%' + q + '%', limit);
    for (const t of byLabel) { if (!seen.has(t.id)) { seen.add(t.id); results.push(t); } }
  }

  const trimmed = results.slice(0, limit);
  const withLabels = attachLabels(db, trimmed);
  return NextResponse.json({ results: withLabels });
});
