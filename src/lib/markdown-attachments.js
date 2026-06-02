import { randomUUID } from 'crypto';
import { statSync } from 'fs';
import path from 'path';

const IMAGE_MARKDOWN_PATTERN = /!\[([^\]]*)\]\((\/uploads\/[^)\s]+)\)/g;
const MIME_BY_EXT = new Map([
  ['.gif', 'image/gif'],
  ['.jpg', 'image/jpeg'],
  ['.jpeg', 'image/jpeg'],
  ['.png', 'image/png'],
  ['.webp', 'image/webp'],
]);

export function attachMarkdownImagesToTicket(db, { ticketId, description = '', userId }) {
  if (!ticketId || !description || !userId) return;

  const matches = [...description.matchAll(IMAGE_MARKDOWN_PATTERN)];
  if (!matches.length) return;

  const uploads = [];
  const seenUrls = new Set();
  for (const match of matches) {
    const url = match[2];
    if (seenUrls.has(url)) continue;
    seenUrls.add(url);

    const basename = path.basename(url);
    const ext = path.extname(basename).toLowerCase();
    const mimeType = MIME_BY_EXT.get(ext);
    if (!mimeType) continue;

    let sizeBytes = 0;
    try {
      sizeBytes = statSync(path.join(process.cwd(), 'public', 'uploads', basename)).size;
    } catch (_) {
      continue;
    }

    uploads.push({
      url,
      filename: match[1] || basename,
      mimeType,
      sizeBytes,
    });
  }
  if (!uploads.length) return;

  const insert = db.prepare(`
    INSERT INTO ticket_attachments (id, ticket_id, url, filename, mime_type, size_bytes, uploader_id)
    SELECT ?, ?, ?, ?, ?, ?, ?
    WHERE NOT EXISTS (
      SELECT 1 FROM ticket_attachments WHERE ticket_id = ? AND url = ?
    )
  `);
  for (const upload of uploads) {
    insert.run(
      randomUUID(),
      ticketId,
      upload.url,
      upload.filename,
      upload.mimeType,
      upload.sizeBytes,
      userId,
      ticketId,
      upload.url
    );
  }
}
