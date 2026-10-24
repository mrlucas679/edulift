import { router } from 'expo-router';
import { Share } from 'react-native';
import { useState } from 'react';

import { useMe } from '../src/account';
import { deleteAccount, exportData } from '../src/data-rights';
import { usePlan } from '../src/plan';
import { useSession } from '../src/session';
import { useApplications, useSaved } from '../src/tracking';
import { Body, Button, ErrorNote, Heading, Screen, Title } from '../src/ui';

export default function MyData() {
  const { accessToken, signOut, status } = useSession();
  const me = useMe();
  const plan = usePlan(accessToken);
  const saved = useSaved(accessToken);
  const applications = useApplications(accessToken);
  const [busy, setBusy] = useState<'download' | 'delete' | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [confirming, setConfirming] = useState(false);

  async function download() {
    setBusy('download');
    setError(null);
    try {
      const data = await exportData(accessToken);
      await Share.share({ message: JSON.stringify(data, null, 2), title: 'My EduLift data' });
    } catch (e) {
      setError(e);
    } finally {
      setBusy(null);
    }
  }

  async function remove() {
    setBusy('delete');
    setError(null);
    try {
      await deleteAccount(accessToken);
      await signOut();
      router.replace('/');
    } catch (e) {
      setError(e);
    } finally {
      setBusy(null);
    }
  }

  if (status !== 'signed-in') {
    return (
      <Screen>
        <Heading>My data</Heading>
        <Body>Sign in to see, download or delete what we hold about you.</Body>
        <Button label="Sign in" onPress={() => router.push('/sign-in')} />
      </Screen>
    );
  }

  return (
    <Screen>
      <Heading>My data</Heading>
      <Body muted>See, download or delete everything we hold about you. This is your right under South Africa’s privacy law (POPIA).</Body>

      <Title>What we hold</Title>
      <Body>Email, first name, date of birth and province</Body>
      <Body>Profile: {me.data?.birth_date ? 'saved' : 'not yet'}</Body>
      <Body>Marks and plan: {plan.data ? `${plan.data.targets.length} programme${plan.data.targets.length === 1 ? '' : 's'} on your plan` : '…'}</Body>
      <Body>Saved: {saved.data ? `${saved.data.length} items` : '…'}</Body>
      <Body>Applications: {applications.data ? `${applications.data.length} tracked` : '…'}</Body>

      <Title>Download my data</Title>
      <Body muted>A file you can open on your phone or computer.</Body>
      <Button label="Download my data" busy={busy === 'download'} onPress={download} />

      <Title>Delete my account</Title>
      <Body muted>This removes your account and everything above. It can’t be undone.</Body>
      {!confirming ? (
        <Button label="Delete my account" onPress={() => setConfirming(true)} />
      ) : (
        <>
          <Button label="Yes, delete everything" busy={busy === 'delete'} onPress={remove} />
          <Button label="Keep my account" onPress={() => setConfirming(false)} />
        </>
      )}
      <ErrorNote error={error} />
      <Body muted>Questions or complaints: see the privacy notice. You can also contact the Information Regulator.</Body>
    </Screen>
  );
}
