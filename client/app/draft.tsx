import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';

import { useDrafts, useGenerateDraft, useSaveDraft } from '../src/assist';
import { t } from '../src/i18n';
import { useSession } from '../src/session';
import { Body, Button, Card, Chips, ErrorNote, Field, QueryState, Screen, Section, Title } from '../src/ui';

type Kind = 'cv' | 'motivation_letter';
const KINDS = [
  { id: 'cv' as const, label: 'CV' },
  { id: 'motivation_letter' as const, label: 'Motivation letter' },
];

export default function DraftScreen() {
  const { status, accessToken } = useSession();
  // Opened from a bursary or job: it's a letter for that one.
  const { target } = useLocalSearchParams<{ target?: string }>();
  const generate = useGenerateDraft(accessToken);
  const save = useSaveDraft(accessToken);
  const drafts = useDrafts(status === 'signed-in' ? accessToken : null);
  const [kind, setKind] = useState<Kind>(target ? 'motivation_letter' : 'cv');
  const [facts, setFacts] = useState(target ? `I am applying for ${target.slice(0, 200)}. ` : '');
  const [text, setText] = useState('');
  const [saved, setSaved] = useState(false);

  if (status !== 'signed-in') {
    return (
      <Screen title="CV and letters" footer={<Button label="Sign in or create an account" onPress={() => router.push('/sign-in')} />}>
        <Body muted>Sign in to write a CV or motivation letter.</Body>
      </Screen>
    );
  }

  return (
    <Screen title="CV and letters">
      <Chips options={KINDS} value={kind} onChange={setKind} />
      <Body muted small>
        Type what you want included: school, subjects you enjoy, activities, why you want this. We remove ID numbers,
        emails and phone numbers before anything is sent.
      </Body>
      <Field label="Your facts" value={facts} onChangeText={setFacts} maxLength={3000} multiline />
      <Button
        label="Write draft"
        disabled={facts.trim().length === 0}
        busy={generate.isPending}
        onPress={() =>
          generate.mutate({ kind, facts: facts.trim() }, { onSuccess: (d) => { setText(d.text); setSaved(false); } })
        }
      />
      <ErrorNote error={generate.error} />

      {text !== '' && (
        <>
          <Title>{t('draftLabel')}</Title>
          {generate.data?.provider !== 'bedrock' && (
            <Body muted small>
              {generate.data?.fallback_reason === 'no_consent'
                ? 'This is a simple layout of your facts. Turn on AI help in Settings for a written draft.'
                : 'This is a simple layout of your facts; AI writing isn’t available right now.'}
            </Body>
          )}
          <Field label="Draft" value={text} onChangeText={(v) => { setText(v); setSaved(false); }} maxLength={10000} multiline />
          <Button
            label={saved ? 'Saved ✓' : 'Save draft'}
            variant="secondary"
            disabled={saved}
            busy={save.isPending}
            onPress={() =>
              save.mutate(
                { kind, title: kind === 'cv' ? 'CV' : target ? `Letter: ${target.slice(0, 80)}` : 'Motivation letter', content: text },
                { onSuccess: () => setSaved(true) },
              )
            }
          />
          <ErrorNote error={save.error} />
        </>
      )}

      <Section>Your saved drafts</Section>
      <QueryState query={drafts}>
        {drafts.data?.length === 0 && <Body muted small>Nothing saved yet.</Body>}
        {drafts.data?.map((d) => (
          <Card
            key={d.id}
            label={`Open ${d.title}`}
            onPress={() => { setKind(d.kind as Kind); setText(d.content); setSaved(true); }}
          >
            <Title>{d.title}</Title>
            <Body muted small>{d.content.slice(0, 90)}…</Body>
          </Card>
        ))}
      </QueryState>
    </Screen>
  );
}
