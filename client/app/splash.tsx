import { router } from 'expo-router';
import { useEffect } from 'react';

import { Body, Button, Heading, Screen } from '../src/ui';

export default function Splash() {
  useEffect(() => {
    const timer = setTimeout(() => router.replace('/(tabs)'), 1500);
    return () => clearTimeout(timer);
  }, []);

  return (
    <Screen>
      <Heading>EduLift</Heading>
      <Body muted>Your marks. Your plan A.</Body>
      <Button label="Start" onPress={() => router.replace('/(tabs)')} />
    </Screen>
  );
}
