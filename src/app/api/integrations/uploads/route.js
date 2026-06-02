import { randomUUID } from 'crypto';
import crypto from 'crypto';
import { mkdir, writeFile } from 'fs/promises';
import path from 'path';
import { NextResponse } from 'next/server';
import { jsonError } from '@/lib/api';

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const IMAGE_TYPES = new Map([
  ['image/gif', 'gif'],
  ['image/jpeg', 'jpg'],
  ['image/jpg', 'jpg'],
  ['image/png', 'png'],
  ['image/webp', 'webp'],
]);

// Called by external integrations (the Discord bot) rather than a browser
// session, so it authenticates with the same shared secret as the tickets
// endpoint instead of a cookie.
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

  const formData = await request.formData();
  const files = formData.getAll('image').filter((file) => file && typeof file.arrayBuffer === 'function');

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

  return NextResponse.json({
    url: uploaded[0].url,
    markdown: uploaded.map((file) => file.markdown).join('\n\n'),
    images: uploaded,
  }, { status: 201 });
}
