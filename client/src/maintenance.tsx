import { Body, Heading, Screen } from './ui';

// Shown instead of the app during a planned outage. The official sites still work.
export function Maintenance() {
  return (
    <Screen>
      <Heading>We’re updating the app</Heading>
      <Body muted>We’ll be back in a few minutes. Your saved marks, plan and applications are safe.</Body>
      <Body muted>If you were about to apply, go straight to the official site — you don’t need our app to submit.</Body>
    </Screen>
  );
}
