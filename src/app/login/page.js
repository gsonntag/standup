'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRightIcon, LockKeyIcon, MoonIcon, SunIcon, UserIcon } from '@phosphor-icons/react';

export default function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [theme, setTheme] = useState('light');
  const router = useRouter();

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

      router.push(data.user?.must_change_password ? '/team' : '/');
      router.refresh();
    } catch {
      setError('Network error. Try again.');
      setLoading(false);
    }
  }

  return (
    <div className="login-container">
      <button type="button" className="login-theme-toggle" onClick={toggleTheme}>
        {theme === 'dark' ? <SunIcon weight="bold" /> : <MoonIcon weight="bold" />}
        {theme === 'dark' ? 'Light mode' : 'Dark mode'}
      </button>
      <div className="login-shell">
        <div className="login-brand-panel">
          <span className="login-logo">
            <img src="/la-hacks-logo.png" alt="" />
          </span>
          <div>
            <span className="login-eyebrow">LA Hacks Engineering</span>
            <h1>Standup</h1>
            <p>Plan sprint work, track ownership, and keep reviews moving without leaving the board.</p>
          </div>
        </div>
        <div className="login-box">
          <div className="login-form-heading">
            <span>Workspace access</span>
            <h2>Log in</h2>
          </div>
          <form onSubmit={handleSubmit}>
            <div className="form-group login-field">
              <label htmlFor="username"><UserIcon weight="bold" />Username</label>
              <input id="username" type="text" value={username} onChange={(e) => setUsername(e.target.value)} maxLength={8} autoComplete="username" autoFocus required />
            </div>
            <div className="form-group login-field">
              <label htmlFor="password"><LockKeyIcon weight="bold" />Password</label>
              <input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" required />
            </div>
            {error && <div className="form-error">{error}</div>}
            <button type="submit" disabled={loading} className="btn btn-primary login-submit">
              {loading ? 'Logging in...' : 'Log in'}
              <ArrowRightIcon weight="bold" />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
