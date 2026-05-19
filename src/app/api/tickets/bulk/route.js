import { NextResponse } from 'next/server';
import { jsonError, withAuth } from '@/lib/api';
import { getDb } from '@/lib/db';

export const POST = withAuth(async (request, user) => {
  const db = getDb();
  const { ids, set, add_label_ids, remove_label_ids, delete: doDelete } = await request.json();
  if (!Array.isArray(ids) || !ids.length) return jsonError('ids required.');

  const failedIds = [];
  const tx = db.transaction(() => {
    for (const id of ids) {
      const ticket = db.prepare('SELECT creator_id FROM tickets WHERE id = ?').get(id);
      if (!ticket) { failedIds.push(id); continue; }

      if (doDelete) {
        if (user.role !== 'admin' && ticket.creator_id !== user.id) {
          failedIds.push(id); continue;
        }
        db.prepare('DELETE FROM tickets WHERE id = ?').run(id);
        continue;
      }

      if (set && Object.keys(set).length) {
        const setClauses = [];
        const setArgs = [];
        const allowedFields = ['sprint_id', 'status', 'priority', 'assignee_id'];
        for (const [k, v] of Object.entries(set)) {
          if (!allowedFields.includes(k)) continue;
          setClauses.push(`${k} = ?`);
          setArgs.push(v || null);
        }
        if (setClauses.length) {
          setClauses.push("updated_at = datetime('now')");
          db.prepare(`UPDATE tickets SET ${setClauses.join(', ')} WHERE id = ?`).run(...setArgs, id);
        }
      }

      if (add_label_ids?.length) {
        for (const labelId of add_label_ids) {
          db.prepare('INSERT OR IGNORE INTO ticket_labels (ticket_id, label_id) VALUES (?, ?)').run(id, labelId);
        }
      }
      if (remove_label_ids?.length) {
        for (const labelId of remove_label_ids) {
          db.prepare('DELETE FROM ticket_labels WHERE ticket_id = ? AND label_id = ?').run(id, labelId);
        }
      }
    }
  });
  tx();

  if (failedIds.length) {
    return NextResponse.json({ ok: false, failed_ids: failedIds });
  }
  return NextResponse.json({ ok: true });
});
