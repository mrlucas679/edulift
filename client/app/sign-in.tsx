import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, Text } from 'react-native';

import { useSession } from '../src/session';
import { font, text, touchTarget, useColors } from '../src/theme';
import { Body, Button, ErrorNote, Heading, Screen } from '../src/ui';

// Email sign-in is hidden for now. The demo is the only way in.
export default function SignIn() {
  const { tryDemo } = useSession();
  const [demoError, setDemoError] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);
  const colors = useColors();

  async function startDemo() {
    setBusy(true);
    setDemoError(null);
    try {
      await tryDemo();
      router.replace('/');
    } catch (e) {
      setDemoError(e);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen>
      <Heading>Try EduLift</Heading>
      <Body muted>Open a sample learner account with made-up marks. No email or password needed.</Body>
      <ErrorNote error={demoError} />
      <Button label="Try the demo" onPress={startDemo} busy={busy} />
      <Pressable accessibilityRole="link" onPress={() => router.push('/how-we-use')} style={{ minHeight: touchTarget, justifyContent: 'center', alignItems: 'center' }}>
        <Text style={{ fontFamily: font.regular, fontSize: text.small, color: colors.ink, textDecorationLine: 'underline' }}>How we use your data</Text>
      </Pressable>
    </Screen>
  );
}
