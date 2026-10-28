'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useColorMode } from '@/components/AppTheme';
import { VStack } from '@astryxdesign/core/Layout';
import { Center } from '@astryxdesign/core/Center';
import { Text, Heading } from '@astryxdesign/core/Text';
import { TextInput } from '@astryxdesign/core/TextInput';
import { Button } from '@astryxdesign/core/Button';
import { Card } from '@astryxdesign/core/Card';

const pageStyle = {
  minHeight: '100vh',
  width: '100%',
  backgroundColor: 'var(--color-background-body)',
};

const contentStyle = {
  width: '100%',
  maxWidth: 400,
};

export default function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loginFailed, setLoginFailed] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { mode, toggleMode } = useColorMode();
  const isDark = mode === 'dark';
  const router = useRouter();

  async function handleLogin(e) {
    e?.preventDefault?.();
    if (isLoading) return;

    const identifier = username.trim();
    if (!identifier || !password) {
      setErrorMessage('Please enter your username and password.');
      setLoginFailed(true);
      return;
    }

    setIsLoading(true);
    setLoginFailed(false);
    setErrorMessage('');

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: identifier.toLowerCase(), password }),
      });
      const data = await res.json();

      if (!res.ok) {
        setErrorMessage(data.error || 'Incorrect username or password. Please try again.');
        setLoginFailed(true);
        setIsLoading(false);
        return;
      }

      const next = new URLSearchParams(window.location.search).get('next');
      const safeNext = next && next.startsWith('/') && !next.startsWith('//') ? next : '/';
      const targetUrl = data.user?.must_change_password ? '/team' : safeNext;
      window.location.href = targetUrl;
    } catch {
      setErrorMessage('Network error. Please try again.');
      setLoginFailed(true);
      setIsLoading(false);
    }
  }

  return (
    <Center axis="both" padding={6} style={pageStyle}>
      <VStack gap={4} hAlign="center" style={contentStyle}>
        {/* LA Hacks Brand Header */}
        <VStack gap={2} hAlign="center">
          <img
            src="/la-hacks-logo.png"
            alt="LA Hacks"
            width={52}
            height={52}
            style={{ borderRadius: 'var(--radius-element)' }}
          />
          <Text type="body" weight="bold" size="lg">
            Standup
          </Text>
        </VStack>

        {/* Login Card */}
        <Card padding={8} width="100%">
          <form onSubmit={handleLogin} style={{ width: '100%', margin: 0, padding: 0 }}>
            <VStack gap={4} hAlign="stretch">
              {/* Header */}
              <VStack gap={1} hAlign="center">
                <Heading level={2}>Welcome back</Heading>
                <Text type="body" color="secondary" size="sm">
                  Sign in to your account
                </Text>
              </VStack>

              {/* Form fields */}
              <VStack gap={3}>
                <TextInput
                  label="Username"
                  placeholder="Enter your username"
                  value={username}
                  onChange={(v) => {
                    setUsername(typeof v === 'string' ? v : v?.target?.value ?? '');
                    setLoginFailed(false);
                  }}
                  onEnter={handleLogin}
                  hasAutoFocus
                  size="lg"
                />
                <TextInput
                  label="Password"
                  placeholder="Enter your password"
                  type="password"
                  value={password}
                  onChange={(v) => {
                    setPassword(typeof v === 'string' ? v : v?.target?.value ?? '');
                    setLoginFailed(false);
                  }}
                  onEnter={handleLogin}
                  size="lg"
                  status={
                    loginFailed
                      ? {
                          type: 'error',
                          message: errorMessage || 'Incorrect username or password. Please try again.',
                        }
                      : undefined
                  }
                />
              </VStack>

              {/* Submit button */}
              <Button
                type="submit"
                label={isLoading ? 'Logging in…' : 'Log in'}
                variant="primary"
                size="lg"
                width="100%"
                isLoading={isLoading}
                onClick={handleLogin}
              />

              {/* Theme Toggle Button */}
              <VStack hAlign="center">
                <Button
                  variant="ghost"
                  size="sm"
                  label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
                  onClick={toggleMode}
                />
              </VStack>
            </VStack>
          </form>
        </Card>
      </VStack>
    </Center>
  );
}
