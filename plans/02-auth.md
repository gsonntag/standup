# Phase 2: Authentication

## Goal

Build a login page, session management, and auth middleware. After this phase:
1. Users can log in at `/login` with username and password
2. Unauthenticated users are redirected to `/login`
3. Logged-in users can log out
4. All API routes can access the current user

---

## Step 1: Create `src/lib/auth.js`

This file contains all session management functions.

```js
import { getDb } from './db';
import { v4 as uuidv4 } from 'uuid';
import bcrypt from 'bcryptjs';
import { cookies } from 'next/headers';
import { SESSION_DURATION_DAYS } from './constants';

const COOKIE_NAME = 'session';

/**
 * Authenticate a user by username and password.
 * Returns the user object (without password) if valid, null otherwise.
 */
export function authenticate(username, password) {
  const db = getDb();
  const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
  if (!user) return null;
  if (!bcrypt.compareSync(password, user.password)) return null;
  const { password: _, ...safeUser } = user;
  return safeUser;
}

/**
 * Create a new session for a user. Returns the session ID.
 */
export function createSession(userId) {
  const db = getDb();
  const id = uuidv4();
  const expiresAt = new Date(
    Date.now() + SESSION_DURATION_DAYS * 24 * 60 * 60 * 1000
  ).toISOString();
  db.prepare('INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, ?)')
    .run(id, userId, expiresAt);
  return id;
}

/**
 * Get the current user from the session cookie.
 * Returns user object (without password) or null.
 * Refreshes session expiry on each valid access (sliding window).
 */
export async function getCurrentUser() {
  const cookieStore = await cookies();
  const sessionId = cookieStore.get(COOKIE_NAME)?.value;
  if (!sessionId) return null;

  const db = getDb();
  const session = db.prepare('SELECT * FROM sessions WHERE id = ?').get(sessionId);
  if (!session) return null;

  if (new Date(session.expires_at) < new Date()) {
    db.prepare('DELETE FROM sessions WHERE id = ?').run(sessionId);
    return null;
  }

  // Refresh session expiry
  const newExpiry = new Date(
    Date.now() + SESSION_DURATION_DAYS * 24 * 60 * 60 * 1000
  ).toISOString();
  db.prepare('UPDATE sessions SET expires_at = ? WHERE id = ?').run(newExpiry, sessionId);

  const user = db.prepare(
    'SELECT id, username, role, created_at FROM users WHERE id = ?'
  ).get(session.user_id);
  return user || null;
}

/**
 * Destroy a session by its ID.
 */
export function destroySession(sessionId) {
  const db = getDb();
  db.prepare('DELETE FROM sessions WHERE id = ?').run(sessionId);
}

export { COOKIE_NAME };
```

## Step 2: Create `src/app/api/auth/login/route.js`

```js
import { NextResponse } from 'next/server';
import { authenticate, createSession, COOKIE_NAME } from '@/lib/auth';

export async function POST(request) {
  const body = await request.json();
  const { username, password } = body;

  if (!username || !password) {
    return NextResponse.json(
      { error: 'Username and password are required.' },
      { status: 400 }
    );
  }

  const user = authenticate(username, password);
  if (!user) {
    return NextResponse.json(
      { error: 'Invalid username or password.' },
      { status: 401 }
    );
  }

  const sessionId = createSession(user.id);

  const response = NextResponse.json({ user });
  response.cookies.set(COOKIE_NAME, sessionId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 7 * 24 * 60 * 60,
  });

  return response;
}
```

## Step 3: Create `src/app/api/auth/logout/route.js`

```js
import { NextResponse } from 'next/server';
import { destroySession, COOKIE_NAME } from '@/lib/auth';
import { cookies } from 'next/headers';

export async function POST() {
  const cookieStore = await cookies();
  const sessionId = cookieStore.get(COOKIE_NAME)?.value;

  if (sessionId) {
    destroySession(sessionId);
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set(COOKIE_NAME, '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  });

  return response;
}
```

## Step 4: Create `src/app/api/auth/me/route.js`

```js
import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ user: null }, { status: 401 });
  }
  return NextResponse.json({ user });
}
```

## Step 5: Create `src/middleware.js`

This file goes in `src/middleware.js` (NOT inside `app/`). Redirects unauthenticated users to `/login`.

**Important**: The middleware only checks if the cookie _exists_. It does NOT validate the session (Edge middleware can't use better-sqlite3). Actual validation happens in `getCurrentUser()` on the server side.

```js
import { NextResponse } from 'next/server';

export function middleware(request) {
  const { pathname } = request.nextUrl;

  const publicPaths = ['/login', '/api/auth/login'];
  if (publicPaths.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon.ico') ||
    pathname.includes('.')
  ) {
    return NextResponse.next();
  }

  const session = request.cookies.get('session');
  if (!session?.value) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
```

## Step 6: Create `src/app/login/page.js`

Client component. Renders login form, redirects to `/` on success.

```js
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: username.toLowerCase(), password }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Login failed.');
        setLoading(false);
        return;
      }

      router.push('/');
      router.refresh();
    } catch {
      setError('Network error. Try again.');
      setLoading(false);
    }
  }

  return (
    <div className="login-container">
      <div className="login-box">
        <h1>scrum</h1>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="username">Username</label>
            <input id="username" type="text" value={username}
              onChange={(e) => setUsername(e.target.value)}
              maxLength={8} autoComplete="username" autoFocus required />
          </div>
          <div className="form-group">
            <label htmlFor="password">Password</label>
            <input id="password" type="password" value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password" required />
          </div>
          {error && <div className="form-error">{error}</div>}
          <button type="submit" disabled={loading} className="btn btn-primary">
            {loading ? 'Logging in...' : 'Log in'}
          </button>
        </form>
      </div>
    </div>
  );
}
```

## Verification

1. Run `node scripts/migrate.mjs` and `node scripts/create-user.mjs --admin` (username: `admin`)
2. `npm run dev` → visit `http://localhost:3000` → should redirect to `/login`
3. Enter wrong credentials → should show error
4. Enter correct credentials → should redirect to `/`
5. Visit `/api/auth/me` → should return user JSON
6. POST to `/api/auth/logout` → should clear session

All pass → Phase 2 complete. Move to Phase 3.
