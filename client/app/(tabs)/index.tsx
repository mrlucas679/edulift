import { router } from 'expo-router';

import { useDeadlines } from '../../src/reference';
import { useSession } from '../../src/session';
import { Body, Button, Card, Empty, Heading, QueryState, Screen, Title } from '../../src/ui';

function daysLabel(days: number) {
  if (days === 0) return 'Closes today';
  return days === 1 ? '1 day left' : `${days} days left`;
}

export default function Home() {
  const { status } = useSession();
  const deadlines = useDeadlines();

  return (
    <Screen>
      <Heading>Your next step after matric</Heading>
      <Body muted>See where you qualify, and what’s still open if you don’t.</Body>
      {status !== 'signed-in' && (
        <Button label="Sign in to check your marks" onPress={() => router.push('/sign-in')} />
      )}
      <Button label="Try the APS calculator" onPress={() => router.push('/aps')} />
      <Button label="My plan" onPress={() => router.push('/plan')} />
      <Button label="Funding and work" onPress={() => router.push('/opportunities')} />

      <Title>Closing soon</Title>
      <QueryState query={deadlines} empty={deadlines.data?.length === 0}>
        {deadlines.data?.map((d) => (
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
