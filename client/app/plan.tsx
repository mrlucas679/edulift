import { router } from 'expo-router';
import { useState } from 'react';

import { OUTCOMES } from '../src/verdicts';
import { usePlan, useSavePlan } from '../src/plan';
import { useSession } from '../src/session';
import { Body, Button, Card, ErrorNote, Heading, QueryState, Screen, Title } from '../src/ui';

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
      </Screen>
    );
  }

  const remove = (programmeId: string) => {
    setRemoving(programmeId);
    const keep = plan.data?.targets.map((t) => t.programme_id).filter((id) => id !== programmeId) ?? [];
    save.mutate(keep, { onSettled: () => setRemoving(null) });
  };

  return (
    <Screen>
      <Heading>My plan</Heading>
      <QueryState query={plan} empty={plan.data?.targets.length === 0}>
        {plan.data && plan.data.targets.length === 0 && (
          <Body muted>
            No programmes yet. Open a programme and choose “Add to my plan”, up to three.
          </Body>
        )}
        {plan.data?.targets.map((target) => (
          <Card key={target.programme_id} onPress={() => router.push(`/programme/${target.programme_id}`)}>
            <Title>{target.name}</Title>
            <Body muted>{target.institution}</Body>
            {target.verdict ? (
              <>
                <Body>{OUTCOMES[target.verdict.outcome] ?? target.verdict.outcome}</Body>
                {target.verdict.score !== null && <Body muted>Your score: {target.verdict.score}</Body>}
                <Body muted>{target.verdict.window}</Body>
              </>
            ) : (
              <Body muted>Save your marks to see where you stand.</Body>
            )}
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
