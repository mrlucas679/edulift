import { router } from 'expo-router';
import { useState } from 'react';

import { PASSWORD_RULE, passwordProblem, USERNAME_RULE, usernameProblem } from '../src/credentials';
import { RecoveryCodes } from '../src/recovery-codes';
import { useSession } from '../src/session';
import { Body, Button, ErrorNote, Field, Heading, Screen } from '../src/ui';

export default function CreateAccount() {
  const { register } = useSession();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [codes, setCodes] = useState<string[] | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);

  const name = username.trim();
  const problem = usernameProblem(name) ?? passwordProblem(password, name);
  const ready = name.length > 0 && password.length > 0 && !problem;

  async function create() {
    setBusy(true);
    setError(null);
    try {
      setCodes(await register(name, password));
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }

  if (codes) {
    return (
      <Screen title="Create an account" back={false}>
        <RecoveryCodes codes={codes} doneLabel="Continue" onDone={() => router.replace('/onboarding')} />
      </Screen>
    );
  }

  return (
    <Screen title="Create an account">
      <Heading>Pick a username and password</Heading>
      <Body muted>No email or phone number needed. Don’t use your real full name or ID number as your username.</Body>
      <Field label="Username" value={username} onChangeText={setUsername} autoCapitalize="none" autoCorrect={false} autoComplete="username-new" maxLength={30} />
      <Body muted small>{USERNAME_RULE}</Body>
      <Field label="Password" value={password} onChangeText={setPassword} secureTextEntry autoCapitalize="none" autoComplete="new-password" maxLength={128} onSubmitEditing={() => ready && create()} />
      <Body muted small>{PASSWORD_RULE}</Body>
      <ErrorNote error={error ?? problem} />
      <Button label="Create my account" onPress={create} busy={busy} disabled={!ready || busy} />
      <Button label="I already have an account" variant="link" onPress={() => router.replace('/sign-in')} />
    </Screen>
  );
}
