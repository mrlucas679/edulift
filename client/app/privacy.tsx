import { Body, Heading, Screen, Title } from '../src/ui';

export default function PrivacyScreen() {
  return (
    <Screen>
      <Heading>Privacy notice</Heading>
      <Body muted>Draft. This notice has not yet been reviewed by a privacy practitioner, so do not rely on it.</Body>
      <Title>What we keep</Title>
      <Body>Your sign-in email, date of birth, province, certificate type and marks you enter. Consents you give, with the policy version.</Body>
      <Title>What we don’t keep</Title>
      <Body>Your ID number, income, race or disability. Marks are kept only when you save them.</Body>
      <Title>Your rights</Title>
      <Body>Download your data from your profile, or delete your account there. Deleting removes your data and your sign-in.</Body>
      <Title>Reminders</Title>
      <Body>We email you only if you choose reminders, and only before a deadline you saved or applied for.</Body>
      <Body>NBT levels are optional and off until you choose to share them. We use them only to check admission rules that need them, we never send them to an AI service, and removing them or switching the option off deletes them.</Body>
    </Screen>
  );
}
