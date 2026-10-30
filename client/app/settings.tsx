import { useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useState } from 'react';
import { Switch, View } from 'react-native';

import { setConsent, useMe } from '../src/account';
import { useSession } from '../src/session';
import { space } from '../src/theme';
import { Body, Button, ErrorNote, QueryState, Row, Screen, Section, Title } from '../src/ui';

const CHOICES = [
  { id: 'ai_explanations', title: 'AI explanations', note: 'Send results, never your name, to an AI service' },
  { id: 'ai_writing', title: 'AI help with questions and CVs', note: 'What you type goes to an AI service' },
  // Email is off, so reminders only show here for anyone who turned them on before.
  { id: 'reminders', title: 'Deadline reminders by email', note: 'Only for things you saved' },
  { id: 'nbt_results', title: 'Use my NBT results', note: 'Checks admission rules that need them' },
  { id: 'low_data', title: 'Low-data mode', note: 'No badges, shorter lists' },
];

export default function Settings() {
  const { accessToken, status, signOut } = useSession();
  const me = useMe();
  const queryClient = useQueryClient();
  const [error, setError] = useState<unknown>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const on = (id: string) => me.data?.consents.includes(id) ?? false;

  async function change(purpose: string, value: boolean) {
    setBusy(purpose);
    setError(null);
    try {
      await setConsent(accessToken, purpose, value);
      await queryClient.invalidateQueries({ queryKey: ['me-details'] });
    } catch (e) {
      setError(e);
    } finally {
      setBusy(null);
    }
  }

  const guardian =
    me.data?.status === 'pending_guardian' ? 'Waiting' : me.data?.status === 'restricted' ? 'Withdrawn' : 'Not needed (18+)';

  return (
    <Screen
      title="Settings"
      footer={status === 'signed-in' && <Button label="Sign out" variant="secondary" onPress={signOut} />}
    >
      <QueryState query={me}>
        <Section>Your choices</Section>
        {CHOICES.filter((c) => c.id !== 'reminders' || on(c.id)).map((c) => (
          <View key={c.id} style={{ gap: space.sm }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: 52 }}>
              <View style={{ flex: 1 }}>
                <Title>{c.title}</Title>
                <Body muted small>{c.note}</Body>
              </View>
              <Switch
                accessibilityLabel={c.title}
                value={on(c.id)}
                disabled={busy !== null || (c.id === 'reminders' && !on(c.id))}
                onValueChange={(v) => change(c.id, v)}
              />
            </View>
          </View>
        ))}
        <ErrorNote error={error} />

        <Section>Language</Section>
        <Row label="App language" value="English" />

        <Section>Account</Section>
        <Row label="Parent approval" value={guardian} />
        <Row label="Password and recovery codes" onPress={() => router.push('/password')} />
        <Row label="Privacy notice" onPress={() => router.push('/privacy')} />
        <Row label="Download or delete my data" onPress={() => router.push('/my-data')} />
      </QueryState>
    </Screen>
  );
}
