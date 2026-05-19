# Phase 5: Layout & Navbar

## Goal

Create the root layout with a top navigation bar. After this phase, every page renders inside a consistent layout with navigation links and the logged-in user's name.

---

## Step 1: Create `src/components/Navbar.js`

This is a **client component** because it needs to:
- Highlight the active page link
- Handle logout button click

```js
'use client';

import { usePathname, useRouter } from 'next/navigation';

const NAV_LINKS = [
  { href: '/', label: 'Board' },
  { href: '/backlog', label: 'Backlog' },
  { href: '/sprints', label: 'Sprints' },
  { href: '/team', label: 'Team' },
];

export default function Navbar({ user }) {
  const pathname = usePathname();
  const router = useRouter();

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
    router.refresh();
  }

  return (
    <nav className="navbar">
      <a href="/" className="navbar-brand">scrum</a>
      <ul className="navbar-links">
        {NAV_LINKS.map((link) => (
          <li key={link.href}>
            <a
              href={link.href}
              className={pathname === link.href ? 'active' : ''}
            >
              {link.label}
            </a>
          </li>
        ))}
      </ul>
      <div className="navbar-right">
        <span className="navbar-user">{user.username}</span>
        <span className="text-muted">({user.role})</span>
        <button onClick={handleLogout} className="btn btn-sm">
          logout
        </button>
      </div>
    </nav>
  );
}
```

## Step 2: Update `src/app/layout.js`

The root layout is a **server component**. It calls `getCurrentUser()` to get the logged-in user and passes it to the Navbar. If no user (e.g., on the login page), it renders children without the navbar.

```js
import './globals.css';
import { getCurrentUser } from '@/lib/auth';
import Navbar from '@/components/Navbar';

export const metadata = {
  title: 'scrum',
  description: 'Sprint planning tool',
};

export default async function RootLayout({ children }) {
  const user = await getCurrentUser();

  return (
    <html lang="en">
      <body>
        {user && <Navbar user={user} />}
        {children}
      </body>
    </html>
  );
}
```

**Important**: The `getCurrentUser()` call here will return `null` on the login page (no session cookie). That's fine — it means the navbar won't render on the login page, which is the desired behavior.

## Step 3: Create placeholder pages

Create minimal placeholder pages for each route so you can test navigation. Each page is a server component that just shows the page name.

### `src/app/page.js` (Board)
```js
export default function BoardPage() {
  return (
    <div className="page">
      <div className="page-header">
        <h1>Board</h1>
      </div>
      <p className="text-muted">Board will be implemented in Phase 6.</p>
    </div>
  );
}
```

### `src/app/backlog/page.js`
```js
export default function BacklogPage() {
  return (
    <div className="page">
      <div className="page-header">
        <h1>Backlog</h1>
      </div>
      <p className="text-muted">Backlog will be implemented in Phase 7.</p>
    </div>
  );
}
```

### `src/app/sprints/page.js`
```js
export default function SprintsPage() {
  return (
    <div className="page">
      <div className="page-header">
        <h1>Sprints</h1>
      </div>
      <p className="text-muted">Sprints will be implemented in Phase 9.</p>
    </div>
  );
}
```

### `src/app/team/page.js`
```js
export default function TeamPage() {
  return (
    <div className="page">
      <div className="page-header">
        <h1>Team</h1>
      </div>
      <p className="text-muted">Team will be implemented in Phase 10.</p>
    </div>
  );
}
```

## Verification

1. `npm run dev` → log in
2. Navbar appears at the top with: `scrum  Board  Backlog  Sprints  Team  admin (admin)  [logout]`
3. Click each link → page changes, active link gets underlined
4. Click logout → redirected to login page, navbar disappears
5. Navbar is 36px tall, dense, no rounded corners, system font

Phase 5 complete. Move to Phase 6.
