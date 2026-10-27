import { router } from 'expo-router';
import { Text, View } from 'react-native';

import { shortDate } from '../src/dates';
import { useSession } from '../src/session';
import { font, radius, space, text, useColors } from '../src/theme';
import { useApplications, type Application } from '../src/tracking';
import { Body, Button, Card, CardTop, Empty, QueryState, Screen, Section } from '../src/ui';

function Count({ label, value }: { label: string; value: number }) {
  const colors = useColors();
  return (
    <View style={{ flex: 1, padding: space.md, borderRadius: radius.card, backgroundColor: colors.muted, alignItems: 'center' }}>
      <Text style={{ fontFamily: font.bold, fontSize: text.h1, color: colors.ink }}>{value}</Text>
      <Body muted small>{label}</Body>
    </View>
  );
}

function Bar({ done, total }: { done: number; total: number }) {
  const colors = useColors();
  const pct = total === 0 ? 0 : Math.round((done / total) * 100);
  return (
    <View style={{ height: 6, borderRadius: 3, backgroundColor: colors.border, overflow: 'hidden' }}>
      <View style={{ width: `${pct}%`, height: 6, backgroundColor: colors.accent }} />
    </View>
  );
}

function Row({ app }: { app: Application }) {
  const done = app.checklist.filter((c) => c.done).length;
  const submitted = app.status === 'submitted';
  return (
    <Card onPress={() => router.push(`/application/${app.id}`)} label={`Open ${app.name}`}>
      <CardTop
        title={app.name}
        pill={submitted ? 'Submitted' : app.offer_deadline ? `Closes ${shortDate(app.offer_deadline)}` : undefined}
        filled={submitted}
      />
      <Body muted small>
        {app.external_reference ? `Ref: ${app.external_reference} · ` : ''}
        {done} of {app.checklist.length} documents ready
      </Body>
      <Bar done={done} total={app.checklist.length} />
    </Card>
  );
}

export default function ApplicationsScreen() {
  const { status, accessToken } = useSession();
  const applications = useApplications(status === 'signed-in' ? accessToken : null);

  if (status !== 'signed-in') {
    return (
      <Screen title="My applications" footer={<Button label="Sign in or create an account" onPress={() => router.push('/sign-in')} />}>
        <Body muted>Sign in to track what you have applied for.</Body>
      </Screen>
    );
  }

  const all = applications.data ?? [];
  const by = (s: Application['status']) => all.filter((a) => a.status === s);
  const groups: [string, Application[]][] = [
    ['Submitted', by('submitted')],
    ['Planning', by('planning')],
    ['Offers', by('offer')],
    ['Other', all.filter((a) => !['submitted', 'planning', 'offer'].includes(a.status))],
  ];

  return (
    <Screen
      title="My applications"
      footer={<Button label="+ Track something new" variant="dashed" onPress={() => router.push('/study')} />}
    >
      <QueryState query={applications}>
        <View style={{ flexDirection: 'row', gap: space.sm }}>
          <Count label="Planning" value={by('planning').length} />
          <Count label="Submitted" value={by('submitted').length} />
          <Count label="Offers" value={by('offer').length} />
        </View>
        {all.length === 0 && <Empty message="Nothing here yet. Open a course or bursary and choose Track application." />}
        {groups.map(([label, apps]) =>
          apps.length === 0 ? null : (
            <View key={label} style={{ gap: space.md }}>
              <Section>{label}</Section>
              {apps.map((a) => <Row key={a.id} app={a} />)}
            </View>
          ),
        )}
        <Body muted small>We never apply for you. After you apply on the official site, update the status here.</Body>
      </QueryState>
    </Screen>
  );
}
