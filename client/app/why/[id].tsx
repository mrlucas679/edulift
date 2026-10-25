import { checkLabel } from '../../src/check-labels';
import { useMutation } from '@tanstack/react-query';
import { useLocalSearchParams } from 'expo-router';
import { useEffect } from 'react';

import { useMarks, toMarks } from '../../src/marks';
import { checkProgramme, type Verdict } from '../../src/reference';
import { useSession } from '../../src/session';
import { Body, Card, ErrorNote, Heading, Screen, Title } from '../../src/ui';

const RESULT = { pass: 'Met', fail: 'Short', unknown: 'Not confirmed' };

export default function WhyThisResult() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { accessToken } = useSession();
  const [rows] = useMarks();
  const check = useMutation<Verdict, unknown, void>({
    mutationFn: () => checkProgramme(id, toMarks(rows), accessToken),
  });

  useEffect(() => {
    check.mutate();
    // Run once when the screen opens; the marks are read at that moment.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  return (
    <Screen>
      <Heading>Why this result</Heading>
      <ErrorNote error={check.error} />
      {check.data && (
        <>
          <Title>Your score: {check.data.score ?? 'not available'}</Title>
          {check.data.checks.map((c) => (
            <Card key={c.name}>
              <Body>{RESULT[c.result]}</Body>
              <Body muted>{checkLabel(c.name, check.data.scheme)} needs: {c.required}</Body>
              <Body muted>Yours: {c.yours}</Body>
            </Card>
          ))}
        </>
      )}
    </Screen>
  );
}
