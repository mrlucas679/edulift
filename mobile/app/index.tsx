import { Redirect } from 'expo-router';

import { useSession } from '../src/session';
import { Loading } from '../src/ui';

export default function Index() {
  const { status } = useSession();
  if (status === 'restoring') return <Loading />;
  return <Redirect href={status === 'signed-in' ? '/home' : '/sign-in'} />;
}
