import { useQuery } from '@tanstack/react-query';
import { Redirect } from 'expo-router';
import { useEffect } from 'react';

import { ApiError, meResponse, request } from '../src/api';
import { useSession } from '../src/session';
import { Body, Button, ErrorNote, Heading, Loading, Screen } from '../src/ui';

export default function Home() {
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

  if (status !== 'signed-in') return <Redirect href="/sign-in" />;
  if (me.isPending) return <Loading />;

  return (
    <Screen>
      <Heading>You’re signed in</Heading>
      {me.data ? <Body muted>Account {me.data.id}</Body> : <ErrorNote error={me.error} />}
      {me.isError && !rejected ? <Button label="Try again" onPress={() => me.refetch()} /> : null}
      <Button label="Sign out" onPress={signOut} />
    </Screen>
  );
}
