import { router } from 'expo-router';

import { Body, Button, Heading, Screen } from '../src/ui';

export default function NotFound() {
  return (
    <Screen>
      <Heading>We can’t find that page</Heading>
      <Body muted>The link may be old, or the course or bursary may have been removed after its closing date.</Body>
      <Button label="Go to Home" onPress={() => router.replace('/')} />
      <Button label="Search courses" onPress={() => router.replace('/study')} />
    </Screen>
  );
}
