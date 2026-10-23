import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useEffect } from 'react';

import { ApiError, meResponse, request } from '../../src/api';
import { useSession } from '../../src/session';
import { Body, Button, ErrorNote, Heading, Loading, Screen } from '../../src/ui';

export default function Profile() {
  const { status, accessToken, signOut } = useSession();
  const me = useQuery({
    queryKey: ['me', accessToken],
    queryFn: () => request('/v1/me', meResponse, { accessToken }),
    enabled: status === 'signed-in',
  });

  // Token rejected: sign out.
  const rejected = me.error instanceof ApiError && me.error.status === 401;
  useEffect(() => {
    if (rejected) void signOut();
  }, [rejected, signOut]);

  if (status === 'restoring') return <Loading />;

  if (status !== 'signed-in') {
    return (
      <Screen>
        <Heading>Profile</Heading>
        <Body muted>Sign in to save your marks, check where you qualify and track applications.</Body>
        <Button label="Sign in" onPress={() => router.push('/sign-in')} />
      </Screen>
    );
  }

  return (
    <Screen>
      <Heading>Profile</Heading>
      {me.isPending && <Loading />}
      {me.data && <Body muted>Account {me.data.id}</Body>}
      {me.isError && !rejected && <ErrorNote error={me.error} />}
      <Button label="Sign out" onPress={signOut} />
    </Screen>
  );
}
