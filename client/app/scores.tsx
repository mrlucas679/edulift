import { router } from 'expo-router';
import { View } from 'react-native';

import { schemeLabel } from '../src/check-labels';
import { useApsPreview } from '../src/marks-editor';
import { useCurrentMarks } from '../src/saved-marks';
import { space } from '../src/theme';
import { Body, Button, Card, Pill, QueryState, Screen, Title } from '../src/ui';

export default function ScoresScreen() {
  const marks = useCurrentMarks();
  const has = Object.keys(marks).length > 0;
  const scores = useApsPreview(marks);

  return (
    <Screen title="My scores">
      <Body muted>Each university scores your marks its own way. These use your newest marks.</Body>
      {!has && (
        <Card muted>
          <Body small>Save your marks to see your scores.</Body>
          <Button label="Add my marks" onPress={() => router.push('/my-marks')} />
        </Card>
      )}
      {has && (
        <QueryState query={scores}>
          {scores.data?.map((row) => (
            <Card key={row.institution_id} onPress={() => router.push(`/institution/${row.institution_id}`)} label={row.institution}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
                <View style={{ flex: 1 }}>
                  <Title>{row.institution}</Title>
                  <Body muted small>{schemeLabel(row.scheme)}</Body>
                </View>
                <Pill label={row.score === null ? '—' : String(row.score)} />
              </View>
            </Card>
          ))}
        </QueryState>
      )}
      <Card muted>
        <Title>Not listed?</Title>
        <Body muted small>We only show scores we’ve checked. Use the university’s own calculator.</Body>
      </Card>
      <Body muted small>A score shows you meet a minimum. Universities with selection may still ask for more.</Body>
    </Screen>
  );
}
