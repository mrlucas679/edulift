import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { useAlternatives } from '../src/alternatives';
import { OUTCOMES } from '../src/verdicts';
import { usePlan, useSavePlan, type Plan } from '../src/plan';
import { useSession } from '../src/session';
import { font, space, text, touchTarget, useColors } from '../src/theme';
import { Body, Button, Card, ErrorNote, Heading, QueryState, Screen, Title } from '../src/ui';

// Short label for the outcome, shown as a chip beside each route.
const CHIP: Record<string, string> = {
  qualifies: 'Qualify',
  qualifies_selection: 'Qualify',
  qualifies_unconfirmed: 'Check',
  aps_only: 'Short',
  subjects_only: 'Short',
  not_eligible: 'Short',
  closed: 'Closed',
};

function Chip({ label, onPress }: { label: string; onPress?: () => void }) {
  const colors = useColors();
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={{
        minHeight: touchTarget,
        paddingHorizontal: space.md,
        justifyContent: 'center',
        borderRadius: 999,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: onPress ? colors.ink : colors.surface,
      }}
    >
      <Text style={{ fontFamily: font.bold, fontSize: text.small, color: onPress ? colors.paper : colors.ink }}>{label}</Text>
    </Pressable>
  );
}

function Routes({ planA, accessToken }: { planA: Plan['targets'][number]; accessToken: string | null }) {
  const alternatives = useAlternatives(planA.programme_id, accessToken);
  useEffect(() => {
    alternatives.mutate();
    // Refetch only when the first choice changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [planA.programme_id]);
  if (alternatives.isPending) return <Body muted>Looking at routes…</Body>;
  if (!alternatives.data) return <ErrorNote error={alternatives.error} />;
  const { routes, funding, work } = alternatives.data;
  return (
    <>
      {routes.map((route, i) => (
        <Card key={route.key} label={route.title}>
          <Body muted>{`${i + 1} · ${route.title.toUpperCase()}`}</Body>
          {route.items.length === 0 && <Body muted>{route.empty_reason}</Body>}
          {route.items.map((p) => (
            <View key={p.id} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Body>{p.name}</Body>
              <Chip label="Qualify" onPress={() => router.push(`/programme/${p.id}`)} />
            </View>
          ))}
        </Card>
      ))}
      <Card>
        <Body muted>3 · FUNDING</Body>
        {funding.map((f) => (
          <View key={f.id} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Body>{f.name}</Body>
            <Chip label="Check now" onPress={() => router.push(`/opportunity/${f.id}`)} />
          </View>
        ))}
        {funding.length === 0 && <Body muted>No matching bursaries yet.</Body>}
      </Card>
      <Card>
        <Body muted>4 · WORK AND SKILLS</Body>
        {work.map((w) => (
          <View key={w.id} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Body>{w.name}</Body>
            <Chip label="Open" onPress={() => router.push(`/opportunity/${w.id}`)} />
          </View>
        ))}
        {work.length === 0 && <Body muted>No matching listings yet.</Body>}
      </Card>
    </>
  );
}

export default function PlanScreen() {
  const { status, accessToken } = useSession();
  const plan = usePlan(accessToken);
  const save = useSavePlan(accessToken);
  const [removing, setRemoving] = useState<string | null>(null);

  if (status !== 'signed-in') {
    return (
      <Screen>
        <Heading>My plan</Heading>
        <Body muted>Sign in to keep up to three programmes and see where you stand on each.</Body>
        <Button label="Sign in" onPress={() => router.push('/sign-in')} />
        <Button label="Save my plan" onPress={() => router.push('/save-plan')} />
        <Button label="Save my plan" onPress={() => router.push('/save-plan')} />
      </Screen>
    );
  }

  const remove = (programmeId: string) => {
    setRemoving(programmeId);
    const keep = plan.data?.targets.map((t) => t.programme_id).filter((id) => id !== programmeId) ?? [];
    save.mutate(keep, { onSettled: () => setRemoving(null) });
  };

  const [planA, ...others] = plan.data?.targets ?? [];

  return (
    <Screen>
      <Heading>My plan</Heading>
      <QueryState query={plan} empty={plan.data?.targets.length === 0}>
        {plan.data && plan.data.targets.length === 0 && (
          <Body muted>
            No programmes yet. Open a programme and choose “Add to my plan”, up to three.
          </Body>
        )}
        {planA && (
          <>
            <Body muted>From your marks · sorted by what closes soonest</Body>
            <Title>PLAN A · YOUR FIRST CHOICE</Title>
            <Card onPress={() => router.push(`/programme/${planA.programme_id}`)} label={planA.name}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <Body>{planA.name}</Body>
                {planA.verdict && <Chip label={CHIP[planA.verdict.outcome] ?? 'Check'} />}
              </View>
              <Body muted>{planA.institution}</Body>
              {planA.verdict ? (
                <>
                  <Body muted>{OUTCOMES[planA.verdict.outcome] ?? planA.verdict.outcome}</Body>
                  {planA.verdict.score !== null && <Body muted>Your score: {planA.verdict.score}</Body>}
                </>
              ) : (
                <Body muted>Save your marks to see where you stand.</Body>
              )}
              <Pressable accessibilityRole="link" onPress={() => router.push(`/why/${planA.programme_id}`)}>
                <Body>Why?</Body>
              </Pressable>
              <Button
                label="Remove"
                onPress={() => remove(planA.programme_id)}
                busy={removing === planA.programme_id}
              />
            </Card>
            <Title>PLAN B · ROUTES</Title>
            {plan.data && <Routes planA={planA} accessToken={accessToken} />}
          </>
        )}
        {others.map((target) => (
          <Card key={target.programme_id} onPress={() => router.push(`/programme/${target.programme_id}`)}>
            <Title>{target.name}</Title>
            <Body muted>{target.institution}</Body>
            <Button
              label="Remove"
              onPress={() => remove(target.programme_id)}
              busy={removing === target.programme_id}
            />
          </Card>
        ))}
      </QueryState>
      <ErrorNote error={save.error} />
    </Screen>
  );
}
