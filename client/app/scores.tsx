import { router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';

import { previewAps } from '../src/reference';
import { latestMarks, useSavedMarks } from '../src/saved-marks';
import { Body, Button, Card, Empty, Heading, QueryState, Screen, Title } from '../src/ui';

export default function ScoresScreen() {
  const saved = useSavedMarks();
  const marks = latestMarks(saved.data);
  const scores = useQuery({
    queryKey: ['scores', marks],
    queryFn: () => previewAps(marks ?? {}),
    enabled: marks !== null,
  });

  return (
    <Screen>
      <Heading>My scores</Heading>
      <Body muted>Each university scores your marks its own way. These use your newest saved results.</Body>
      <QueryState query={saved}>
        {marks === null && (
          <>
            <Empty message="Save your marks to see your scores." />
            <Button label="Enter my marks" onPress={() => router.push('/my-marks')} />
          </>
        )}
        {marks !== null && (
          <QueryState query={scores}>
            {scores.data?.map((row) => (
              <Card key={row.institution_id}>
                <Title>{row.institution}</Title>
                <Body muted>{row.scheme ?? 'Scheme not verified yet'}</Body>
                <Body>{row.score === null ? 'Check the university’s own calculator' : `Score ${row.score}`}</Body>
              </Card>
            ))}
          </QueryState>
        )}
      </QueryState>
      <Body muted>A score shows you meet a minimum. Universities with selection may still ask for more.</Body>
    </Screen>
  );
}
