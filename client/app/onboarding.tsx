import { useQueryClient } from '@tanstack/react-query';
import { Redirect, router } from 'expo-router';
import { useState } from 'react';
import { Pressable, Switch, Text, View } from 'react-native';

import { font, space, text, touchTarget, useColors } from '../src/theme';

import { ApiError } from '../src/api';
import { askGuardian, PURPOSES, saveProfile, setConsent, useMe, type MeDetail } from '../src/account';
import { useSession } from '../src/session';
import { useFields } from '../src/reference';
import { Body, Button, Card, ErrorNote, Field, Heading, Loading, Screen, Title } from '../src/ui';

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const PROVINCES = [
  'Eastern Cape',
  'Free State',
  'Gauteng',
  'KwaZulu-Natal',
  'Limpopo',
  'Mpumalanga',
  'North West',
  'Northern Cape',
  'Western Cape',
];
const CERTIFICATES = [
  { id: 'nsc', label: 'NSC' },
  { id: 'ieb', label: 'IEB' },
  { id: 'sacai', label: 'SACAI' },
] as const;
type Certificate = (typeof CERTIFICATES)[number]['id'];

function Chip({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  return (
    <Button label={label} onPress={onPress} disabled={selected} />
  );
}

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
  const [province, setProvince] = useState<string | null>(null);
  const [certificate, setCertificate] = useState<Certificate | null>(null);
  const save = useAction(async () => {
    try {
      await saveProfile(accessToken, {
        first_name: name.trim(),
        birth_date: birth,
        province,
        certificate,
      });
      await queryClient.invalidateQueries({ queryKey: ['me-details'] });
    } catch (e) {
      if (e instanceof ApiError && e.code === 'too_young') return onTooYoung();
      throw e;
    }
  });

  return (
    <>
      <StepBar step={1} />
      <Heading>About you</Heading>
      <Body muted>We only ask what we need to match you. We never ask for your ID number, income or race.</Body>
      <Field label="First name" value={name} onChangeText={setName} maxLength={60} autoComplete="given-name" />
      <Title>When were you born?</Title>
      <Field
        label="Date of birth (YYYY-MM-DD)"
        value={birth}
        onChangeText={(v) => setBirth(v.replace(/[^\d-]/g, '').slice(0, 10))}
        placeholder="YYYY-MM-DD"
        inputMode="numeric"
        maxLength={10}
      />
      <Card>
        <Title>Why we ask for the date, not your age</Title>
        <Body muted>So the app knows when you turn 18 without asking again. We don’t use it for anything else.</Body>
      </Card>
      <Title>Province you live in</Title>
      <Body muted>Used to show nearby colleges first. We never limit you to one province.</Body>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {PROVINCES.map((p) => (
          <Chip key={p} label={p} selected={province === p} onPress={() => setProvince(p)} />
        ))}
      </View>
      <Title>Which certificate are you writing?</Title>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {CERTIFICATES.map((c) => (
          <Chip key={c.id} label={c.label} selected={certificate === c.id} onPress={() => setCertificate(c.id)} />
        ))}
      </View>
      <ErrorNote error={save.error} />
      <Button label="Continue" onPress={save.run} busy={save.busy} disabled={!DATE.test(birth)} />
    </>
  );
}

function Guardian() {
  const { accessToken } = useSession();
  const colors = useColors();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [relation, setRelation] = useState<'parent' | 'legal_guardian'>('parent');
  const [sent, setSent] = useState(false);
  const send = useAction(async () => {
    await askGuardian(accessToken, { guardian_name: name.trim(), guardian_email: email.trim() });
    setSent(true);
  });

  if (sent) {
    return (
      <>
        <Heading>Request sent to {email.trim().replace(/^(.).*(@.*)$/, '$1•••$2')}</Heading>
        <Body muted>When your parent or guardian taps Approve, your account opens and your plan is saved.</Body>
        <Card>
          <Title>Status</Title>
          <Body muted>Sent just now · link works for 72 hours</Body>
          <Text style={{ fontFamily: font.bold, fontSize: text.small, color: colors.ink }}>Waiting</Text>
        </Card>
        <Card>
          <Title>What happens next</Title>
          <Body>1. They open the email and read what we store.</Body>
          <Body>2. They confirm they’re your parent or guardian.</Body>
          <Body>3. They tap Approve. You’ll get a notification.</Body>
        </Card>
        <Button label="Keep using as a guest" onPress={() => router.replace('/(tabs)')} />
        <Button label="Resend the email" onPress={send.run} busy={send.busy} />
        <Pressable accessibilityRole="button" onPress={() => setSent(false)} style={{ minHeight: touchTarget, justifyContent: 'center', alignItems: 'center' }}>
          <Text style={{ fontFamily: font.regular, fontSize: text.small, color: colors.ink, textDecorationLine: 'underline' }}>Use a different email</Text>
        </Pressable>
      </>
    );
  }

  return (
    <>
      <Heading>You can still use everything</Heading>
      <Body muted>Check your APS, see Plan A and Plan B, and find funding and work — right now.</Body>
      <Card>
        <Title>Keep going as a guest</Title>
        <Body muted>Your marks stay on this phone. Nothing about you is saved on our servers.</Body>
        <Button label="Continue as a guest" onPress={() => router.replace('/(tabs)')} />
      </Card>
      <Card>
        <Title>Save your plan with a parent’s OK</Title>
        <Body muted>To save across phones, track applications and get reminders, a parent or guardian approves by email.</Body>
        <Field label="Parent or guardian’s email" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" inputMode="email" maxLength={254} />
        <Field label="Their name" value={name} onChangeText={setName} maxLength={80} />
        <Body>They are my</Body>
        <View style={{ flexDirection: 'row', gap: space.sm }}>
          <Chip label="Parent" selected={relation === 'parent'} onPress={() => setRelation('parent')} />
          <Chip label="Legal guardian" selected={relation === 'legal_guardian'} onPress={() => setRelation('legal_guardian')} />
        </View>
        <ErrorNote error={send.error} />
        <Button label="Send approval request" onPress={send.run} busy={send.busy} disabled={!name.trim() || !email.trim()} />
        <Body muted>We only use their email to send this request.</Body>
      </Card>
    </>
  );
}

