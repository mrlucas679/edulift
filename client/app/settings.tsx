import { router } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { Pressable, Switch, Text, View } from 'react-native';
import { useState } from 'react';

import { PURPOSES, setConsent, useMe } from '../src/account';
import { useSession } from '../src/session';
import { font, space, text, touchTarget, useColors } from '../src/theme';
import { Body, Button, ErrorNote, Field, Heading, QueryState, Screen, Title } from '../src/ui';

export default function Settings() {
  const { accessToken, status, signOut } = useSession();
  const me = useMe();
  const queryClient = useQueryClient();
  const colors = useColors();
  const [email, setEmail] = useState('');
  const [error, setError] = useState<unknown>(null);
  const [busy, setBusy] = useState<string | null>(null);

  async function change(purpose: string, on: boolean) {
    setBusy(purpose);
    setError(null);
    try {
      await setConsent(accessToken, purpose, on, purpose === 'reminders' && on ? email.trim() : undefined);
      await queryClient.invalidateQueries({ queryKey: ['me-details'] });
    } catch (e) {
      setError(e);
    } finally {
      setBusy(null);
    }
  }

  const reminderOn = me.data?.consents.includes('reminders') ?? false;
  const aiOn = me.data?.consents.includes('ai_explanations') ?? false;
  const nbtOn = me.data?.consents.includes('nbt_results') ?? false;
  const lowDataOn = me.data?.consents.includes('low_data') ?? false;

  return (
    <Screen>
      <Heading>Settings</Heading>
      <QueryState query={me}>
        <Title>Your choices</Title>
        <Body muted>You decide what we use. Change any of these any time.</Body>

        <View style={{ minHeight: touchTarget, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <View style={{ flex: 1, paddingRight: space.md }}>
            <Text style={{ fontFamily: font.bold, fontSize: text.body, color: colors.ink }}>Explain my results with AI</Text>
            <Text style={{ fontFamily: font.regular, fontSize: text.small, color: colors.inkMuted }}>{PURPOSES.ai_explanations}</Text>
          </View>
          <Switch
            value={aiOn}
            disabled={busy !== null}
            onValueChange={(on) => change('ai_explanations', on)}
            accessibilityLabel="Explain my results with AI"
          />
        </View>

        <View style={{ minHeight: touchTarget, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <View style={{ flex: 1, paddingRight: space.md }}>
            <Text style={{ fontFamily: font.bold, fontSize: text.body, color: colors.ink }}>Deadline reminders by email</Text>
            <Text style={{ fontFamily: font.regular, fontSize: text.small, color: colors.inkMuted }}>{PURPOSES.reminders}</Text>
          </View>
          <Switch
            value={reminderOn}
            disabled={busy !== null || (!reminderOn && email.trim() === '')}
            onValueChange={(on) => change('reminders', on)}
            accessibilityLabel="Deadline reminders by email"
          />
        </View>
        {!reminderOn && (
          <Field
            label="Email for reminders"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            maxLength={254}
          />
        )}

        <View style={{ minHeight: touchTarget, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <View style={{ flex: 1, paddingRight: space.md }}>
            <Text style={{ fontFamily: font.bold, fontSize: text.body, color: colors.ink }}>Use my NBT results</Text>
            <Text style={{ fontFamily: font.regular, fontSize: text.small, color: colors.inkMuted }}>{PURPOSES.nbt_results}</Text>
          </View>
          <Switch
            value={nbtOn}
            disabled={busy !== null}
            onValueChange={(on) => change('nbt_results', on)}
            accessibilityLabel="Use my NBT results"
          />
        </View>

        <View style={{ minHeight: touchTarget, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <View style={{ flex: 1, paddingRight: space.md }}>
            <Text style={{ fontFamily: font.bold, fontSize: text.body, color: colors.ink }}>Low-data mode</Text>
            <Text style={{ fontFamily: font.regular, fontSize: text.small, color: colors.inkMuted }}>{PURPOSES.low_data}</Text>
          </View>
          <Switch
            value={lowDataOn}
            disabled={busy !== null}
            onValueChange={(on) => change('low_data', on)}
            accessibilityLabel="Low-data mode"
          />
        </View>

        <Title>Language</Title>
        <Body>App language: English</Body>

        <Title>Account</Title>
        <Body>Email: you sign in with a code sent to your email</Body>
        <Body>Parent approval: {me.data?.status === 'pending_guardian' ? 'waiting' : me.data?.status === 'restricted' ? 'withdrawn, browsing only' : 'not needed (18+)'}</Body>
        <Button label="Privacy notice" onPress={() => router.push('/privacy')} />
        <Button label="Download or delete my data" onPress={() => router.push('/my-data')} />
        {status === 'signed-in' && <Button label="Sign out" onPress={() => signOut()} />}
        <ErrorNote error={error} />
      </QueryState>
      <Pressable accessibilityRole="button" onPress={() => router.back()} style={{ minHeight: touchTarget, justifyContent: 'center' }}>
        <Text style={{ fontFamily: font.bold, fontSize: text.body, color: colors.accent }}>Back</Text>
      </Pressable>
    </Screen>
  );
}
