import { router } from 'expo-router';

import { Body, Button, Card, Heading, Screen, Title } from '../src/ui';

// The plain-words summary. The full notice is on the Privacy page.
export default function HowWeUseYourData() {
  return (
    <Screen title="How we use your data" footer={<Button label="Got it" onPress={() => router.back()} />}>
      <Heading>In plain words</Heading>
      <Card>
        <Title>What we collect</Title>
        <Body>• Your email, first name, date of birth and province</Body>
        <Body>• Your school marks and subjects</Body>
        <Body>• Courses, funding and work you save or track</Body>
        <Body muted>We never ask for your ID number, banking details, race or income.</Body>
      </Card>
      <Card>
        <Title>Why</Title>
        <Body>To show what you qualify for, build your Plan B and remind you of deadlines you chose.</Body>
      </Card>
      <Card>
        <Title>Who sees it</Title>
        <Body>Only you. We don’t send your details to universities or funders. You apply on their sites yourself. AI explanations get your result, never your name.</Body>
      </Card>
      <Card>
        <Title>Your rights</Title>
        <Body>See, download or delete your data any time in Profile › My data. Under 18? A parent or guardian approves your saved account.</Body>
      </Card>
      <Body muted small>Questions: privacy contact email · Policy version 1.0</Body>
    </Screen>
  );
}
