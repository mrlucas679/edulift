import { useMutation } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { Linking, Pressable, Text, View } from 'react-native';

import { space, text, touchTarget, useColors } from '../../src/theme';

import { toMarks, useMarks } from '../../src/marks';
import { latestMarks, useSavedMarks } from '../../src/saved-marks';
import { checkProgramme, useProgramme, useSubjectNames, type Verdict } from '../../src/reference';
import { useAlternatives } from '../../src/alternatives';
import { useExplain } from '../../src/explain';
import { useSaved, useStartApplication, useToggleSaved } from '../../src/tracking';
import { usePlan, useSavePlan } from '../../src/plan';
import { useSession } from '../../src/session';
import { Body, Button, Card, ErrorNote, Heading, QueryState, Screen, SourceLine, Title } from '../../src/ui';
import { OUTCOMES } from '../../src/verdicts';

const RESULT = { pass: '✓', fail: '✗', unknown: '?' };
// Short outcome label for the banner chip, as on the wireframe.
const BANNER: Record<string, string> = {
  qualifies: 'You qualify',
  qualifies_selection: 'You qualify',
  qualifies_unconfirmed: 'Not confirmed',
  aps_only: 'Score met · subjects short',
  subjects_only: 'Subjects met · score short',
  not_eligible: 'Not eligible',
  closed: 'Closed',
};

function VerdictCard({ verdict }: { verdict: Verdict }) {
  const colors = useColors();
  return (
    <>
      <Card>
        <Body>{BANNER[verdict.outcome] ?? verdict.outcome}</Body>
        <Body>{OUTCOMES[verdict.outcome] ?? verdict.outcome}</Body>
      </Card>
      <Body muted>EVERY CHECK</Body>
      {verdict.checks.map((c) => (
        <Pressable
          key={c.name}
          accessibilityRole="link"
          onPress={() => Linking.openURL(c.source_url)}
          style={{ flexDirection: 'row', gap: space.md, minHeight: touchTarget }}
        >
          <Text style={{ fontSize: text.h3, color: colors.ink }}>{RESULT[c.result]}</Text>
          <View style={{ flex: 1 }}>
            <Body>{c.required}</Body>
            <Body muted>Yours: {c.yours}</Body>
          </View>
        </Pressable>
      ))}
      <Body muted>Based on your marks and published minimums. The institution decides who gets a place.</Body>
      {verdict.checks.some((c) => c.name.startsWith('nbt_') && c.result === 'unknown') && (
        <Button label="Add my NBT results to check this" onPress={() => router.push('/my-marks')} />
      )}
      <Button label="See Plan B" onPress={() => router.push('/plan')} />
      <Button label="Why this result" onPress={() => router.push(`/why/${verdict.programme_id}`)} />
    </>
  );
}

export default function ProgrammeScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const programme = useProgramme(id);
  const subjects = useSubjectNames();
  const { status, accessToken } = useSession();
  const [rows] = useMarks();
  // Marks typed here win; otherwise a signed-in learner's saved marks are used.
  const savedMarks = useSavedMarks();
  const typed = toMarks(rows);
  const marks = Object.keys(typed).length > 0 ? typed : (latestMarks(savedMarks.data) ?? {});
  const check = useMutation({ mutationFn: () => checkProgramme(id, marks, accessToken) });
  const alternatives = useAlternatives(id, accessToken);
  const explain = useExplain(id, accessToken);
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

            {check.data && (
              <>
                <Button
                  label="Explain this result"
                  busy={explain.isPending}
                  onPress={() => explain.mutate(marks)}
                />
                <ErrorNote error={explain.error} />
                {explain.data && (
                  <Card>
                    <Body>{explain.data.summary}</Body>
                    <Body>{explain.data.next_step}</Body>
                    <Body muted>{explain.data.plan_b_hint}</Body>
                    <Body muted>
                      {explain.data.provider === 'bedrock'
                        ? 'Words written by an AI model from this result. The result itself comes from our rules.'
                        : 'Standard wording from this result.'}
                    </Body>
                    <Body muted>{explain.data.disclaimer}</Body>
                  </Card>
                )}
              </>
            )}

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
