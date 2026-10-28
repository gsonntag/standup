'use client';

import { usePathname } from 'next/navigation';
import { AppShell } from '@astryxdesign/core/AppShell';
import {
  SideNav,
  SideNavHeading,
  SideNavItem,
  SideNavSection,
} from '@astryxdesign/core/SideNav';
import { useColorMode } from '@/components/AppTheme';
import {
  KanbanIcon,
  TicketIcon,
  RowsIcon,
  ListChecksIcon,
  UsersIcon,
  SignOutIcon,
  MoonIcon,
  SunIcon,
  ChartBarIcon,
} from '@phosphor-icons/react';

export default function AppShellLayout({ user, children }) {
  const pathname = usePathname();
  const { mode, toggleMode } = useColorMode();
  const isDark = mode === 'dark';

  if (!user || pathname === '/login') {
    return children;
  }

  async function handleLogout() {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      window.location.href = '/login';
    } catch (_) {
      window.location.href = '/login';
    }
  }

  return (
    <AppShell
      height="fill"
      variant="elevated"
      contentPadding={0}
      sideNav={
        <SideNav
          collapsible
          resizable={{ defaultWidth: 240, minWidth: 200, maxWidth: 360 }}
          header={
            <SideNavHeading
              heading="Standup"
              subheading="LA Hacks"
              icon={
                <img
                  src="/la-hacks-logo.png"
                  alt="LA Hacks"
                  width={28}
                  height={28}
                  style={{ borderRadius: 'var(--radius-element)' }}
                />
              }
              headingHref="/"
            />
          }
          footer={
            <SideNavSection title="Account" isHeaderHidden>
              <SideNavItem
                label={isDark ? 'Light mode' : 'Dark mode'}
                icon={isDark ? SunIcon : MoonIcon}
                onClick={toggleMode}
              />
              <SideNavItem
                label={user.username || 'User'}
                icon={UsersIcon}
                href="/team"
                isSelected={pathname === '/team'}
              />
              <SideNavItem
                label="Sign out"
                icon={SignOutIcon}
                onClick={handleLogout}
              />
            </SideNavSection>
          }
        >
          <SideNavSection title="Workspace">
            <SideNavItem
              label="Overview"
              icon={KanbanIcon}
              href="/"
              isSelected={pathname === '/'}
            />
            <SideNavItem
              label="Tickets"
              icon={TicketIcon}
              href="/tickets"
              isSelected={pathname === '/tickets'}
            />
            <SideNavItem
              label="Sprints"
              icon={RowsIcon}
              href="/sprints"
              isSelected={pathname === '/sprints'}
            />
            <SideNavItem
              label="Dashboard"
              icon={ChartBarIcon}
              href="/dashboard"
              isSelected={pathname === '/dashboard'}
            />
            <SideNavItem
              label="My Tasks"
              icon={ListChecksIcon}
              href="/my-tasks"
              isSelected={pathname === '/my-tasks'}
            />
            <SideNavItem
              label="Team"
              icon={UsersIcon}
              href="/team"
              isSelected={pathname === '/team'}
            />
          </SideNavSection>
        </SideNav>
      }
    >
      {children}
    </AppShell>
  );
}
