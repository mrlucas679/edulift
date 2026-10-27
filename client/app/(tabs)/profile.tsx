import { router } from 'expo-router';
import { Text, View } from 'react-native';

import { useMe } from '../../src/account';
import { scoreFor, useApsPreview } from '../../src/marks-editor';
import { usePlan } from '../../src/plan';
import { latestMarks, PERIODS, useSavedMarks } from '../../src/saved-marks';
import { useSession } from '../../src/session';
import { font, space, text, useColors } from '../../src/theme';
import { useApplications, useSaved } from '../../src/tracking';
import { Body, Button, Card, Heading, Loading, Row, Screen, Section, Title } from '../../src/ui';

const NEWEST = ['gr12_final', 'gr12_prelim', 'gr12_june', 'gr11_final'];

function Avatar({ letter }: { letter: string }) {
  const colors = useColors();
  return (
    <View style={{ width: 56, height: 56, borderRadius: 28, borderWidth: 1, borderStyle: 'dashed', borderColor: colors.inkMuted, alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ fontFamily: font.bold, fontSize: text.h3, color: colors.ink }}>{letter}</Text>
    </View>
  );
}

function SignedOut() {
  return (
    <Screen
      title="Profile"
      back={false}
      footer={
        <>
          <Button label="Sign in or create a free account" onPress={() => router.push('/sign-in')} />
          <Body muted small>Under 18? A parent or guardian approves by email.</Body>
        </>
      }
    >
      <Heading>Your profile</Heading>
      <Body muted>Sign in to keep your plan, applications and reminders on any phone.</Body>
      <Card>
        <Body>✓ See what you qualify for, saved</Body>
        <Body>✓ Get reminders before deadlines close</Body>
        <Body>✓ Track every application in one place</Body>
      </Card>
      <Row label="Help and talk to a person" onPress={() => router.push('/help')} />
      <Row label="How we use your data" onPress={() => router.push('/how-we-use')} />
    </Screen>
  );
}

export default function Profile() {
  const { status, signOut, accessToken } = useSession();
  const signedIn = status === 'signed-in';
  const me = useMe();
  const plan = usePlan(signedIn ? accessToken : null);
  const saved = useSaved(signedIn ? accessToken : null);
  const applications = useApplications(signedIn ? accessToken : null);
  const savedMarks = useSavedMarks();
  const marks = latestMarks(savedMarks.data) ?? {};
  const aps = scoreFor(useApsPreview(marks).data, 'standard_best6');

  if (status === 'restoring') return <Loading />;
  if (!signedIn) return <SignedOut />;

  const d = me.data;
  const name = d?.first_name || 'You';
  const newest = NEWEST.find((p) => savedMarks.data?.[p]);
  const period = PERIODS.find((p) => p.id === newest)?.label;
  const facts = [d?.province, d?.certificate?.toUpperCase(), period && `marks from ${period}`].filter(Boolean).join(' · ');
  const count = (n: number | undefined, one: string, many: string) => (n === undefined ? undefined : `${n} ${n === 1 ? one : many}`);

  return (
    <Screen
      title="Profile"
      back={false}
      footer={<Button label="Sign out" variant="secondary" onPress={signOut} />}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
        <Avatar letter={name.charAt(0).toUpperCase()} />
        <View style={{ flex: 1 }}>
          <Title>{name}</Title>
          {facts !== '' && <Body muted small>{facts}</Body>}
        </View>
      </View>

      <Section>My plan</Section>
      <Row label="My marks" value={count(Object.keys(marks).length, 'subject', 'subjects')} onPress={() => router.push('/my-marks')} />
      <Row label="My scores" value={aps === null ? undefined : `APS ${aps}`} onPress={() => router.push('/scores')} />
      <Row label="My plan A and B" value={count(plan.data?.targets.length, 'course', 'courses')} onPress={() => router.push('/plan')} />
      <Row label="My applications" value={applications.data && `${applications.data.length} tracked`} onPress={() => router.push('/applications')} />
      <Row label="Saved" value={count(saved.data?.length, 'item', 'items')} onPress={() => router.push('/saved')} />

      <Section>Account</Section>
      <Row label="Settings and choices" onPress={() => router.push('/settings')} />
      <Row label="My data" onPress={() => router.push('/my-data')} />
      <Row label="Help and talk to a person" onPress={() => router.push('/help')} />
    </Screen>
  );
}
