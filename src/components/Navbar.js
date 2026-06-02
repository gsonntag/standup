'use client';

import { useEffect, useRef, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { apiFetch } from '@/lib/client-api';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import {
  ChartBarIcon,
  CaretUpDownIcon,
  KanbanIcon,
  ListChecksIcon,
  MagnifyingGlassIcon,
  MoonIcon,
  RowsIcon,
  SidebarSimpleIcon,
  SignOutIcon,
  SunIcon,
  TicketIcon,
  UsersIcon,
} from '@phosphor-icons/react';

const NAV_LINKS = [
  { href: '/', label: 'Overview', icon: KanbanIcon },
  { href: '/tickets', label: 'Tickets', icon: TicketIcon },
  { href: '/sprints', label: 'Sprints', icon: RowsIcon },
  { href: '/my-tasks', label: 'My Tasks', icon: ListChecksIcon },
];

export default function Navbar({ user }) {
  const pathname = usePathname();
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [unreadCount, setUnreadCount] = useState(0);
  const [collapsed, setCollapsed] = useState(false);
  const [theme, setTheme] = useState('light');
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

  useEffect(() => {
    const saved = window.localStorage.getItem('standup-sidebar-collapsed') === 'true';
    setCollapsed(saved);
  }, []);

  useEffect(() => {
    const savedTheme = window.localStorage.getItem('standup-theme');
    const nextTheme = savedTheme === 'dark' ? 'dark' : 'light';
    setTheme(nextTheme);
    document.documentElement.dataset.theme = nextTheme;
    document.documentElement.classList.toggle('dark', nextTheme === 'dark');
  }, []);

  function toggleTheme() {
    setTheme((current) => {
      const nextTheme = current === 'dark' ? 'light' : 'dark';
      window.localStorage.setItem('standup-theme', nextTheme);
      document.documentElement.dataset.theme = nextTheme;
      document.documentElement.classList.toggle('dark', nextTheme === 'dark');
      return nextTheme;
    });
  }

  useEffect(() => {
    document.body.classList.toggle('sidebar-collapsed', collapsed);
    window.localStorage.setItem('standup-sidebar-collapsed', String(collapsed));
    return () => document.body.classList.remove('sidebar-collapsed');
  }, [collapsed]);

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
    router.push(`/tickets?ticket=${result.id}`);
  }

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
    router.refresh();
  }

  if (pathname === '/login') return null;

  return (
    <nav className="navbar app-sidebar" data-collapsed={collapsed}>
      <div className="sidebar-top">
        <a href="/" className="navbar-brand">
          <span className="sidebar-logo">
            <img src="/la-hacks-logo.png" alt="" />
          </span>
          <span className="sidebar-label">Standup</span>
        </a>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          className="sidebar-collapse-button"
          onClick={() => setCollapsed((value) => !value)}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          <SidebarSimpleIcon weight="bold" />
        </Button>
      </div>

      <div className="sidebar-search" ref={containerRef}>
        <MagnifyingGlassIcon weight="bold" />
        <Input
          ref={searchInputRef}
          type="text"
          className="navbar-search"
          placeholder="Search..."
          value={query}
          onChange={handleSearchChange}
          onKeyDown={handleSearchKeyDown}
          onFocus={() => { if (results.length) setShowDropdown(true); }}
        />
        {showDropdown && results.length > 0 && (
          <div className="search-dropdown">
            {results.map((result, i) => (
              <button
                type="button"
                key={result.id}
                className={`search-result${i === selectedIndex ? ' selected' : ''}`}
                onClick={() => openResult(result)}
              >
                <span className="text-mono text-muted">#{result.number}</span>
                <span>{result.title}</span>
                {result.sprint_name && <span className="text-muted">- {result.sprint_name}</span>}
                <span className="label-list">
                  {result.labels?.map((l) => (
                    <span key={l.id} className="label" style={{ backgroundColor: l.color }}>{l.name}</span>
                  ))}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      <ul className="navbar-links">
        {NAV_LINKS.map((link) => (
          <li key={link.href}>
            <a href={link.href} className={pathname === link.href ? 'active' : ''} title={link.label}>
              <link.icon weight="bold" />
              <span className="sidebar-label">{link.label}</span>
              {link.href === '/my-tasks' && unreadCount > 0 && (
                <Badge variant="secondary" className="sidebar-nav-badge ml-1 h-5 px-1.5 text-[10px]">{unreadCount}</Badge>
              )}
            </a>
          </li>
        ))}
      </ul>
      <div className="sidebar-secondary">
        <a href="/dashboard" className={pathname === '/dashboard' ? 'active' : ''} title="Dashboard">
          <ChartBarIcon weight="bold" />
          <span className="sidebar-label">Dashboard</span>
        </a>
        <a href="/team" className={pathname === '/team' ? 'active' : ''} title="Team">
          <UsersIcon weight="bold" />
          <span className="sidebar-label">Team</span>
        </a>
        <Button
          type="button"
          variant="ghost"
          className="sidebar-theme-toggle"
          onClick={toggleTheme}
          title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
        >
          <span className="theme-toggle-icon">
            {theme === 'dark' ? <SunIcon weight="bold" /> : <MoonIcon weight="bold" />}
          </span>
          <span className="sidebar-label">{theme === 'dark' ? 'Light mode' : 'Dark mode'}</span>
        </Button>
      </div>
      <div className="navbar-right">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button type="button" variant="ghost" className="navbar-user-menu" title={`${user.username} account menu`}>
              <span className="avatar-dot">{user.username.slice(0, 2)}</span>
              <span className="sidebar-label navbar-user-copy">
                <span className="navbar-user-name">{user.username}</span>
                <span className="navbar-user-role">{user.role}</span>
              </span>
              <CaretUpDownIcon className="navbar-user-chevron sidebar-label" weight="bold" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" side="right" sideOffset={10} className="navbar-account-menu">
            <DropdownMenuLabel className="navbar-account-label">
              <span className="avatar-dot">{user.username.slice(0, 2)}</span>
              <span>
                <span className="navbar-user-name">{user.username}</span>
                <span className="navbar-user-role">{user.role}</span>
              </span>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="navbar-account-item" onClick={handleLogout}><SignOutIcon weight="bold" />Log out</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </nav>
  );
}
