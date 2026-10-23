import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Share } from 'react-native';

import { useMe } from '../../src/account';
import { ApiError, meResponse, request } from '../../src/api';
import { deleteAccount, exportData } from '../../src/data-rights';
import { useSession } from '../../src/session';
import { Body, Button, ErrorNote, Heading, Loading, Screen, Title } from '../../src/ui';

export default function Profile() {
  const { status, accessToken, signOut } = useSession();
  const details = useMe();
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

  const [busy, setBusy] = useState<'export' | 'delete' | null>(null);
  const [actionError, setActionError] = useState<unknown>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  async function download() {
    setBusy('export');
    setActionError(null);
    try {
      const data = await exportData(accessToken);
      await Share.share({ message: JSON.stringify(data, null, 2), title: 'My EduLift data' });
    } catch (e) {
      setActionError(e);
    } finally {
      setBusy(null);
    }
  }

  async function remove() {
    setBusy('delete');
    setActionError(null);
    try {
      await deleteAccount(accessToken);
      await signOut();
    } catch (e) {
      setActionError(e);
    } finally {
      setBusy(null);
    }
  }

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
      {details.data && details.data.status !== 'active' && (
        <Button label="Finish setting up" onPress={() => router.push('/onboarding')} />
      )}
      {details.data?.status === 'active' && (
        <Button label="My choices" onPress={() => router.push('/onboarding')} />
      )}
      {me.isError && !rejected && <ErrorNote error={me.error} />}
      <Title>Your data</Title>
      <Button label="Download my data" busy={busy === 'export'} onPress={download} />
      {!confirmDelete ? (
        <Button label="Delete my account" onPress={() => setConfirmDelete(true)} />
      ) : (
        <>
          <Body>This deletes your marks, choices, saved items and applications. It can’t be undone.</Body>
          <Button label="Yes, delete everything" busy={busy === 'delete'} onPress={remove} />
          <Button label="Keep my account" onPress={() => setConfirmDelete(false)} />
        </>
      )}
      <ErrorNote error={actionError} />

      <Title>About EduLift</Title>
      <Button label="Privacy notice" onPress={() => router.push('/privacy')} />
      <Button label="Help" onPress={() => router.push('/help')} />
      <Button label="Sign out" onPress={signOut} />
    </Screen>
  );
}
