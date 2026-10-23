import { useMutation } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';

import { toMarks, useMarks } from '../../src/marks';
import { checkProgramme, useProgramme, useSubjectNames, type Verdict } from '../../src/reference';
import { useSession } from '../../src/session';
import { Body, Button, Card, ErrorNote, Heading, QueryState, Screen, SourceLine, Title } from '../../src/ui';

const OUTCOMES: Record<string, string> = {
  qualifies: 'You meet the published minimums.',
  qualifies_selection: 'You meet the minimums. This programme selects, so a place isn’t guaranteed.',
  qualifies_unconfirmed: 'You meet what we could confirm. Check the rest with the institution.',
  aps_only: 'Your score is enough, but some subject marks are short.',
  subjects_only: 'Your subjects are fine, but your score is short.',
  not_eligible: 'Both your score and some subjects are short.',
  closed: 'Applications for this intake have closed.',
  incomplete: 'Add at least six subjects plus Life Orientation to get a result.',
};

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
          </>
        )}
      </QueryState>
    </Screen>
  );
}
