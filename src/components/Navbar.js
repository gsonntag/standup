'use client';

import { useEffect, useRef, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { apiFetch } from '@/lib/client-api';

const NAV_LINKS = [
  { href: '/', label: 'Board' },
  { href: '/backlog', label: 'Backlog' },
  { href: '/sprints', label: 'Sprints' },
  { href: '/my-tasks', label: 'My Tasks' },
];

export default function Navbar({ user }) {
  const pathname = usePathname();
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [unreadCount, setUnreadCount] = useState(0);
  const debounceRef = useRef(null);
  const containerRef = useRef(null);
  const searchInputRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    function handleKeyDown(e) {
      if (e.key === '/' && document.activeElement.tagName !== 'INPUT' && document.activeElement.tagName !== 'TEXTAREA' && document.activeElement.tagName !== 'SELECT') {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => {
    apiFetch('/api/me/mentions').then((r) => r.json()).then((d) => setUnreadCount(d.unread_count || 0));
  }, []);

  function handleSearchChange(e) {
    const val = e.target.value;
    setQuery(val);
    setSelectedIndex(-1);
    clearTimeout(debounceRef.current);
    if (!val.trim()) { setResults([]); setShowDropdown(false); return; }
    debounceRef.current = setTimeout(async () => {
      const res = await apiFetch(`/api/search?q=${encodeURIComponent(val)}`);
      const data = await res.json();
      setResults(data.results || []);
      setShowDropdown(true);
    }, 150);
  }

  function handleSearchKeyDown(e) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((i) => Math.max(i - 1, -1));
    } else if (e.key === 'Enter') {
      const result = results[selectedIndex] || results[0];
      if (result) { openResult(result); }
    } else if (e.key === 'Escape') {
      setQuery(''); setResults([]); setShowDropdown(false);
      searchInputRef.current?.blur();
    }
  }

  function openResult(result) {
    setQuery(''); setResults([]); setShowDropdown(false);
    router.push(`/backlog?ticket=${result.id}`);
  }

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
    router.refresh();
  }

  return (
    <nav className="navbar">
      <a href="/" className="navbar-brand">Standup</a>
      <ul className="navbar-links">
        {NAV_LINKS.map((link) => (
          <li key={link.href}>
            <a href={link.href} className={pathname === link.href ? 'active' : ''}>
              {link.label}
              {link.href === '/my-tasks' && unreadCount > 0 && ` (${unreadCount})`}
            </a>
          </li>
        ))}
      </ul>
      <div style={{ position: 'relative' }} ref={containerRef}>
        <input
          ref={searchInputRef}
          type="text"
          className="navbar-search"
          placeholder="Search… (/)"
          value={query}
          onChange={handleSearchChange}
          onKeyDown={handleSearchKeyDown}
          onFocus={() => { if (results.length) setShowDropdown(true); }}
        />
        {showDropdown && results.length > 0 && (
          <div className="search-dropdown">
            {results.map((result, i) => (
              <div
                key={result.id}
                className={`search-result${i === selectedIndex ? ' selected' : ''}`}
                onClick={() => openResult(result)}
              >
                <span className="text-mono text-muted">#{result.number}</span>
                {' '}{result.title}
                {result.sprint_name && <span className="text-muted"> — {result.sprint_name}</span>}
                <span className="label-list" style={{ marginLeft: 'auto' }}>
                  {result.labels?.map((l) => (
                    <span key={l.id} className="label" style={{ backgroundColor: l.color }}>{l.name}</span>
                  ))}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
      <div className="navbar-right">
        <a href="/team" className={`text-muted${pathname === '/team' ? ' active' : ''}`} style={{ fontSize: '0.875rem' }}>Team</a>
        <a href="/change-password" className={`text-muted${pathname === '/change-password' ? ' active' : ''}`} style={{ fontSize: '0.875rem' }}>Password</a>
        <span className="navbar-user">{user.username}</span>
        <span className="text-muted">({user.role})</span>
        <button type="button" onClick={handleLogout} className="btn btn-sm">logout</button>
      </div>
    </nav>
  );
}
