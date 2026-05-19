import { getCurrentUser } from '@/lib/auth';
import { redirect } from 'next/navigation';
import MyTasksView from './MyTasksView';

export default async function MyTasksPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  return <MyTasksView currentUser={user} />;
}
