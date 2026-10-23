import { useLocalSearchParams } from 'expo-router';

import { useProgramme, useSubjectNames } from '../../src/reference';
import { Body, Card, Heading, QueryState, Screen, SourceLine, Title } from '../../src/ui';

export default function ProgrammeScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const programme = useProgramme(id);
  const subjects = useSubjectNames();
  const name = (subjectId: string) => subjects.data?.get(subjectId) ?? subjectId;

  return (
    <Screen>
      <QueryState query={programme}>
        {programme.data && (
          <>
            <Heading>{programme.data.name}</Heading>
            <Body muted>
              Minimum APS: {programme.data.min_aps ?? 'check with the institution'}
            </Body>
            {programme.data.selection && (
              <Body muted>This programme selects students, so meeting the minimum isn’t a guaranteed place.</Body>
            )}
            {!programme.data.verified && (
              <Body muted>These requirements haven’t been double-checked yet.</Body>
            )}

            <Title>Subject requirements</Title>
            {programme.data.requirement_groups.map((group, i) => (
              <Card key={i}>
                <Body>
                  {group.map((o) => `${name(o.subject_id)} ${o.min_percent}%`).join(' or ')}
                </Body>
              </Card>
            ))}
            <SourceLine source={programme.data.source} />
          </>
        )}
      </QueryState>
    </Screen>
  );
}
