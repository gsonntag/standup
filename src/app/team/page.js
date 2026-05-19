import { requireCurrentUser } from '@/lib/require-user';
import TeamView from '@/components/TeamView';

export default async function TeamPage() {
  const user = await requireCurrentUser();
  return <TeamView currentUser={user} />;
}
