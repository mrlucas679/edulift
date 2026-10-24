import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, Text } from 'react-native';

import { useSession } from '../src/session';
import { font, text, touchTarget, useColors } from '../src/theme';
import { Body, Button, Card, ErrorNote, Field, Heading, Screen, Title } from '../src/ui';

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

  const colors = useColors();
  return (
    <Screen>
      <Heading>Enter your email</Heading>
      <Body muted>We’ll email you a 6-digit code. No password to remember. New here? This creates your account.</Body>
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
      <Button label="Send my code" onPress={submit} busy={busy} disabled={!email.trim()} />
      <Card>
        <Title>No email address?</Title>
        <Body muted>You can use every feature as a guest. Your marks stay on this phone.</Body>
        <Pressable accessibilityRole="button" onPress={() => router.replace('/(tabs)')} style={{ minHeight: touchTarget, justifyContent: 'center' }}>
          <Text style={{ fontFamily: font.regular, fontSize: text.body, color: colors.ink, textDecorationLine: 'underline' }}>Continue as a guest</Text>
        </Pressable>
      </Card>
      <Body muted>Using a shared or school computer? Sign out when you’re done.</Body>
      <Pressable accessibilityRole="link" onPress={() => router.push('/how-we-use')} style={{ minHeight: touchTarget, justifyContent: 'center', alignItems: 'center' }}>
        <Text style={{ fontFamily: font.regular, fontSize: text.small, color: colors.ink, textDecorationLine: 'underline' }}>How we use your data</Text>
      </Pressable>
    </Screen>
  );
}
