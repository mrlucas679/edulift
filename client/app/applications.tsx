import { router } from 'expo-router';

import { useApplications } from '../src/tracking';
import { useSession } from '../src/session';
import { Body, Button, Card, Empty, Heading, QueryState, Screen, Title } from '../src/ui';

export default function ApplicationsScreen() {
  const { status, accessToken } = useSession();
  const applications = useApplications(status === 'signed-in' ? accessToken : null);

  if (status !== 'signed-in') {
    return (
      <Screen>
        <Heading>My applications</Heading>
        <Body muted>Sign in to track what you have applied for.</Body>
        <Button label="Sign in" onPress={() => router.push('/sign-in')} />
      </Screen>
    );
  }

  return (
    <Screen>
      <Heading>My applications</Heading>
      <QueryState query={applications}>
        {applications.data && applications.data.length === 0 && (
          <Empty message="Nothing tracked yet. Open a programme or opportunity and choose “Track application”." />
        )}
        {applications.data?.map((app) => (
          <Card key={app.id} onPress={() => router.push(`/application/${app.id}`)} label={`Open ${app.name}`}>
            <Title>{app.name}</Title>
            <Body muted>Status: {app.status}</Body>
            {app.needs_reference && <Body>Add your reference number.</Body>}
            {app.deadline_soon && <Body>Offer deadline within a week.</Body>}
          </Card>
        ))}
      </QueryState>
    </Screen>
  );
}
