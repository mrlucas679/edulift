import { router } from 'expo-router';

import { Body, Button, Heading, Screen } from '../src/ui';

export default function Splash() {
  return (
    <Screen>
      <Heading>EduLift</Heading>
      <Body muted>Your marks. Your plan.</Body>
      <Button label="Start" onPress={() => router.replace('/(tabs)')} />
    </Screen>
  );
}
