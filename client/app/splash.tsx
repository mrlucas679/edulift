import { router } from 'expo-router';
import { Pressable, Text, View } from 'react-native';

import { font, space, text, touchTarget, useColors } from '../src/theme';
import { Body, Button, Heading, Screen } from '../src/ui';

// The logo screen: the first thing a learner sees. It waits for a tap, so a
// direct link is never replaced by this screen.
export default function Splash() {
  const colors = useColors();
  return (
    <Screen>
      <View style={{ flex: 1, justifyContent: 'flex-end', gap: space.md }}>
        <View style={{ width: 72, height: 72, borderRadius: 12, borderWidth: 1, borderStyle: 'dashed', borderColor: colors.border, alignItems: 'center', justifyContent: 'center' }}>
          <Body muted>Logo</Body>
        </View>
        <Heading>Your marks. Your plan A and plan B.</Heading>
        <Body muted>See which courses, colleges, funding and work you qualify for, then apply on the official sites.</Body>
      </View>
      <Button label="Check my options — no account needed" onPress={() => router.push('/aps')} />
      <Button label="Sign in or create an account" onPress={() => router.push('/sign-in')} />
      <Button label="Just calculate my APS" onPress={() => router.push('/aps')} />
      <Pressable accessibilityRole="button" onPress={() => router.replace('/(tabs)')} style={{ minHeight: touchTarget, justifyContent: 'center', alignItems: 'center' }}>
        <Text style={{ fontFamily: font.regular, fontSize: text.small, color: colors.inkMuted }}>Continue to the app</Text>
      </Pressable>
      <Body muted>Free for every learner. How we use your data</Body>
    </Screen>
  );
}
