import { router } from 'expo-router';
import { useState } from 'react';

import { useSession } from '../src/session';
import { Body, Button, ErrorNote, Field, Heading, Screen } from '../src/ui';

export default function SignIn() {
  const { sendCode } = useSession();
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      await sendCode(email.trim());
      router.push('/sign-in-code');
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen>
      <Heading>Sign in to EduLift</Heading>
      <Body muted>We’ll email you a 6-digit code. No password to remember.</Body>
      <Field
        label="Email address"
        value={email}
        onChangeText={setEmail}
        autoComplete="email"
        autoCapitalize="none"
        keyboardType="email-address"
        inputMode="email"
        maxLength={254}
        onSubmitEditing={submit}
      />
      <ErrorNote error={error} />
      <Button label="Email me a code" onPress={submit} busy={busy} disabled={!email.trim()} />
    </Screen>
  );
}
