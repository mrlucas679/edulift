import { router } from 'expo-router';

import { Body, Button, Heading, Screen } from '../src/ui';

export default function Offline() {
  return (
    <Screen title="" footer={<Button label="Retry" onPress={() => router.replace('/')} />}>
      <Heading>You’re offline</Heading>
      <Body muted>Showing what was saved on this phone. Your plan and deadlines still work offline.</Body>
    </Screen>
  );
}
