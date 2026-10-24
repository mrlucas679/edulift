import { router } from 'expo-router';
import { ScrollView, Pressable, Text, View } from 'react-native';

import { font, space, text, touchTarget, useColors } from '../../src/theme';

import { useMe } from '../../src/account';
import { useApplications } from '../../src/tracking';
import { usePlan } from '../../src/plan';
import { useDeadlines } from '../../src/reference';
import { useSession } from '../../src/session';
import { Body, Button, Card, Empty, Heading, QueryState, Screen, Title } from '../../src/ui';

function greeting() {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  return hour < 18 ? 'Good afternoon' : 'Good evening';
}

function daysLabel(days: number) {
  if (days === 0) return 'Closes today';
  return days === 1 ? '1 day left' : `${days} days left`;
}

export default function Home() {
  const { status, accessToken } = useSession();
  const signedIn = status === 'signed-in';
  const me = useMe();
  const plan = usePlan(signedIn ? accessToken : null);
  const applications = useApplications(signedIn ? accessToken : null);
  const deadlines = useDeadlines();

  const nextDeadline = deadlines.data?.[0];
  const openRoutes = plan.data?.targets.filter((t) => t.verdict && t.verdict.outcome !== 'qualifies') ?? [];
  const nextStep = applications.data?.find((a) => a.checklist.some((c) => !c.done));
  const nextStepItem = nextStep?.checklist.find((c) => !c.done);
  const firstName = me.data?.first_name;

  const colors = useColors();
  return (
    <Screen>
      <Heading>{firstName ? `${greeting()}, ${firstName}` : 'Your next step after matric'}</Heading>
      {nextDeadline && <Body>Your next deadline closes in {nextDeadline.days_left} days.</Body>}
      {signedIn && <Button label="Update my marks" onPress={() => router.push('/my-marks')} />}

      {!signedIn && (
        <>
          <Body muted>See your marks, your Plan A and Plan B, and funding and work you qualify for.</Body>
          <Button label="Check my options, no account needed" onPress={() => router.push('/aps')} />
          <Button label="Sign in or create an account" onPress={() => router.push('/sign-in')} />
        </>
      )}

      {signedIn && openRoutes.length > 0 && (
        <Card onPress={() => router.push('/plan')} label="Open your Plan B">
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Title>Your Plan B is ready</Title>
            <Text style={{ fontFamily: font.bold, fontSize: text.small, color: colors.paper, backgroundColor: colors.ink, paddingHorizontal: space.sm, borderRadius: 999, overflow: 'hidden' }}>
              {openRoutes.length} route{openRoutes.length === 1 ? '' : 's'}
            </Text>
          </View>
          <Body muted>Some programmes on your plan need another route. See the options.</Body>
          <Pressable accessibilityRole="link" onPress={() => router.push('/plan')} style={{ minHeight: touchTarget, justifyContent: 'center' }}>
            <Body>See my plan</Body>
          </Pressable>
        </Card>
      )}

      {signedIn && nextStep && nextStepItem && (
        <Card onPress={() => router.push(`/application/${nextStep.id}`)} label="Open your next step">
          <Body muted>YOUR NEXT STEP</Body>
          <Body>{nextStepItem.label} for {nextStep.name}</Body>
        </Card>
      )}

      <Card>
        <Body muted>Tip: no real bursary, college or job asks you to pay to apply.</Body>
      </Card>

      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <Body muted>UPCOMING DEADLINES</Body>
        <Pressable accessibilityRole="link" onPress={() => router.push('/study')}>
          <Body>See all</Body>
        </Pressable>
      </View>
      <QueryState query={deadlines} empty={deadlines.data?.length === 0}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.md }}>
          {deadlines.data?.slice(0, 6).map((d) => (
            <View key={`${d.institution_id}-${d.intake_year}`} style={{ width: 220 }}>
              <Card
                label={`${d.institution}, ${daysLabel(d.days_left)}`}
                onPress={() => router.push(`/institution/${d.institution_id}`)}
              >
                <Title>{d.institution}</Title>
                <Body muted>Closes {d.closes_on}</Body>
                <Text style={{ fontFamily: font.bold, fontSize: text.small, color: colors.paper, backgroundColor: colors.ink, alignSelf: 'flex-start', paddingHorizontal: space.sm, borderRadius: 999, overflow: 'hidden' }}>
                  {daysLabel(d.days_left)}
                </Text>
              </Card>
            </View>
          ))}
        </ScrollView>
      </QueryState>
      {deadlines.data?.length === 0 && (
        <Empty message="No application windows are loaded yet. Check each institution's site." />
      )}
    </Screen>
  );
}
