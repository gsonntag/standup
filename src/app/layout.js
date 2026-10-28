import './globals.css';
import { getCurrentUser } from '@/lib/auth';
import AppShellLayout from '@/components/AppShellLayout';
import PasswordGuard from '@/components/PasswordGuard';
import AppTheme from '@/components/AppTheme';

export const metadata = {
  title: 'Standup',
  description: 'Sprint planning tool',
  icons: {
    icon: '/la-hacks-logo.png',
  },
};

export default async function RootLayout({ children }) {
  const user = await getCurrentUser();

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  var saved = localStorage.getItem('standup-theme');
                  var isDark = saved === 'dark' || (!saved && window.matchMedia('(prefers-color-scheme: dark)').matches);
                  var theme = isDark ? 'dark' : 'light';
                  document.documentElement.setAttribute('data-theme', theme);
                  document.documentElement.setAttribute('data-astryx-theme', 'neutral');
                  document.documentElement.classList.toggle('dark', isDark);
                } catch (_) {}
              })();
            `,
          }}
        />
      </head>
      <body>
        <AppTheme>
          <AppShellLayout user={user}>
            {user && <PasswordGuard mustChange={!!user.must_change_password} />}
            {children}
          </AppShellLayout>
        </AppTheme>
      </body>
    </html>
  );
}
