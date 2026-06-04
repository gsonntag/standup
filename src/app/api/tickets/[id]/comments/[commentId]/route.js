import { NextResponse } from 'next/server';
import { jsonError, withAuth } from '@/lib/api';
import { getDb } from '@/lib/db';
import { extractUploadUrls, pruneUnreferencedUploads } from '@/lib/upload-cleanup';

async function getIds(context) {
  const params = await context.params;
  return { ticketId: params.id, commentId: params.commentId };
}

export const DELETE = withAuth(async (_request, user, context) => {
  const db = getDb();
  const { commentId } = await getIds(context);
  const comment = db.prepare('SELECT * FROM comments WHERE id = ?').get(commentId);
  if (!comment) return jsonError('Comment not found.', 404);
  if (comment.kind === 'system') return jsonError('System comments cannot be deleted.', 403);
  if (comment.author_id !== user.id && user.role !== 'admin') return jsonError('Forbidden.', 403);
  if (comment.deleted_at) return jsonError('Already deleted.', 409);
  db.prepare("UPDATE comments SET deleted_at = datetime('now'), deleted_by = ? WHERE id = ?").run(user.id, commentId);
  await pruneUnreferencedUploads(db, extractUploadUrls(comment.content));
  return NextResponse.json({ ok: true });
});
