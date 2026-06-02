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
  const files = formData.getAll('image').filter((file) => file && typeof file.arrayBuffer === 'function');
  const ticketId = formData.get('ticket_id') || null;

  if (!files.length) {
    return jsonError('At least one image is required.');
  }
  for (const file of files) {
    if (!IMAGE_TYPES.has(file.type)) {
      return jsonError('Upload PNG, JPG, GIF, or WebP images.');
    }
    if (file.size > MAX_IMAGE_BYTES) {
      return jsonError(`${file.name || 'Image'} must be 5 MB or smaller.`);
    }
  }

  const uploadDir = path.join(process.cwd(), 'public', 'uploads');
  await mkdir(uploadDir, { recursive: true });
  const uploaded = [];
  for (const file of files) {
    const ext = IMAGE_TYPES.get(file.type);
    const fileName = `${randomUUID()}.${ext}`;
    await writeFile(path.join(uploadDir, fileName), Buffer.from(await file.arrayBuffer()));
    const url = `/uploads/${fileName}`;
    uploaded.push({
      url,
      markdown: `![${file.name || 'image'}](${url})`,
      filename: file.name || fileName,
      mime_type: file.type,
      size_bytes: file.size,
    });
  }

  if (ticketId) {
    const db = getDb();
    const ticket = db.prepare('SELECT id FROM tickets WHERE id = ?').get(ticketId);
    if (ticket) {
      const insert = db.prepare(`
          INSERT INTO ticket_attachments (id, ticket_id, url, filename, mime_type, size_bytes, uploader_id)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `);
      const tx = db.transaction(() => {
        for (const file of uploaded) {
          insert.run(randomUUID(), ticketId, file.url, file.filename, file.mime_type, file.size_bytes, user.id);
        }
      });
      tx();
    }
  }

  return NextResponse.json({
    url: uploaded[0].url,
    markdown: uploaded.map((file) => file.markdown).join('\n\n'),
    images: uploaded,
  }, { status: 201 });
});