const PURPOSE_TITLES: Record<string, string> = {
  account: 'Save my account',
  ai_explanations: 'Explain my results with AI',
  ai_writing: 'Help me write a CV or letter',
  reminders: 'Deadline reminders by email',
  nbt_results: 'Use my NBT results',
};

function Consents({ me }: { me: MeDetail }) {
  const { accessToken } = useSession();
  const colors = useColors();
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
      <Heading>You decide what we use</Heading>
      <Body muted>Change any of these later in Settings.</Body>
      {me.reconfirm.length > 0 && (
        <>
          <Body>Your guardian made these choices when you were 17. Now you’re 18, so please confirm each one yourself.</Body>
          {me.reconfirm.map((purpose) => (
            <Button
              key={purpose}
              label={`Confirm ${purpose.replace('_', ' ')}`}
              busy={pending === purpose}
              onPress={() => toggle(purpose, true)}
            />
          ))}
        </>
      )}
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
              <Title>{PURPOSE_TITLES[purpose] ?? purpose}</Title>
              {purpose === 'account' && <Body muted>Needed to save</Body>}
              <Body muted>{text}</Body>
            </View>
            {purpose !== 'account' && (
              <Switch
                accessibilityLabel={PURPOSE_TITLES[purpose] ?? purpose}
                value={me.consents.includes(purpose)}
                disabled={pending !== null}
                onValueChange={(on) => toggle(purpose, on)}
              />
            )}
          </View>
        </Card>
      ))}
      {!me.consents.includes('account') && (
        <Button
          label="Agree and continue"
          busy={pending === 'account'}
          disabled={pending !== null}
          onPress={() => toggle('account', true)}
        />
      )}
      <Pressable accessibilityRole="link" onPress={() => router.push('/privacy')} style={{ minHeight: touchTarget, justifyContent: 'center', alignItems: 'center' }}>
        <Text style={{ fontFamily: font.regular, fontSize: text.small, color: colors.ink, textDecorationLine: 'underline' }}>Read the full privacy notice</Text>
      </Pressable>
      <ErrorNote error={error} />
    </>
  );
}


// Three segments across the top of the onboarding steps, filled up to the current step.
function StepBar({ step }: { step: 1 | 2 | 3 }) {
  const colors = useColors();
  return (
    <View style={{ flexDirection: 'row', gap: space.sm }}>
      {[1, 2, 3].map((n) => (
        <View key={n} style={{ flex: 1, height: 4, borderRadius: 2, backgroundColor: n <= step ? colors.ink : colors.border }} />
      ))}
    </View>
  );
}

function Interests({ onDone }: { onDone: () => void }) {
  const { accessToken } = useSession();
  const colors = useColors();
  const queryClient = useQueryClient();
  const fields = useFields();
  const me = useMe();
  const [picked, setPicked] = useState<string[]>([]);
  const save = useAction(async () => {
    await saveProfile(accessToken, { birth_date: me.data?.birth_date ?? '', interests: picked });
    await queryClient.invalidateQueries({ queryKey: ['me-details'] });
    onDone();
  });

  function toggle(id: string) {
    setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : p.length < 3 ? [...p, id] : p));
  }

  const topLevel = (fields.data ?? []).filter((f) => f.parent_id === null);
  return (
    <>
      <StepBar step={2} />
      <Heading>What would you enjoy?</Heading>
      <Body muted>Pick up to 3. This only changes the order of results — never what you qualify for.</Body>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {topLevel.map((f) => (
          <Chip key={f.id} label={f.name} selected={picked.includes(f.id)} onPress={() => toggle(f.id)} />
        ))}
      </View>
      <Body muted>{picked.length} of 3 picked</Body>
      <ErrorNote error={save.error} />
      <Button label="Continue" onPress={save.run} busy={save.busy} disabled={picked.length === 0} />
      <Pressable accessibilityRole="button" onPress={onDone} style={{ minHeight: touchTarget, justifyContent: 'center', alignItems: 'center' }}>
        <Text style={{ fontFamily: font.regular, fontSize: text.small, color: colors.ink, textDecorationLine: 'underline' }}>Not sure yet — skip</Text>
      </Pressable>
    </>
  );
}

export default function Onboarding() {
  const { status } = useSession();
  const me = useMe();
  const [tooYoung, setTooYoung] = useState(false);
  const [interestsDone, setInterestsDone] = useState(false);

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
  // A learner who already finished setup comes back to Home, not the consent screen.
  if (me.data?.status === 'active' && me.data.birth_date && me.data.interests.length > 0) {
    return <Redirect href="/(tabs)" />;
  }
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
      ) : !interestsDone && me.data.interests.length === 0 ? (
        <Interests onDone={() => setInterestsDone(true)} />
      ) : (
        <>
          <Consents me={me.data} />
          {me.data.status === 'active' && (
            <>
              <StepBar step={3} />
              <Heading>Add your marks</Heading>
              <Body muted>Add your marks so we can match you. You can change them any time.</Body>
              <Button label="Add my marks" onPress={() => router.replace('/my-marks')} />
              <Button label="Go to my home" onPress={() => router.replace('/(tabs)')} />
            </>
          )}
        </>
      )}
    </Screen>
  );
}
