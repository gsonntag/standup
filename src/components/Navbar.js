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
            <a href={link.href} className={pathname === link.href ? 'active' : ''}>
              {link.label}
            </a>
          </li>
        ))}
      </ul>
      <div className="navbar-right">
        <span className="navbar-user">{user.username}</span>
        <span className="text-muted">({user.role})</span>
        <button type="button" onClick={handleLogout} className="btn btn-sm">logout</button>
      </div>
    </nav>
  );
}
