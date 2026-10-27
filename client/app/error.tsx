import { router } from 'expo-router';

import { Body, Button, Heading, Screen } from '../src/ui';

// Expo Router shows this when a screen throws. `retry` re-renders the screen.
export function ErrorBoundary({ retry }: { error: Error; retry: () => void }) {
  return (
    <Screen title="" footer={<Button label="Go to Home" variant="secondary" onPress={() => router.replace('/')} />}>
      <Heading>Something went wrong</Heading>
      <Body muted>It’s not your fault and nothing you saved was lost. Please try again.</Body>
      <Button label="Try again" onPress={retry} />
    </Screen>
  );
}
