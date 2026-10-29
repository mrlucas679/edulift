import { Redirect, router } from 'expo-router';
import { View } from 'react-native';

import { useSession } from '../src/session';
import { space, useColors } from '../src/theme';
import { Body, Button, Heading, Logo, Screen } from '../src/ui';

// The first screen. It waits for a tap, so a direct link is never replaced by it.
export default function Splash() {
  const colors = useColors();
  const { status } = useSession();
  // Signed in already: Back never lands on the welcome screen.
  if (status === 'signed-in') return <Redirect href="/(tabs)" />;
  return (
    <Screen
      footer={
        <>
          <Button label="Check my options — no account needed" onPress={() => router.replace('/(tabs)')} />
          <Button label="Sign in or create an account" variant="secondary" onPress={() => router.push('/sign-in')} />
          <Button label="Just calculate my APS" variant="secondary" onPress={() => router.push('/aps')} />
          <Button label="Free for every learner. How we use your data" variant="link" onPress={() => router.push('/how-we-use')} />
        </>
      }
    >
      <View style={{ minHeight: 360, justifyContent: 'flex-end', gap: space.md, backgroundColor: colors.muted, margin: -space.lg, padding: space.lg }}>
        <Logo size={56} />
        <Heading>Your marks. Your plan A and plan B.</Heading>
        <Body muted>See which courses, colleges, funding and work you qualify for, then apply on the official sites.</Body>
      </View>
    </Screen>
  );
}
