import { useQueryClient } from '@tanstack/react-query';
import { Redirect, router } from 'expo-router';
import { useState } from 'react';
import { Switch, View } from 'react-native';

import { ApiError } from '../src/api';
import { askGuardian, PURPOSES, saveProfile, setConsent, useMe, type MeDetail } from '../src/account';
import { useSession } from '../src/session';
import { Body, Button, Card, ErrorNote, Field, Heading, Loading, Screen, Title } from '../src/ui';

const DATE = /^\d{4}-\d{2}-\d{2}$/;

function useAction<T>(fn: () => Promise<T>) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const run = async () => {
    setBusy(true);
    setError(null);
    try {
      return await fn();
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  };
  return { busy, error, run };
}

function Birthday({ onTooYoung }: { onTooYoung: () => void }) {
  const { accessToken } = useSession();
  const queryClient = useQueryClient();
  const [name, setName] = useState('');
  const [birth, setBirth] = useState('');
  const save = useAction(async () => {
    try {
      await saveProfile(accessToken, { first_name: name.trim(), birth_date: birth });
      await queryClient.invalidateQueries({ queryKey: ['me-details'] });
    } catch (e) {
      if (e instanceof ApiError && e.code === 'too_young') return onTooYoung();
      throw e;
    }
  });

  return (
    <>
      <Heading>About you</Heading>
      <Body muted>We only ask what we need to match you.</Body>
      <Field label="First name" value={name} onChangeText={setName} maxLength={60} autoComplete="given-name" />
      <Field
        label="Date of birth (YYYY-MM-DD)"
        value={birth}
        onChangeText={(v) => setBirth(v.replace(/[^\d-]/g, '').slice(0, 10))}
        placeholder="YYYY-MM-DD"
        inputMode="numeric"
        maxLength={10}
      />
      <ErrorNote error={save.error} />
      <Button label="Continue" onPress={save.run} busy={save.busy} disabled={!DATE.test(birth)} />
    </>
  );
}

function Guardian() {
  const { accessToken } = useSession();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const send = useAction(async () => {
    await askGuardian(accessToken, { guardian_name: name.trim(), guardian_email: email.trim() });
    setSent(true);
  });

  return (
    <>
      <Heading>Ask a parent or guardian</Heading>
      <Body muted>
        You’re 17, so the law needs a parent or guardian to agree before we keep your details.
        We’ll email them a link. Nothing else is saved until they say yes.
      </Body>
      <Field label="Their name" value={name} onChangeText={setName} maxLength={80} />
      <Field
        label="Their email"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        keyboardType="email-address"
        inputMode="email"
        maxLength={254}
      />
      <ErrorNote error={send.error} />
      <Button
        label={sent ? 'Send again' : 'Send the email'}
        onPress={send.run}
        busy={send.busy}
        disabled={!name.trim() || !email.trim()}
      />
      {sent && (
        <Body muted>
          Sent. Ask them to check their inbox, and spam. The link lasts 72 hours. Come back here once they’ve said yes.
        </Body>
      )}
    </>
  );
}

function Consents({ me }: { me: MeDetail }) {
  const { accessToken } = useSession();
  const queryClient = useQueryClient();
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [reminderEmail, setReminderEmail] = useState('');

  async function toggle(purpose: string, on: boolean) {
    setPending(purpose);
    setError(null);
    try {
      await setConsent(accessToken, purpose, on, purpose === 'reminders' ? reminderEmail.trim() : undefined);
      await queryClient.invalidateQueries({ queryKey: ['me-details'] });
    } catch (e) {
      setError(e);
    } finally {
      setPending(null);
    }
  }

  return (
    <>
      <Heading>Your choices</Heading>
      <Body muted>Only the first one is needed. You can change these any time in your profile.</Body>
      <Field
        label="Email for deadline reminders (only if you choose reminders)"
        value={reminderEmail}
        onChangeText={setReminderEmail}
        autoCapitalize="none"
        keyboardType="email-address"
      />
      {Object.entries(PURPOSES).map(([purpose, text]) => (
        <Card key={purpose}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <View style={{ flex: 1 }}>
              <Body>{text}</Body>
            </View>
            <Switch
              accessibilityLabel={text}
              value={me.consents.includes(purpose)}
              disabled={pending !== null}
              onValueChange={(on) => toggle(purpose, on)}
            />
          </View>
        </Card>
      ))}
      <ErrorNote error={error} />
    </>
  );
}

export default function Onboarding() {
  const { status } = useSession();
  const me = useMe();
  const [tooYoung, setTooYoung] = useState(false);

  if (tooYoung) {
    return (
      <Screen>
        <Heading>Not just yet</Heading>
        <Body>
          EduLift accounts are for people aged 17 and over, so we haven’t kept anything. You can still use
          the APS calculator and browse. Your Life Orientation teacher can help you plan now.
        </Body>
        <Button label="Browse" onPress={() => router.replace('/study')} />
      </Screen>
    );
  }
  if (status !== 'signed-in') return <Redirect href="/sign-in" />;
  if (me.isPending) return <Loading />;
  if (!me.data) {
    return (
      <Screen>
        <ErrorNote error={me.error} />
        <Button label="Try again" onPress={() => me.refetch()} />
      </Screen>
    );
  }

  return (
    <Screen>
      {!me.data.birth_date ? (
        <Birthday onTooYoung={() => setTooYoung(true)} />
      ) : me.data.status === 'pending_guardian' ? (
        <Guardian />
      ) : (
        <>
          <Consents me={me.data} />
          {me.data.status === 'active' && (
            <>
              <Title>You’re set up</Title>
              <Button label="Enter my marks" onPress={() => router.replace('/aps')} />
            </>
          )}
        </>
      )}
    </Screen>
  );
}
