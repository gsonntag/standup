import { NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { jsonError, withAuth } from '@/lib/api';
import { LABEL_COLORS } from '@/lib/constants';
import { getDb } from '@/lib/db';

const COLORS = new Set(LABEL_COLORS.map((color) => color.hex));

export const GET = withAuth(async () => {
  const labels = getDb().prepare('SELECT * FROM labels ORDER BY name ASC').all();
  return NextResponse.json({ labels });
});

export const POST = withAuth(async (request) => {
  const db = getDb();
  const { name, color } = await request.json();
  const cleanName = name?.trim().toLowerCase();

  if (!cleanName) return jsonError('Name is required.');
  if (!color || !COLORS.has(color)) return jsonError('Color must be one of the preset colors.');
  if (db.prepare('SELECT id FROM labels WHERE name = ?').get(cleanName)) return jsonError('Label already exists.');

  const id = uuidv4();
  db.prepare('INSERT INTO labels (id, name, color) VALUES (?, ?, ?)').run(id, cleanName, color);
  return NextResponse.json({ label: db.prepare('SELECT * FROM labels WHERE id = ?').get(id) }, { status: 201 });
});
