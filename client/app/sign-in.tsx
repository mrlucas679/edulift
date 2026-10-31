import { router } from 'expo-router';
import { useState } from 'react';

import { useSession } from '../src/session';
import { Body, Button, Card, ErrorNote, Field, Heading, Screen, Title } from '../src/ui';

export default function SignIn() {
  const { signIn, tryDemo } = useSession();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<unknown>(null);
  const [busy, setBusy] = useState<'sign-in' | 'demo' | null>(null);

  async function run(which: 'sign-in' | 'demo', action: () => Promise<void>) {
    setBusy(which);
    setError(null);
    try {
      await action();
      router.replace('/onboarding');
    } catch (e) {
      setError(e);
    } finally {
      setBusy(null);
    }
  }

  const go = () => run('sign-in', () => signIn(username.trim(), password));
  const ready = username.trim().length >= 3 && password.length > 0;

  return (
    <Screen
      title="Sign in"
      footer={<Button label="How we use your data" variant="link" onPress={() => router.push('/how-we-use')} />}
    >
      <Heading>Sign in</Heading>
      <Field label="Username" value={username} onChangeText={setUsername} autoCapitalize="none" autoCorrect={false} autoComplete="username" maxLength={30} />
      <Field label="Password" value={password} onChangeText={setPassword} secureTextEntry autoCapitalize="none" autoComplete="current-password" maxLength={128} onSubmitEditing={() => ready && go()} />
      <ErrorNote error={error} />
      <Button label="Sign in" onPress={go} busy={busy === 'sign-in'} disabled={!ready || busy !== null} />
      <Button label="Forgot your password?" variant="link" onPress={() => router.push('/recover')} />
      <Card>
        <Title>New here?</Title>
        <Body muted small>Pick a username and password. No email or phone number needed.</Body>
        <Button label="Create an account" variant="secondary" onPress={() => router.push('/create-account')} />
      </Card>
      <Card muted>
        <Title>Just looking?</Title>
        <Body muted small>Try the demo: a new sample learner, no username or password. It lasts 4 hours, and you can’t come back to it after you sign out.</Body>
        <Button label="Try the demo" variant="secondary" onPress={() => run('demo', tryDemo)} busy={busy === 'demo'} disabled={busy !== null} />
      </Card>
      <Card>
        <Title>No account?</Title>
        <Body muted small>You can use every feature as a guest. Your marks stay on this phone.</Body>
        <Button label="Continue as a guest" variant="link" onPress={() => router.replace('/(tabs)')} />
      </Card>
      <Body muted small>Using a shared or school computer? Sign out when you’re done.</Body>
    </Screen>
  );
}
