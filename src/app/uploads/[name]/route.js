import { readFile } from 'fs/promises';
import path from 'path';
import { NextResponse } from 'next/server';

// Next.js only serves files that exist in /public at build time, so uploads
// written at runtime must be served through this route handler instead.
const CONTENT_TYPES = new Map([
  ['gif', 'image/gif'],
  ['jpg', 'image/jpeg'],
  ['jpeg', 'image/jpeg'],
  ['png', 'image/png'],
  ['webp', 'image/webp'],
]);

export async function GET(request, { params }) {
  const { name } = await params;
  const fileName = path.basename(name || '');
  const ext = fileName.split('.').pop()?.toLowerCase();
  const contentType = CONTENT_TYPES.get(ext);

  if (!fileName || !contentType) {
    return new NextResponse('Not found', { status: 404 });
  }

  try {
    const file = await readFile(path.join(process.cwd(), 'public', 'uploads', fileName));
    return new NextResponse(file, {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    });
  } catch {
    return new NextResponse('Not found', { status: 404 });
  }
}
