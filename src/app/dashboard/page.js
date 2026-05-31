import { redirect } from 'next/navigation';
import { requireCurrentUser } from '@/lib/require-user';
import DashboardView from '@/components/DashboardView';

export default async function DashboardPage() {
  const user = await requireCurrentUser();
  if (user.role !== 'admin') redirect('/');
  return <DashboardView />;
}
