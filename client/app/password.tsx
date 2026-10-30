import { useState } from 'react';

import { PASSWORD_RULE, passwordProblem } from '../src/credentials';
import { RecoveryCodes } from '../src/recovery-codes';
import { useSession } from '../src/session';
import { Body, Button, ErrorNote, Field, Heading, Screen, Section } from '../src/ui';

export default function Password() {
  const { changePassword, newRecoveryCodes } = useSession();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [codes, setCodes] = useState<string[] | null>(null);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [busy, setBusy] = useState<'password' | 'codes' | null>(null);

  async function run(which: 'password' | 'codes', action: () => Promise<void>) {
    setBusy(which);
    setError(null);
    setDone(false);
    try {
      await action();
    } catch (e) {
      setError(e);
    } finally {
      setBusy(null);
    }
  }

  if (codes) {
    return (
      <Screen title="New recovery codes">
        <RecoveryCodes codes={codes} doneLabel="Done" onDone={() => setCodes(null)} />
      </Screen>
    );
  }

  const problem = passwordProblem(next, '');
  return (
    <Screen title="Password and recovery codes">
      <Heading>Keep your account yours</Heading>
      <Field label="Current password" value={current} onChangeText={setCurrent} secureTextEntry autoCapitalize="none" autoComplete="current-password" maxLength={128} />

      <Section>Change your password</Section>
      <Field label="New password" value={next} onChangeText={setNext} secureTextEntry autoCapitalize="none" autoComplete="new-password" maxLength={128} />
      <Body muted small>{PASSWORD_RULE} Changing it signs you out on every other phone or computer.</Body>
      <Button
        label="Change my password"
        busy={busy === 'password'}
        disabled={!current || !next || !!problem || busy !== null}
        onPress={() =>
          run('password', async () => {
            await changePassword(current, next);
            setCurrent('');
            setNext('');
            setDone(true);
          })
        }
      />
      {done && <Body>Your password is changed.</Body>}

      <Section>Recovery codes</Section>
      <Body muted small>Lost your codes, or used most of them? Make 10 new ones. The old ones stop working.</Body>
      <Button
        label="Make new recovery codes"
        variant="secondary"
        busy={busy === 'codes'}
        disabled={!current || busy !== null}
        onPress={() => run('codes', async () => setCodes(await newRecoveryCodes(current)))}
      />
      <ErrorNote error={error ?? problem} />
    </Screen>
  );
}
