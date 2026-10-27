import { router } from 'expo-router';
import { View } from 'react-native';

import { space, useColors } from '../src/theme';
import { Body, Button, Heading, Screen } from '../src/ui';

// The first screen. It waits for a tap, so a direct link is never replaced by it.
export default function Splash() {
  const colors = useColors();
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
        <View style={{ width: 64, height: 64, borderRadius: 10, borderWidth: 1, borderStyle: 'dashed', borderColor: colors.inkMuted, alignItems: 'center', justifyContent: 'center' }}>
          <Body muted small>EduLift</Body>
        </View>
        <Heading>Your marks. Your plan A and plan B.</Heading>
        <Body muted>See which courses, colleges, funding and work you qualify for, then apply on the official sites.</Body>
      </View>
    </Screen>
  );
}
