import { router } from 'expo-router';
import { Linking } from 'react-native';
import { useState } from 'react';

import { useAsk } from '../src/assist';
import { useSession } from '../src/session';
import { Body, Button, Card, ErrorNote, Field, Heading, Screen, Title } from '../src/ui';

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
  const ask = useAsk(accessToken);
  const [question, setQuestion] = useState('');

  if (status !== 'signed-in') {
    return (
      <Screen>
        <Heading>Ask about programmes</Heading>
        <Body muted>Sign in to ask questions.</Body>
        <Button label="Sign in" onPress={() => router.push('/sign-in')} />
      </Screen>
    );
  }

  return (
    <Screen>
      <Heading>Ask about programmes</Heading>
      <Body muted>Answers come only from EduLift’s own records, and each one links to where it came from.</Body>
      <Field label="Your question" value={question} onChangeText={setQuestion} maxLength={300} multiline />
      <Button
        label="Ask"
        disabled={question.trim().length < 3}
        busy={ask.isPending}
        onPress={() => ask.mutate(question.trim())}
      />
      <ErrorNote error={ask.error} />
      {ask.data && (
        <Card>
          <Body>{ask.data.answer}</Body>
          {ask.data.provider === 'template' && <Body muted>Standard answer from our records.</Body>}
          {ask.data.cited.map((c) => {
            const host = safeHost(c.url);
            return (
              <Card key={c.id}>
                <Title>{c.title}</Title>
                {host && c.url ? (
                  <>
                    <Body muted>You are going to {host}.</Body>
                    <Button label={`Open ${host}`} onPress={() => Linking.openURL(c.url as string)} />
                  </>
                ) : (
                  <Body muted>No safe link for this yet.</Body>
                )}
              </Card>
            );
          })}
        </Card>
      )}
    </Screen>
  );
}
