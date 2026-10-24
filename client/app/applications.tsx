import { router } from 'expo-router';
import { useState } from 'react';

import { useApplications } from '../src/tracking';
import { useSession } from '../src/session';
import { Body, Card, Empty, Heading, QueryState, Screen, Title } from '../src/ui';
import { KindChips } from '../src/opportunity-views';

const GROUPS = { planning: 'Planning', submitted: 'Submitted', offer: 'Offers' } as const;

export default function ApplicationsScreen() {
  const { status, accessToken } = useSession();
  const applications = useApplications(status === 'signed-in' ? accessToken : null);
  const [group, setGroup] = useState<keyof typeof GROUPS>('planning');

  if (status !== 'signed-in') {
    return (
      <Screen>
        <Heading>My applications</Heading>
        <Body muted>Sign in to track what you have applied for.</Body>
      </Screen>
    );
  }

  const shown = (applications.data ?? []).filter((a) =>
    group === 'planning' ? a.status === 'planning' : group === 'submitted' ? a.status === 'submitted' : a.status === 'offer',
  );

  return (
    <Screen>
      <Heading>My applications</Heading>
      <Body muted>We never apply for you. After you apply on the official site, update the status here.</Body>
      <KindChips
        kinds={Object.keys(GROUPS)}
        value={group}
        onChange={(v) => setGroup((v ?? 'planning') as keyof typeof GROUPS)}
        labels={GROUPS}
      />
      <QueryState query={applications}>
        {shown.length === 0 && <Empty message="Nothing here yet. Open a course or bursary and choose Track application." />}
        {shown.map((app) => {
          const done = app.checklist.filter((c) => c.done).length;
          return (
            <Card key={app.id} onPress={() => router.push(`/application/${app.id}`)} label={`Open ${app.name}`}>
              <Title>{app.name}</Title>
              <Body muted>
                {done} of {app.checklist.length} documents ready
                {app.offer_deadline ? ` · offer deadline ${app.offer_deadline}` : ''}
              </Body>
              {app.needs_reference && <Body>Add your reference number.</Body>}
              {app.deadline_soon && <Body>Offer deadline within a week.</Body>}
            </Card>
          );
        })}
      </QueryState>
    </Screen>
  );
}
