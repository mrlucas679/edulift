import { useMutation } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { Linking, Pressable } from 'react-native';

import { toMarks, useMarks } from '../../src/marks';
import { checkProgramme, useProgramme, useSubjectNames, type Verdict } from '../../src/reference';
import { useAlternatives } from '../../src/alternatives';
import { useSaved, useStartApplication, useToggleSaved } from '../../src/tracking';
import { usePlan, useSavePlan } from '../../src/plan';
import { useSession } from '../../src/session';
import { Body, Button, Card, ErrorNote, Heading, QueryState, Screen, SourceLine, Title } from '../../src/ui';
import { OUTCOMES } from '../../src/verdicts';

const RESULT = { pass: '✓ Met', fail: '✗ Short', unknown: '? Not confirmed' };

function VerdictCard({ verdict }: { verdict: Verdict }) {
  return (
    <>
      <Title>{OUTCOMES[verdict.outcome] ?? verdict.outcome}</Title>
      {verdict.checks.map((c) => (
        <Card key={c.name}>
          <Body>{RESULT[c.result]}</Body>
          <Body muted>Needs: {c.required}</Body>
          <Body muted>Yours: {c.yours}</Body>
          <Pressable accessibilityRole="link" onPress={() => Linking.openURL(c.source_url)}>
            <Body muted>
              Source: {c.source_url} · {c.checked_on ? `checked ${c.checked_on}` : 'date not confirmed'}
            </Body>
          </Pressable>
        </Card>
      ))}
      <Body muted>{verdict.note}</Body>
    </>
  );
}

export default function ProgrammeScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const programme = useProgramme(id);
  const subjects = useSubjectNames();
  const { status, accessToken } = useSession();
  const [rows] = useMarks();
  const marks = toMarks(rows);
  const check = useMutation({ mutationFn: () => checkProgramme(id, marks, accessToken) });
  const alternatives = useAlternatives(id, accessToken);
  const saved = useSaved(accessToken);
  const toggleSaved = useToggleSaved(accessToken);
  const startApplication = useStartApplication(accessToken);
  const isSaved = saved.data?.some((s) => s.target_id === id) ?? false;
  const plan = usePlan(accessToken);
  const savePlan = useSavePlan(accessToken);
  const onPlan = plan.data?.targets.some((t) => t.programme_id === id) ?? false;
  const planFull = (plan.data?.targets.length ?? 0) >= (plan.data?.limit ?? 3);
  const name = (subjectId: string) => subjects.data?.get(subjectId) ?? subjectId;

  return (
    <Screen>
      <QueryState query={programme}>
        {programme.data && (
          <>
            <Heading>{programme.data.name}</Heading>
            <Body muted>Minimum APS: {programme.data.min_aps ?? 'check with the institution'}</Body>
            {!programme.data.verified && (
              <Body muted>These requirements haven’t been double-checked yet.</Body>
            )}

            <Title>Subject requirements</Title>
            {programme.data.requirement_groups.map((group, i) => (
              <Card key={i}>
                <Body>{group.map((o) => `${name(o.subject_id)} ${o.min_percent}%`).join(' or ')}</Body>
              </Card>
            ))}
            <SourceLine source={programme.data.source} />

            <Title>Where do I stand?</Title>
            {status !== 'signed-in' ? (
              <Button label="Sign in to check" onPress={() => router.push('/sign-in')} />
            ) : Object.keys(marks).length === 0 ? (
              <Button label="Enter my marks first" onPress={() => router.push('/aps')} />
            ) : (
              <Button label="Check my marks" onPress={() => check.mutate()} busy={check.isPending} />
            )}
            <ErrorNote error={check.error} />
            {check.data && <VerdictCard verdict={check.data} />}

            {check.data && check.data.outcome !== 'qualifies' && (
              <>
                <Title>Other options</Title>
                <Button
                  label="Show other options"
                  busy={alternatives.isPending}
                  onPress={() => alternatives.mutate()}
                />
                <ErrorNote error={alternatives.error} />
                {alternatives.data?.routes.map((route) => (
                  <Card key={route.key}>
                    <Title>{route.title}</Title>
                    {route.items.length === 0 ? (
                      <Body muted>{route.empty_reason}</Body>
                    ) : (
                      route.items.map((item) => (
                        <Pressable
                          key={item.id}
                          accessibilityRole="link"
                          onPress={() => router.push(`/programme/${item.id}`)}
                        >
                          <Body>{item.name}</Body>
                        </Pressable>
                      ))
                    )}
                  </Card>
                ))}
                {alternatives.data && (['funding', 'work'] as const).map((group) => (
                  <Card key={group}>
                    <Title>{group === 'funding' ? 'Funding' : 'Work'}</Title>
                    {alternatives.data[group].length === 0 && (
                      <Body muted>Nothing matched what we hold. Check the official sites.</Body>
                    )}
                    {alternatives.data[group].map((item) => (
                      <Body key={item.id}>
                        {item.name}: {item.verdict === 'qualifies' ? 'meets the criteria we could check' : 'you may qualify, confirm with the provider'}
                      </Body>
                    ))}
                  </Card>
                ))}
              </>
            )}

            {status === 'signed-in' && (
              <>
                <Title>Save and track</Title>
                <Button
                  label={isSaved ? 'Remove from saved' : 'Save'}
                  busy={toggleSaved.isPending}
                  onPress={() => toggleSaved.mutate({ kind: 'programme', id, on: !isSaved })}
                />
                <Button
                  label="Track application"
                  busy={startApplication.isPending}
                  onPress={() =>
                    startApplication.mutate(
                      { target_kind: 'programme', target_id: id },
                      { onSuccess: (app) => router.push(`/application/${app.id}`) },
                    )
                  }
                />
                <ErrorNote error={toggleSaved.error ?? startApplication.error} />

                <Title>My plan</Title>
                {onPlan ? (
                  <Body muted>This programme is on your plan.</Body>
                ) : planFull ? (
                  <Body muted>Your plan is full. Remove a programme to add this one.</Body>
                ) : (
                  <Button
                    label="Add to my plan"
                    busy={savePlan.isPending}
                    onPress={() =>
                      savePlan.mutate([...(plan.data?.targets.map((t) => t.programme_id) ?? []), id])
                    }
                  />
                )}
                <ErrorNote error={savePlan.error} />
              </>
            )}
          </>
        )}
      </QueryState>
    </Screen>
  );
}
