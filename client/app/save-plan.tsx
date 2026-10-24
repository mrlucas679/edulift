import { router } from 'expo-router';

import { Body, Button, Heading, Screen, Title } from '../src/ui';

export default function SavePlan() {
  return (
    <Screen>
      <Heading>Save your plan?</Heading>
      <Body muted>As a guest, your marks and plan stay on this phone only.</Body>
      <Title>A free account keeps them safe and adds:</Title>
      <Body>Your plan on any device.</Body>
      <Body>Deadline reminders by email, if you choose them.</Body>
      <Button label="Create a free account" onPress={() => router.push('/sign-in')} />
      <Button label="Keep going as a guest" onPress={() => router.back()} />
    </Screen>
  );
}
