import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, Text } from 'react-native';

import { useSession } from '../src/session';
import { font, text, touchTarget, useColors } from '../src/theme';
import { Body, Button, ErrorNote, Field, Heading, Screen } from '../src/ui';

export default function SignIn() {
  const { createDemoAccount, signInDemo } = useSession();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [demoError, setDemoError] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);
  const colors = useColors();

  async function enterDemo(createAccount: boolean) {
    setBusy(true);
    setDemoError(null);
    try {
      if (createAccount) await createDemoAccount(email.trim(), password);
      else await signInDemo(email.trim(), password);
      router.replace('/onboarding');
    } catch (e) {
      setDemoError(e);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen>
      <Heading>Sign in to EduLift</Heading>
      <Body muted>Create a demo account or sign in to continue your learner profile and saved marks.</Body>
      <Field label="Email" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" inputMode="email" autoComplete="email" maxLength={254} />
      <Field label="Password" value={password} onChangeText={setPassword} secureTextEntry autoCapitalize="none" autoComplete="current-password" maxLength={128} />
      <Body muted>Demo accounts do not verify email. Choose a password with at least 16 characters.</Body>
      <ErrorNote error={demoError} />
      <Button label="Create demo account" onPress={() => enterDemo(true)} busy={busy} disabled={!email.trim() || password.length < 16} />
      <Button label="Sign in" onPress={() => enterDemo(false)} busy={busy} disabled={!email.trim() || !password} />
      <Pressable accessibilityRole="link" onPress={() => router.push('/how-we-use')} style={{ minHeight: touchTarget, justifyContent: 'center', alignItems: 'center' }}>
        <Text style={{ fontFamily: font.regular, fontSize: text.small, color: colors.ink, textDecorationLine: 'underline' }}>How we use your data</Text>
      </Pressable>
    </Screen>
  );
}
