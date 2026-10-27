import { Body, Heading, Screen } from '../src/ui';

export default function Maintenance() {
  return (
    <Screen title="">
      <Heading>We’re updating the app</Heading>
      <Body muted>We’ll be back in a few minutes. Your saved marks and plan are safe.</Body>
    </Screen>
  );
}
