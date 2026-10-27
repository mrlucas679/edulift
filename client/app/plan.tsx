import { router } from 'expo-router';
import { useEffect } from 'react';
import { Pressable, View } from 'react-native';

import { useMe } from '../src/account';
import { useAlternatives } from '../src/alternatives';
import { usePlan, useSavePlan, type Plan } from '../src/plan';
import { useBatchChecks, useProgrammes, useProgrammesById } from '../src/reference';
import { useSession } from '../src/session';
import { space } from '../src/theme';
import { BANNER, OUTCOMES } from '../src/verdicts';
import { Body, Button, Card, CardTop, ErrorNote, Pill, QueryState, Screen, Section, Title } from '../src/ui';

const GOOD = new Set(['qualifies', 'qualifies_selection']);

// One line in a route card: name on the left, a tag that opens it on the right.
function Line({ name, tag, filled, onPress }: { name: string; tag: string; filled?: boolean; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={`${name}, ${tag}`}
      onPress={onPress}
      style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm, minHeight: 44 }}
    >
      <View style={{ flex: 1 }}>
        <Body small>{name}</Body>
      </View>
      <Pill label={tag} filled={filled} />
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
  const groups = [
    ...routes.map((r) => ({
      key: r.key,
      title: r.title,
      empty: r.empty_reason,
      lines: r.items.map((p) => ({ id: p.id, name: p.name, tag: 'Qualify', filled: true, href: `/programme/${p.id}` })),
    })),
    {
      key: 'funding',
      title: 'Funding',
      empty: 'No matching bursaries yet.',
      lines: funding.map((f) => ({ id: f.id, name: f.name, tag: 'Check now', filled: false, href: `/opportunity/${f.id}` })),
    },
    {
      key: 'work',
      title: 'Work and skills',
      empty: 'No matching listings yet.',
      lines: work.map((w) => ({ id: w.id, name: w.name, tag: 'Open', filled: false, href: `/opportunity/${w.id}` })),
    },
  ];
  return (
    <>
      <Section>Plan B · {groups.length} routes into it</Section>
      {groups.map((g, i) => (
        <Card key={g.key}>
          <Section>{`${i + 1} · ${g.title}`}</Section>
          {g.lines.length === 0 && <Body muted small>{g.empty}</Body>}
          {g.lines.map((l) => (
            <Line key={l.id} name={l.name} tag={l.tag} filled={l.filled} onPress={() => router.push(l.href as never)} />
          ))}
        </Card>
      ))}
    </>
  );
}

// No Plan A yet: courses in the learner's interests that their marks already meet, one tap to add.
function Suggestions({ accessToken }: { accessToken: string | null }) {
  const me = useMe();
  const field = me.data?.interests[0] ?? 'it';
  const programmes = useProgrammes({ field });
  const outcomes = useBatchChecks(accessToken);
  const save = useSavePlan(accessToken);
  const goodIds = (outcomes.data ?? []).filter((r) => GOOD.has(r.outcome)).map((r) => r.programme_id);
  const good = new Set(goodIds);
  const inField = (programmes.data?.items ?? []).filter((p) => good.has(p.id));
  // Nothing in their interests: show any course their marks meet.
  const anyField = useProgrammesById(inField.length ? [] : goodIds.slice(0, 6));
  const picks = inField.length
    ? inField.slice(0, 6)
    : anyField.flatMap((q) => (q.data ? [q.data] : []));

  return (
    <>
      <Title>Choose your Plan A</Title>
      <Body muted>Courses your marks already meet. Add your first choice and we’ll build your Plan B around it.</Body>
      <QueryState query={outcomes}>
        {picks.map((p) => (
          <Card key={p.id}>
            <CardTop title={p.name} pill="You qualify" filled />
            <Body muted small>{p.institution_id.toUpperCase()} · {p.qualification.replace('_', ' ')}</Body>
            <View style={{ flexDirection: 'row', gap: space.sm }}>
              <View style={{ flex: 1 }}>
                <Button label="Add to my plan" busy={save.isPending} onPress={() => save.mutate([p.id])} />
              </View>
              <View style={{ flex: 1 }}>
                <Button label="View" variant="secondary" onPress={() => router.push(`/programme/${p.id}`)} />
              </View>
            </View>
          </Card>
        ))}
        {picks.length === 0 && <Body muted small>None of the courses we hold is a sure match for these marks yet. Browse every course to see how close you are.</Body>}
      </QueryState>
      <Button label="Browse all courses" variant="secondary" onPress={() => router.push('/study')} />
      <ErrorNote error={save.error} />
    </>
  );
}

export default function PlanScreen() {
  const { status, accessToken } = useSession();
  const plan = usePlan(accessToken);
  const save = useSavePlan(accessToken);

  if (status !== 'signed-in') {
    return (
      <Screen title="My plan" footer={<Button label="Sign in or create an account" onPress={() => router.push('/sign-in')} />}>
        <Body muted>Sign in to keep up to three courses and see where you stand on each.</Body>
      </Screen>
    );
  }

  const targets = plan.data?.targets ?? [];
  const [planA, ...others] = targets;
  const remove = (id: string) => save.mutate(targets.map((t) => t.programme_id).filter((x) => x !== id));

  return (
    <Screen title="My plan">
      <QueryState query={plan}>
        {!planA && <Suggestions accessToken={accessToken} />}
        {planA && (
          <>
            <Body muted small>From your latest marks · sorted by what closes soonest</Body>
            <Section>Plan A · your first choice</Section>
            <Card onPress={() => router.push(`/programme/${planA.programme_id}`)} label={planA.name}>
              <CardTop
                title={`${planA.name} · ${planA.institution}`}
                pill={planA.verdict ? (BANNER[planA.verdict.outcome] ?? 'Check') : undefined}
                filled={planA.verdict ? GOOD.has(planA.verdict.outcome) : false}
              />
              <Body muted small>
                {planA.verdict ? (OUTCOMES[planA.verdict.outcome] ?? planA.verdict.outcome) : 'Save your marks to see where you stand.'}
              </Body>
              <View style={{ flexDirection: 'row', gap: space.lg }}>
                <Button label="Why?" variant="link" onPress={() => router.push(`/why/${planA.programme_id}`)} />
                <Button label="Remove" variant="link" onPress={() => remove(planA.programme_id)} />
              </View>
            </Card>
            {others.map((t) => (
              <Card key={t.programme_id} onPress={() => router.push(`/programme/${t.programme_id}`)} label={t.name}>
                <CardTop
                  title={`${t.name} · ${t.institution}`}
                  pill={t.verdict ? (BANNER[t.verdict.outcome] ?? 'Check') : undefined}
                  filled={t.verdict ? GOOD.has(t.verdict.outcome) : false}
                />
                <Button label="Remove" variant="link" onPress={() => remove(t.programme_id)} />
              </Card>
            ))}
            <Routes planA={planA} accessToken={accessToken} />
          </>
        )}
      </QueryState>
      <ErrorNote error={save.error} />
    </Screen>
  );
}
