import { NextResponse } from 'next/server';
import { authenticate, COOKIE_NAME, createSession } from '@/lib/auth';
import { checkRateLimit, recordFailure, resetRateLimit } from '@/lib/rate-limit';

export async function POST(request) {
  const { username, password } = await request.json();

  if (!username || !password) {
    return NextResponse.json({ error: 'Username and password are required.' }, { status: 400 });
  }

  const ip = request.headers.get('x-forwarded-for')?.split(',')[0].trim() || 'unknown';
  const rateKey = `${ip}:${username.toLowerCase()}`;

  const { limited, retryAfter } = checkRateLimit(rateKey);
  if (limited) {
    return NextResponse.json(
      { error: 'Too many failed attempts. Try again later.' },
      { status: 429, headers: { 'Retry-After': String(retryAfter) } }
    );
  }

  const user = authenticate(username, password);
  if (!user) {
    recordFailure(rateKey);
    return NextResponse.json({ error: 'Invalid username or password.' }, { status: 401 });
  }

  resetRateLimit(rateKey);

  const response = NextResponse.json({ user });
  response.cookies.set(COOKIE_NAME, createSession(user.id), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 7 * 24 * 60 * 60,
  });
  return response;
}
