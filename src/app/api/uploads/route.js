import { randomUUID } from 'crypto';
import { mkdir, writeFile } from 'fs/promises';
import path from 'path';
import { NextResponse } from 'next/server';
import { jsonError, withAuth } from '@/lib/api';
import { getDb } from '@/lib/db';

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const IMAGE_TYPES = new Map([
  ['image/gif', 'gif'],
  ['image/jpeg', 'jpg'],
  ['image/png', 'png'],
  ['image/webp', 'webp'],
]);

export const POST = withAuth(async (request, user) => {
  const formData = await request.formData();
  const file = formData.get('image');
  const ticketId = formData.get('ticket_id') || null;

  if (!file || typeof file.arrayBuffer !== 'function') {
    return jsonError('Image is required.');
  }
  if (!IMAGE_TYPES.has(file.type)) {
    return jsonError('Upload a PNG, JPG, GIF, or WebP image.');
  }
  if (file.size > MAX_IMAGE_BYTES) {
    return jsonError('Image must be 5 MB or smaller.');
  }

  const ext = IMAGE_TYPES.get(file.type);
  const fileName = `${randomUUID()}.${ext}`;
  const uploadDir = path.join(process.cwd(), 'public', 'uploads');
  await mkdir(uploadDir, { recursive: true });
  await writeFile(path.join(uploadDir, fileName), Buffer.from(await file.arrayBuffer()));

  const url = `/uploads/${fileName}`;

  if (ticketId) {
    const db = getDb();
    const ticket = db.prepare('SELECT id FROM tickets WHERE id = ?').get(ticketId);
    if (ticket) {
      db.prepare(`
        INSERT INTO ticket_attachments (id, ticket_id, url, filename, mime_type, size_bytes, uploader_id)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(randomUUID(), ticketId, url, file.name || fileName, file.type, file.size, user.id);
    }
  }

  return NextResponse.json({
    url,
    markdown: `![${file.name || 'image'}](${url})`,
  }, { status: 201 });
});
