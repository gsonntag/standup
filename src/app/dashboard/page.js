import DashboardView from '@/components/DashboardView';
import { requireCurrentUser } from '@/lib/require-user';

export default async function DashboardPage() {
  await requireCurrentUser();
  return <DashboardView />;
}
