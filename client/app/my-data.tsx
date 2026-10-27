import { router } from 'expo-router';
import { useState } from 'react';

import { useMe } from '../src/account';
import { deleteAccount, exportData } from '../src/data-rights';
import { saveJson } from '../src/download';
import { usePlan } from '../src/plan';
import { useSession } from '../src/session';
import { useApplications, useSaved } from '../src/tracking';
import { useSavedMarks } from '../src/saved-marks';
import { Body, Button, Card, ErrorNote, Row, Screen, Title } from '../src/ui';


export default function MyData() {
  const { accessToken, signOut, status } = useSession();
  const me = useMe();
  const plan = usePlan(accessToken);
  const saved = useSaved(accessToken);
  const applications = useApplications(accessToken);
  const savedMarks = useSavedMarks();
  const sets = Object.keys(savedMarks.data ?? {}).length;
  const [busy, setBusy] = useState<'download' | 'delete' | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [confirming, setConfirming] = useState(false);

  async function download() {
    setBusy('download');
    setError(null);
    try {
      const data = await exportData(accessToken);
      await saveJson('My EduLift data', data);
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
      <Screen title="My data" footer={<Button label="Sign in" onPress={() => router.push('/sign-in')} />}>
        <Body>Sign in to see, download or delete what we hold about you.</Body>
      </Screen>
    );
  }

  return (
    <Screen title="My data">
      <Body muted>See, download or delete everything we hold about you. This is your right under South Africa’s privacy law (POPIA).</Body>

      <Card>
        <Title>What we hold</Title>
        <Row label="Account" value="email, first name" />
        <Row label="Profile" value={me.data?.birth_date ? 'date of birth, province' : 'not yet'} />
        <Row label="Marks" value={`${sets} result set${sets === 1 ? '' : 's'}`} />
        <Row label="Plan" value={plan.data ? `${plan.data.targets.length} courses` : '…'} />
        <Row label="Saved" value={saved.data ? `${saved.data.length} items` : '…'} />
        <Row label="Applications" value={applications.data ? `${applications.data.length} tracked` : '…'} />
        <Row label="Choices" value="settings, with dates" />
        <Button label="Download my data" variant="secondary" busy={busy === 'download'} onPress={download} />
        <Body muted>A file you can open on your phone or computer.</Body>
      </Card>

      <Card>
        <Title>Delete my account</Title>
        <Body muted>This removes your account and everything above. It can’t be undone. You can still use the app as a guest.</Body>
        {!confirming ? (
          <Button label="Delete my account" variant="dashed" onPress={() => setConfirming(true)} />
        ) : (
          <>
            <Button label="Yes, delete everything" busy={busy === 'delete'} onPress={remove} />
            <Button label="Keep my account" variant="secondary" onPress={() => setConfirming(false)} />
          </>
        )}
      </Card>
      <ErrorNote error={error} />
      <Body muted small>Questions or complaints: see the privacy notice. You can also contact the Information Regulator.</Body>
    </Screen>
  );
}
