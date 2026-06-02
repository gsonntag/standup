import './globals.css';
import { getCurrentUser } from '@/lib/auth';
import Navbar from '@/components/Navbar';
import PasswordGuard from '@/components/PasswordGuard';
import { TooltipProvider } from '@/components/ui/tooltip';

export const metadata = {
  title: 'Standup',
  description: 'Sprint planning tool',
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
                  localStorage.setItem('standup-theme', 'light');
                  document.documentElement.dataset.theme = 'light';
                  document.documentElement.classList.remove('dark');
                } catch (_) {
                  document.documentElement.dataset.theme = 'light';
                  document.documentElement.classList.remove('dark');
                }
              })();
            `,
          }}
        />
      </head>
      <body>
        <TooltipProvider>
          {user && <Navbar user={user} />}
          {user && <PasswordGuard mustChange={!!user.must_change_password} />}
          {children}
        </TooltipProvider>
      </body>
    </html>
  );
}
