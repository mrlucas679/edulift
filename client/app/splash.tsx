import { router } from 'expo-router';

import { Body, Button, Heading, Screen } from '../src/ui';

// The logo screen. It moves on only when the learner taps Start, so a link
// opened straight from a message is never replaced by this screen.
export default function Splash() {
  return (
    <Screen>
      <Heading>EduLift</Heading>
      <Body muted>Your marks. Your plan A.</Body>
      <Button label="Start" onPress={() => router.replace('/(tabs)')} />
    </Screen>
  );
}
