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
