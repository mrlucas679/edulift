import { router, useLocalSearchParams } from 'expo-router';
import { useEffect } from 'react';
import { Linking } from 'react-native';

import { useExplain } from '../../src/explain';
import { useProgramme } from '../../src/reference';
import { useCurrentMarks } from '../../src/saved-marks';
import { useSession } from '../../src/session';
import { Body, Button, Card, ErrorNote, Loading, Screen, Section, Title } from '../../src/ui';

const KHETHA = 'tel:0869990123';

export default function WhyThisResult() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { status, accessToken } = useSession();
  const programme = useProgramme(id);
  const marks = useCurrentMarks();
  const explain = useExplain(id, accessToken);
  const ready = status === 'signed-in' && Object.keys(marks).length > 0;

  useEffect(() => {
    if (ready) explain.mutate(marks);
    // Explain once, when the screen opens with marks to explain.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, ready]);

  const e = explain.data;
  return (
    <Screen
      title="Why this result"
      footer={
        <>
          <Button label="See my Plan B" onPress={() => router.push('/plan')} />
          <Button label="Talk to a person — Khetha 086 999 0123" variant="secondary" onPress={() => Linking.openURL(KHETHA)} />
        </>
      }
    >
      {programme.data && <Body muted small>{programme.data.name}</Body>}
      {!ready && <Body>Sign in and save your marks to get an explanation of your result.</Body>}
      {explain.isPending && <Loading />}
      <ErrorNote error={explain.error} />
      {e && (
        <>
          <Body>{e.summary}</Body>
          <Section>What you can do next</Section>
          <Body>{e.next_step}</Body>
          <Body muted>{e.plan_b_hint}</Body>
          <Card muted>
            <Title>{e.provider === 'bedrock' ? 'Explained by AI' : 'Standard explanation'}</Title>
            <Body muted small>
              {e.provider === 'bedrock'
                ? 'Written by AI from the checks on the course page. It can’t change the result — only the institution decides who gets a place.'
                : e.fallback_reason === 'no_consent'
                  ? 'Turn on AI explanations in Settings for a plain-language version.'
                  : 'AI wording isn’t available right now, so this is the standard explanation.'}
            </Body>
          </Card>
        </>
      )}
    </Screen>
  );
}
