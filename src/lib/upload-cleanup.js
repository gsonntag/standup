import { unlink } from 'fs/promises';
import path from 'path';

const UPLOAD_URL_PATTERN = /\/uploads\/[A-Za-z0-9._-]+/g;

// Collect every /uploads/... URL referenced across the given text blobs
// (ticket descriptions, comment bodies). Returns a deduped list.
export function extractUploadUrls(...texts) {
  const urls = new Set();
  for (const text of texts) {
    for (const match of String(text || '').match(UPLOAD_URL_PATTERN) || []) {
      urls.add(match);
    }
  }
  return [...urls];
}

function stillReferenced(db, url) {
  const like = `%${url}%`;
  if (db.prepare('SELECT 1 FROM tickets WHERE description LIKE ? LIMIT 1').get(like)) return true;
  if (db.prepare('SELECT 1 FROM comments WHERE deleted_at IS NULL AND content LIKE ? LIMIT 1').get(like)) return true;
  return false;
}

/**
 * Delete upload files (and their attachment rows) that are no longer referenced
 * by any ticket description or live comment. Pass the URLs that may have just
 * lost a reference; call AFTER the description/comment change is committed so
 * the reference check sees current state.
 */
export async function pruneUnreferencedUploads(db, urls) {
  for (const url of [...new Set(urls)]) {
    if (!url || !url.startsWith('/uploads/')) continue;
    if (stillReferenced(db, url)) continue;
    db.prepare('DELETE FROM ticket_attachments WHERE url = ?').run(url);
    try {
      await unlink(path.join(process.cwd(), 'public', 'uploads', path.basename(url)));
    } catch {
      // file already gone — nothing to do
    }
  }
}
