import { router } from 'expo-router';
import { useState } from 'react';

import { useGenerateDraft, useSaveDraft } from '../src/assist';
import { useSession } from '../src/session';
import { Body, Button, ErrorNote, Field, Heading, Screen, Title } from '../src/ui';

type Kind = 'cv' | 'motivation_letter';

export default function DraftScreen() {
  const { status, accessToken } = useSession();
  const generate = useGenerateDraft(accessToken);
  const save = useSaveDraft(accessToken);
  const [kind, setKind] = useState<Kind>('cv');
  const [facts, setFacts] = useState('');
  const [text, setText] = useState('');
  const [saved, setSaved] = useState(false);

  if (status !== 'signed-in') {
    return (
      <Screen>
        <Heading>CV and letters</Heading>
        <Body muted>Sign in to write a CV or motivation letter.</Body>
        <Button label="Sign in" onPress={() => router.push('/sign-in')} />
      </Screen>
    );
  }

  return (
    <Screen>
      <Heading>CV and letters</Heading>
      <Body muted>
        Type what you want included. We remove ID numbers, emails and phone numbers before anything is sent. We don’t
        keep the draft unless you save it.
      </Body>
      <Button label="CV" disabled={kind === 'cv'} onPress={() => setKind('cv')} />
      <Button
        label="Motivation letter"
        disabled={kind === 'motivation_letter'}
        onPress={() => setKind('motivation_letter')}
      />
      <Field label="Your facts" value={facts} onChangeText={setFacts} maxLength={3000} multiline />
      <Button
        label="Write draft"
        disabled={facts.trim().length === 0}
        busy={generate.isPending}
        onPress={() =>
          generate.mutate(
            { kind, facts: facts.trim() },
            { onSuccess: (d) => { setText(d.text); setSaved(false); } },
          )
        }
      />
      <ErrorNote error={generate.error} />

      {text !== '' && (
        <>
          <Title>Draft — check and edit before you send.</Title>
          <Field label="Draft" value={text} onChangeText={setText} maxLength={10000} multiline />
          <Button
            label={saved ? 'Saved' : 'Save draft'}
            disabled={saved}
            busy={save.isPending}
            onPress={() =>
              save.mutate(
                { kind, title: kind === 'cv' ? 'CV' : 'Motivation letter', content: text },
                { onSuccess: () => setSaved(true) },
              )
            }
          />
          <ErrorNote error={save.error} />
        </>
      )}
    </Screen>
  );
}
