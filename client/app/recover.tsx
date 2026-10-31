import { router } from 'expo-router';
import { useState } from 'react';

import { PASSWORD_RULE, passwordProblem } from '../src/credentials';
import { useSession } from '../src/session';
import { Body, Button, ErrorNote, Field, Heading, Screen } from '../src/ui';

export default function Recover() {
  const { recover } = useSession();
  const [username, setUsername] = useState('');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);

  const problem = passwordProblem(password, username.trim());
  const ready = username.trim().length >= 3 && code.trim().length >= 12 && password.length > 0 && !problem;

  async function go() {
    setBusy(true);
    setError(null);
    try {
      await recover(username.trim(), code.trim(), password);
      router.replace('/onboarding');
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen title="Forgot your password">
      <Heading>Use a recovery code</Heading>
      <Body muted>Type one of the codes you saved when you made your account. It sets a new password and signs you out everywhere else. Each code works once.</Body>
      <Field label="Username" value={username} onChangeText={setUsername} autoCapitalize="none" autoCorrect={false} autoComplete="username" maxLength={30} />
      <Field label="Recovery code" value={code} onChangeText={setCode} autoCapitalize="characters" autoCorrect={false} autoComplete="one-time-code" maxLength={20} placeholder="7KQM-X2RB-9FTD" />
      <Field label="New password" value={password} onChangeText={setPassword} secureTextEntry autoCapitalize="none" autoComplete="new-password" maxLength={128} onSubmitEditing={() => ready && go()} />
      <Body muted small>{PASSWORD_RULE}</Body>
      <ErrorNote error={error ?? problem} />
      <Button label="Set my new password" onPress={go} busy={busy} disabled={!ready || busy} />
      <Body muted small>Lost your codes too? Make a new account. We can’t reset it for you, because we don’t keep an email or phone number.</Body>
    </Screen>
  );
}
