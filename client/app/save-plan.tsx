import { router } from 'expo-router';

import { Body, Button, Heading, Screen, Title } from '../src/ui';

export default function SavePlan() {
  return (
    <Screen
      title=""
      footer={
        <>
          <Button label="Create a free account" onPress={() => router.push('/sign-in')} />
          <Button label="Not now" variant="secondary" onPress={() => router.back()} />
          <Body muted small>Under 18? A parent or guardian approves your account with a link you send them.</Body>
        </>
      }
    >
      <Heading>Save your plan?</Heading>
      <Body muted>As a guest, your marks and plan stay on this phone only.</Body>
      <Title>A free account keeps them safe and adds:</Title>
      <Body>✓ Your plan on any phone or computer</Body>
      <Body>✓ An application tracker with checklists</Body>
      <Body>✓ Your next deadline on Home</Body>
    </Screen>
  );
}
