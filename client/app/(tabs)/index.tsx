import { router } from 'expo-router';
import { ScrollView, View } from 'react-native';

import { useMe } from '../../src/account';
import { usePlan } from '../../src/plan';
import { useDeadlines } from '../../src/reference';
import { latestMarks, useSavedMarks } from '../../src/saved-marks';
import { useSession } from '../../src/session';
import { space, useColors } from '../../src/theme';
import { useApplications } from '../../src/tracking';
import { Body, Button, Card, CardTop, Empty, Heading, Pill, QueryState, Screen, Section, Title } from '../../src/ui';

function greeting() {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  return hour < 18 ? 'Good afternoon' : 'Good evening';
}

function daysLabel(days: number) {
  if (days === 0) return 'Closes today';
  return days === 1 ? '1 day left' : `${days} days left`;
}

// Grey band across the top, as on the wireframe.
function Band({ children }: { children: React.ReactNode }) {
  const colors = useColors();
  return (
    <View style={{ backgroundColor: colors.muted, margin: -space.lg, marginBottom: 0, padding: space.lg, gap: space.sm }}>
      {children}
    </View>
  );
}

export default function Home() {
  const { status, accessToken } = useSession();
  const signedIn = status === 'signed-in';
  const me = useMe();
  const marks = latestMarks(useSavedMarks().data);
  const plan = usePlan(signedIn ? accessToken : null);
  const applications = useApplications(signedIn ? accessToken : null);
  const deadlines = useDeadlines();

  const nextDeadline = deadlines.data?.[0];
  const targets = plan.data?.targets ?? [];
  const short = targets.filter((t) => t.verdict && t.verdict.outcome !== 'qualifies');
  const nextStep = applications.data?.find((a) => a.checklist.some((c) => !c.done));
  const left = nextStep?.checklist.filter((c) => !c.done) ?? [];
  const firstName = me.data?.first_name;

  return (
    <Screen>
      <Band>
        <Heading>{signedIn && firstName ? `${greeting()}, ${firstName}` : 'Your marks. Your plan A and plan B.'}</Heading>
        {nextDeadline && <Body>Your next deadline closes in {nextDeadline.days_left} days.</Body>}
        {signedIn ? (
          <View style={{ alignSelf: 'flex-start' }}>
            <Button label={marks ? 'Update my marks' : 'Add my marks'} onPress={() => router.push('/my-marks')} />
          </View>
        ) : (
          <>
            <Body muted>See which courses, colleges, funding and work you qualify for, then apply on the official sites.</Body>
            <Button label="Check my options — no account needed" onPress={() => router.push('/aps')} />
            <Button label="Sign in or create an account" variant="secondary" onPress={() => router.push('/sign-in')} />
          </>
        )}
      </Band>

      {signedIn && marks && short.length > 0 && (
        <Card onPress={() => router.push('/plan')} label="Open your Plan B">
          <CardTop title="Your Plan B is ready" pill={`${short.length} route${short.length === 1 ? '' : 's'}`} filled />
          <Body muted small>
            {short[0].name} at {short[0].institution} isn’t a sure thing yet. Here are routes that still get you there.
          </Body>
          <Body small>See my plan ›</Body>
        </Card>
      )}
      {signedIn && marks && targets.length === 0 && (
        <Card onPress={() => router.push('/study')} label="Choose your Plan A">
          <Title>Choose your Plan A</Title>
          <Body muted small>Pick up to 3 courses you want most. We’ll check each one and build your Plan B.</Body>
          <Body small>Find courses ›</Body>
        </Card>
      )}

      <Card muted>
        <Body muted small>Tip: no real bursary, college or job asks you to pay to apply.</Body>
      </Card>

      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <Section>Upcoming deadlines</Section>
        <Button label="See all" variant="link" onPress={() => router.push('/study')} />
      </View>
      <QueryState query={deadlines} empty={deadlines.data?.length === 0}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.md }}>
          {deadlines.data?.slice(0, 6).map((d) => (
            <View key={`${d.institution_id}-${d.intake_year}`} style={{ width: 180 }}>
              <Card label={`${d.institution}, ${daysLabel(d.days_left)}`} onPress={() => router.push(`/institution/${d.institution_id}`)}>
                <Title>{d.institution}</Title>
                <Body muted small>Closes {d.closes_on}</Body>
                <Pill label={daysLabel(d.days_left)} filled />
              </Card>
            </View>
          ))}
        </ScrollView>
      </QueryState>
      {deadlines.data?.length === 0 && <Empty message="No application windows are loaded yet. Check each institution's site." />}

      {signedIn && nextStep && left.length > 0 && (
        <Card onPress={() => router.push(`/application/${nextStep.id}`)} label="Open your next step">
          <Section>Your next step</Section>
          <Title>{left[0].label}</Title>
          <Body muted small>
            {left.length} document{left.length === 1 ? '' : 's'} left on your {nextStep.name} application
          </Body>
        </Card>
      )}
    </Screen>
  );
}
