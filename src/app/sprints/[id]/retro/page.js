import { getCurrentUser } from '@/lib/auth';
import { redirect } from 'next/navigation';
import RetroBoard from './RetroBoard';

export default async function RetroPage({ params }) {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  const { id } = await params;
  return <RetroBoard sprintId={id} currentUser={user} />;
}
