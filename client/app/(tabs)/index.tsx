import { router } from 'expo-router';

import { useMe } from '../../src/account';
import { useApplications } from '../../src/tracking';
import { usePlan } from '../../src/plan';
import { useDeadlines } from '../../src/reference';
import { useSession } from '../../src/session';
import { Body, Button, Card, Empty, Heading, QueryState, Screen, Title } from '../../src/ui';

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

  return (
    <Screen>
      <Heading>{firstName ? `Good day, ${firstName}` : 'Your next step after matric'}</Heading>
      {nextDeadline && <Body>Your next deadline {daysLabel(nextDeadline.days_left).toLowerCase()}.</Body>}

      {!signedIn && (
        <>
          <Body muted>See your marks, your Plan A and Plan B, and funding and work you qualify for.</Body>
          <Button label="Check my options, no account needed" onPress={() => router.push('/aps')} />
          <Button label="Sign in or create an account" onPress={() => router.push('/sign-in')} />
        </>
      )}

      {signedIn && openRoutes.length > 0 && (
        <Card onPress={() => router.push('/plan')} label="Open your Plan B">
          <Title>Your Plan B is ready</Title>
          <Body muted>
            {openRoutes.length} programme{openRoutes.length === 1 ? '' : 's'} on your plan need another route.
          </Body>
        </Card>
      )}

      {signedIn && nextStep && nextStepItem && (
        <Card onPress={() => router.push(`/application/${nextStep.id}`)} label="Open your next step">
          <Title>Your next step</Title>
          <Body>{nextStepItem.label} for {nextStep.name}</Body>
        </Card>
      )}

      <Title>Upcoming deadlines</Title>
      <QueryState query={deadlines} empty={deadlines.data?.length === 0}>
        {deadlines.data?.slice(0, 6).map((d) => (
          <Card
            key={`${d.institution_id}-${d.intake_year}`}
            label={`${d.institution}, ${daysLabel(d.days_left)}`}
            onPress={() => router.push(`/institution/${d.institution_id}`)}
          >
            <Title>{d.institution}</Title>
            <Body muted>
              {d.intake_year} intake · closes {d.closes_on} · {daysLabel(d.days_left)}
            </Body>
          </Card>
        ))}
      </QueryState>
      {deadlines.data?.length === 0 && (
        <Empty message="No application windows are loaded yet. Check each institution's site." />
      )}
    </Screen>
  );
}
