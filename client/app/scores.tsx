import { schemeLabel } from '../src/check-labels';
import { router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { Pressable, Text, View } from 'react-native';

import { previewAps } from '../src/reference';
import { latestMarks, useSavedMarks } from '../src/saved-marks';
import { font, space, text, touchTarget, useColors } from '../src/theme';
import { Body, Button, Card, Empty, Heading, QueryState, Screen, Title } from '../src/ui';

function ScorePill({ value }: { value: string }) {
  const colors = useColors();
  return (
    <View
      style={{
        minWidth: 72,
        minHeight: touchTarget,
        paddingHorizontal: space.md,
        justifyContent: 'center',
        alignItems: 'center',
        borderRadius: 999,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.surface,
      }}
    >
      <Text style={{ fontFamily: font.bold, fontSize: text.body, color: colors.ink }}>{value}</Text>
    </View>
  );
}

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
      <Body muted>Each university scores your marks its own way. These use your Grade 12 June marks.</Body>
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
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: space.md }}>
                  <View style={{ flex: 1 }}>
                    <Title>{row.institution}</Title>
                    <Body muted>{schemeLabel(row.scheme)}</Body>
                  </View>
                  <ScorePill value={row.score === null ? '—' : String(row.score)} />
                </View>
              </Card>
            ))}
          </QueryState>
        )}
      </QueryState>
      <Card>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: space.md }}>
          <View style={{ flex: 1 }}>
            <Title>Not listed?</Title>
            <Body muted>We only show scores we’ve checked. Use the university’s own calculator.</Body>
          </View>
          <Pressable accessibilityRole="link" onPress={() => router.push('/aps')}>
            <Body>Check site</Body>
          </Pressable>
        </View>
      </Card>
      <Body muted>A score shows you meet a minimum. Universities with selection may still ask for more.</Body>
    </Screen>
  );
}
