import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Linking } from 'react-native';

import { useAsk } from '../src/assist';
import { t } from '../src/i18n';
import { useSession } from '../src/session';
import { Body, Button, Card, ErrorNote, Field, Screen, Section, Title } from '../src/ui';

function safeHost(url: string | null): string | null {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:' ? parsed.hostname : null;
  } catch {
    return null;
  }
}

export default function AskScreen() {
  const { status, accessToken } = useSession();
  const { about } = useLocalSearchParams<{ about?: string }>();
  const ask = useAsk(accessToken);
  // Opened from a course: the question is written and asked already.
  const [question, setQuestion] = useState(about ? `Tell me about ${about.slice(0, 200)}` : '');
  const signedIn = status === 'signed-in';

  useEffect(() => {
    if (about && signedIn) ask.mutate(question.trim());
    // Ask once, when the screen opens from a course.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [about, signedIn]);

  if (!signedIn) {
    return (
      <Screen title="Ask a question" footer={<Button label="Sign in or create an account" onPress={() => router.push('/sign-in')} />}>
        <Body muted>Sign in to ask questions about courses, funding and work.</Body>
      </Screen>
    );
  }

  return (
    <Screen title="Ask a question">
      <Body muted small>{t('askDisclaimer')}</Body>
      <Field label="Your question" value={question} onChangeText={setQuestion} maxLength={300} multiline />
      <Button
        label="Ask"
        disabled={question.trim().length < 3}
        busy={ask.isPending}
        onPress={() => ask.mutate(question.trim())}
      />
      <ErrorNote error={ask.error} />
      {ask.data && (
        <>
          <Card muted>
            <Body>{ask.data.answer}</Body>
            <Body muted small>
              {ask.data.provider === 'bedrock' ? 'Written by AI from our records. Check with the institution.' : 'Standard answer from our records.'}
            </Body>
          </Card>
          {ask.data.cited.length > 0 && <Section>From these records</Section>}
          {ask.data.cited.map((c) => {
            const host = safeHost(c.url);
            return (
              <Card key={c.id}>
                <Title>{c.title}</Title>
                {host && c.url ? (
                  <Button label={`Open ${host}`} variant="secondary" onPress={() => Linking.openURL(c.url as string)} />
                ) : c.id === 'your-marks' ? null : (
                  <Body muted small>No safe link for this yet.</Body>
                )}
              </Card>
            );
          })}
        </>
      )}
    </Screen>
  );
}
