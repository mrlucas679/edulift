import { Body, Heading, Screen, Title } from '../src/ui';

export default function HelpScreen() {
  return (
    <Screen>
      <Heading>Help</Heading>
      <Body muted>Draft. The full help articles are still being written.</Body>
      <Title>Where do I stand?</Title>
      <Body>Enter your matric marks, then open a programme to see each requirement and whether you meet it.</Body>
      <Title>Applying</Title>
      <Body>EduLift never applies for you. Each apply button opens the official site, and you apply there.</Body>
      <Title>Something looks wrong?</Title>
      <Body>Check the source and date shown under each requirement, and confirm with the institution.</Body>
    </Screen>
  );
}
