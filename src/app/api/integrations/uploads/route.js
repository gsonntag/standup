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
  const file = formData.get('image');

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

  return NextResponse.json({
    url,
    markdown: `![${file.name || 'image'}](${url})`,
  }, { status: 201 });
}
