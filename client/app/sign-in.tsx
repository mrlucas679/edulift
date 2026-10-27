import { router } from 'expo-router';
import { useState } from 'react';

import { ApiError } from '../src/api';
import { useSession } from '../src/session';
import { Body, Button, Card, ErrorNote, Field, Heading, Screen, Title } from '../src/ui';

const MIN_PASSWORD = 16;

// One button: signs in, or opens a new account when the email is new.
export default function SignIn() {
  const { createDemoAccount, signInDemo } = useSession();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);

  async function go() {
    setBusy(true);
    setError(null);
    const address = email.trim();
    try {
      try {
        await signInDemo(address, password);
      } catch (e) {
        if (!(e instanceof ApiError && e.code === 'invalid_credentials')) throw e;
        try {
          await createDemoAccount(address, password);
        } catch (again) {
          // The email has an account, so the password was wrong.
          throw again instanceof ApiError && again.code === 'account_exists' ? e : again;
        }
      }
      router.replace('/onboarding');
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen
      title="Sign in"
      footer={<Button label="How we use your data" variant="link" onPress={() => router.push('/how-we-use')} />}
    >
      <Heading>Sign in or create an account</Heading>
      <Body muted>New here? This creates your account. Use a password of at least {MIN_PASSWORD} characters.</Body>
      <Field label="Email address" value={email} onChangeText={setEmail} placeholder="you@example.com" autoCapitalize="none" keyboardType="email-address" inputMode="email" autoComplete="email" maxLength={254} />
      <Field label="Password" value={password} onChangeText={setPassword} secureTextEntry autoCapitalize="none" autoComplete="current-password" maxLength={128} onSubmitEditing={go} />
      <ErrorNote error={error} />
      <Button label="Continue" onPress={go} busy={busy} disabled={!email.trim() || password.length < MIN_PASSWORD} />
      <Card>
        <Title>No account?</Title>
        <Body muted small>You can use every feature as a guest. Your marks stay on this phone.</Body>
        <Button label="Continue as a guest" variant="link" onPress={() => router.replace('/(tabs)')} />
      </Card>
      <Body muted small>Using a shared or school computer? Sign out when you’re done.</Body>
    </Screen>
  );
}
