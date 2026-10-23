import { Redirect, router } from 'expo-router';
import { useState } from 'react';

import { ApiError } from '../src/api';
import { useSession } from '../src/session';
import { Body, Button, ErrorNote, Field, Heading, Screen } from '../src/ui';

export default function SignInCode() {
  const { pendingEmail, checkCode } = useSession();
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);

  // Session lost on reload: start over.
  if (!pendingEmail) return <Redirect href="/sign-in" />;

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      await checkCode(code);
      router.replace('/home');
    } catch (e) {
      if (e instanceof ApiError && e.code === 'code_expired') {
        router.replace('/sign-in');
        return;
      }
      setError(e);
      setCode('');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen>
      <Heading>Check your email</Heading>
      <Body muted>We sent a code to {pendingEmail}. It can take a minute to arrive.</Body>
      <Field
        label="6-digit code"
        value={code}
        onChangeText={(value) => setCode(value.replace(/\D/g, '').slice(0, 6))}
        autoComplete="one-time-code"
        textContentType="oneTimeCode"
        keyboardType="number-pad"
        inputMode="numeric"
        maxLength={6}
        onSubmitEditing={submit}
      />
      <ErrorNote error={error} />
      <Button label="Sign in" onPress={submit} busy={busy} disabled={code.length !== 6} />
    </Screen>
  );
}
