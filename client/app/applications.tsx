import { router } from 'expo-router';

import { useApplications } from '../src/tracking';
import { useSession } from '../src/session';
import { font, space, text, touchTarget, useColors } from '../src/theme';
import { Body, Button, Card, Empty, Heading, QueryState, Screen, Title } from '../src/ui';
import { View, Text } from 'react-native';

function Count({ label, value }: { label: string; value: number }) {
  const colors = useColors();
  return (
    <View
      style={{
        flex: 1,
        minHeight: touchTarget,
        padding: space.md,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.surface,
        alignItems: 'center',
      }}
    >
      <Text style={{ fontFamily: font.bold, fontSize: text.h1, color: colors.ink }}>{value}</Text>
      <Body muted>{label}</Body>
    </View>
  );
}

function Bar({ done, total }: { done: number; total: number }) {
  const colors = useColors();
  const pct = total === 0 ? 0 : Math.round((done / total) * 100);
  return (
    <View style={{ height: 6, borderRadius: 3, backgroundColor: colors.border, overflow: 'hidden' }}>
      <View style={{ width: `${pct}%`, height: 6, backgroundColor: colors.ink }} />
    </View>
  );
}

export default function ApplicationsScreen() {
  const { status, accessToken } = useSession();
  const applications = useApplications(status === 'signed-in' ? accessToken : null);

  if (status !== 'signed-in') {
    return (
      <Screen>
        <Heading>My applications</Heading>
        <Body muted>Sign in to track what you have applied for.</Body>
      </Screen>
    );
  }

  const all = applications.data ?? [];
  const planning = all.filter((a) => a.status === 'planning');
  const submitted = all.filter((a) => a.status === 'submitted');
  const offers = all.filter((a) => a.status === 'offer');

  const row = (app: (typeof all)[number]) => {
    const done = app.checklist.filter((c) => c.done).length;
    return (
      <Card key={app.id} onPress={() => router.push(`/application/${app.id}`)} label={`Open ${app.name}`}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Title>{app.name}</Title>
          {app.offer_deadline && <Body muted>Closes {app.offer_deadline}</Body>}
        </View>
        <Body muted>
          {done} of {app.checklist.length} documents ready
        </Body>
        <Bar done={done} total={app.checklist.length} />
        {app.needs_reference && <Body>Add your reference number.</Body>}
        {app.deadline_soon && <Body>Offer deadline within a week.</Body>}
      </Card>
    );
  };

  return (
    <Screen>
      <Heading>My applications</Heading>
      <QueryState query={applications}>
        <View style={{ flexDirection: 'row', gap: space.sm }}>
          <Count label="Planning" value={planning.length} />
          <Count label="Submitted" value={submitted.length} />
          <Count label="Offers" value={offers.length} />
        </View>
        {all.length === 0 && <Empty message="Nothing here yet. Open a course or bursary and choose Track application." />}
        {submitted.length > 0 && <Title>SUBMITTED</Title>}
        {submitted.map(row)}
        {planning.length > 0 && <Title>PLANNING</Title>}
        {planning.map(row)}
        {offers.length > 0 && <Title>OFFERS</Title>}
        {offers.map(row)}
        <Body muted>We never apply for you. After you apply on the official site, update the status here.</Body>
        <Button label="+ Track something new" onPress={() => router.push('/opportunities')} />
      </QueryState>
    </Screen>
  );
}
