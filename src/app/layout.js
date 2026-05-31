import './globals.css';
import { getCurrentUser } from '@/lib/auth';
import Navbar from '@/components/Navbar';
import PasswordGuard from '@/components/PasswordGuard';

export const metadata = {
  title: 'Standup',
  description: 'Sprint planning tool',
};

export default async function RootLayout({ children }) {
  const user = await getCurrentUser();

  return (
    <html lang="en">
      <body>
        {user && <Navbar user={user} />}
        {user && <PasswordGuard mustChange={!!user.must_change_password} />}
        {children}
      </body>
    </html>
  );
}
