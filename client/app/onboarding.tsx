import { useQueryClient } from '@tanstack/react-query';
import { Redirect, router } from 'expo-router';
import { useState } from 'react';
import { Share, Switch, View } from 'react-native';

import { ApiError } from '../src/api';
import { askGuardian, PURPOSES, saveMarks, saveProfile, setConsent, useMe, type MeDetail } from '../src/account';
import { ApsSummary, blankRows, MarksEditor, useResolvedMarks } from '../src/marks-editor';
import { useMarks, type Row } from '../src/marks';
import { useFields } from '../src/reference';
import { PERIODS } from '../src/saved-marks';
import { useSession } from '../src/session';
import { space } from '../src/theme';
import {
  Body,
  Button,
  Card,
  CardTop,
  Chips,
  ErrorNote,
  Field,
  Heading,
  Loading,
  Screen,
  StepBar,
  Title,
} from '../src/ui';

const PROVINCES = [
  'Eastern Cape', 'Free State', 'Gauteng', 'KwaZulu-Natal', 'Limpopo',
  'Mpumalanga', 'North West', 'Northern Cape', 'Western Cape',
].map((p) => ({ id: p, label: p }));
const CERTIFICATES = [
  { id: 'nsc', label: 'NSC' },
  { id: 'ieb', label: 'IEB' },
  { id: 'sacai', label: 'SACAI' },
] as const;
type Certificate = (typeof CERTIFICATES)[number]['id'];

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

// "2008-03-14" from three boxes, or null until it is a real date.
function toDate(day: string, month: string, year: string): string | null {
  if (year.length !== 4 || !day || !month) return null;
  const iso = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  const d = new Date(`${iso}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().startsWith(iso) ? iso : null;
}

// Step 1: name, birthday, province, certificate. One screen instead of two.
function Basics({ onTooYoung }: { onTooYoung: () => void }) {
  const { accessToken } = useSession();
  const queryClient = useQueryClient();
  const [name, setName] = useState('');
  const [day, setDay] = useState('');
  const [month, setMonth] = useState('');
  const [year, setYear] = useState('');
  const [province, setProvince] = useState<string | null>(null);
  const [certificate, setCertificate] = useState<Certificate | null>(null);
  const birth = toDate(day, month, year);
  // Continue always answers: a greyed-out button gave no reason on a phone.
  const [hint, setHint] = useState<string | null>(null);
  const digits = (v: string, n: number) => v.replace(/\D/g, '').slice(0, n);
  const save = useAction(async () => {
    try {
      await saveProfile(accessToken, { first_name: name.trim(), birth_date: birth ?? '', province, certificate });
      await queryClient.invalidateQueries({ queryKey: ['me-details'] });
    } catch (e) {
      if (e instanceof ApiError && e.code === 'too_young') return onTooYoung();
      throw e;
    }
  });

  return (
    <Screen
      title="About you · step 1 of 3"
      back={false}
      footer={
        <>
          <ErrorNote error={hint ?? save.error} />
          <Button
            label="Continue"
            busy={save.busy}
            onPress={() => {
              setHint(birth ? null : 'Add your birthday as day, month and a 4-digit year, like 14 / 3 / 2008.');
              if (birth) save.run();
            }}
          />
        </>
      }
    >
      <StepBar step={1} />
      <Heading>A few basics</Heading>
      <Field label="First name" value={name} onChangeText={setName} maxLength={60} autoComplete="given-name" />
      <Title>When were you born?</Title>
      <View style={{ flexDirection: 'row', gap: space.sm }}>
        <View style={{ flex: 1 }}>
          <Field label="Day" value={day} onChangeText={(v) => setDay(digits(v, 2))} placeholder="14" inputMode="numeric" maxLength={2} />
        </View>
        <View style={{ flex: 1 }}>
          <Field label="Month" value={month} onChangeText={(v) => setMonth(digits(v, 2))} placeholder="3" inputMode="numeric" maxLength={2} />
        </View>
        <View style={{ flex: 1.3 }}>
          <Field label="Year" value={year} onChangeText={(v) => setYear(digits(v, 4))} placeholder="2008" inputMode="numeric" maxLength={4} />
        </View>
      </View>
      <Card muted>
        <Title>Why we ask for the date, not your age</Title>
        <Body muted small>So the app knows when you turn 18 without asking again. We don’t use it for anything else.</Body>
      </Card>
      <Title>Province you live in</Title>
      <Chips options={PROVINCES} value={province} onChange={setProvince} wrap />
      <Body muted small>Used to show nearby colleges first. We never limit you to one province.</Body>
      <Title>Which certificate are you writing?</Title>
      <Chips options={[...CERTIFICATES]} value={certificate} onChange={setCertificate} wrap />
      <Body muted small>We don’t ask for your ID number, income or race.</Body>
    </Screen>
  );
}

function Guardian() {
  const { accessToken } = useSession();
  const [name, setName] = useState('');
  const [link, setLink] = useState<string | null>(null);
  const send = useAction(async () => {
    setLink((await askGuardian(accessToken, { guardian_name: name.trim() })).link);
  });
  const guest = () => router.replace('/(tabs)');
  const message = `I want to use EduLift to plan my studies. Because I'm under 18, it needs your OK first: ${link}`;

  if (link) {
    return (
      <Screen
        title="Parent approval"
        back={false}
        footer={
          <>
            <Button label="Send the link" onPress={() => Share.share({ message }).catch(() => undefined)} />
            <Button label="Keep using as a guest" variant="secondary" onPress={guest} />
          </>
        }
      >
        <Heading>Send this link to {name.trim()}</Heading>
        <Body muted>Send it on WhatsApp or SMS, or show it to them. When they tap Approve, your account opens and your plan is saved.</Body>
        <Field label="Approval link" value={link} editable={false} selectTextOnFocus />
        <Card>
          <CardTop title="Status" pill="Waiting" />
          <Body muted small>The link works once, for 72 hours.</Body>
        </Card>
        <Card>
          <Title>What happens next</Title>
          <Body small>1. They open the link and read what we store.</Body>
          <Body small>2. They confirm they’re your parent or guardian.</Body>
          <Body small>3. They tap Approve.</Body>
        </Card>
        <Body muted small>Only your parent or guardian may approve. Approving for yourself breaks our terms and the law (POPIA).</Body>
        <ErrorNote error={send.error} />
      </Screen>
    );
  }

  return (
    <Screen title="You’re under 18" back={false}>
      <Heading>You can still use everything</Heading>
      <Body muted>Check your APS, see Plan A and Plan B, and find funding and work — right now.</Body>
      <Card>
        <Title>Keep going as a guest</Title>
        <Body muted small>Your marks stay on this phone. Nothing about you is saved on our servers.</Body>
        <Button label="Continue as a guest" variant="secondary" onPress={guest} />
      </Card>
      <Card>
        <Title>Save your plan with a parent’s OK</Title>
        <Body muted small>To save across phones and track applications, a parent or guardian approves. We give you a link to send them.</Body>
        <Field label="Their name" value={name} onChangeText={setName} maxLength={80} />
        <ErrorNote error={send.error} />
        <Button label="Get the approval link" onPress={send.run} busy={send.busy} disabled={!name.trim()} />
      </Card>
    </Screen>
  );
}

const PURPOSE_TITLES: Record<string, string> = {
  ai_explanations: 'Explain my results with AI',
  ai_writing: 'Help me write a CV or letter',
  nbt_results: 'Use my NBT results',
  low_data: 'Use less data',
};

// Your choices: one required, the rest switched on here if wanted.
function Choices({ me, onAgreed }: { me: MeDetail; onAgreed: () => void }) {
  const { accessToken } = useSession();
  const queryClient = useQueryClient();
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<unknown>(null);
  async function toggle(purpose: string, on: boolean) {
    if (purpose === 'account' && on) onAgreed();
    setPending(purpose);
    setError(null);
    try {
      await setConsent(accessToken, purpose, on);
      await queryClient.invalidateQueries({ queryKey: ['me-details'] });
    } catch (e) {
      setError(e);
    } finally {
      setPending(null);
    }
  }

  return (
    <Screen
      title="Your choices"
      back={false}
      footer={
        <Button
          label="Agree and continue"
          busy={pending === 'account'}
          disabled={pending !== null}
          onPress={() => toggle('account', true)}
        />
      }
    >
      <Heading>You decide what we use</Heading>
      <Body muted>Change any of these later in Settings.</Body>
      {me.reconfirm.length > 0 && (
        <Card muted>
          <Body small>Your guardian made these choices when you were 17. Now you’re 18, so please confirm each one yourself.</Body>
          {me.reconfirm.map((purpose) => (
            <Button key={purpose} variant="secondary" label={`Confirm ${PURPOSE_TITLES[purpose] ?? purpose}`} busy={pending === purpose} onPress={() => toggle(purpose, true)} />
          ))}
        </Card>
      )}
      <Card>
        <CardTop title="Save my account" pill="Needed to save" />
        <Body muted small>{PURPOSES.account}</Body>
      </Card>
      {Object.keys(PURPOSE_TITLES).map((purpose) => (
        <Card key={purpose}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
            <View style={{ flex: 1 }}>
              <Title>{PURPOSE_TITLES[purpose]}</Title>
            </View>
            <Switch
              accessibilityLabel={PURPOSE_TITLES[purpose]}
              value={me.consents.includes(purpose)}
              disabled={pending !== null}
              onValueChange={(on) => toggle(purpose, on)}
            />
          </View>
          <Body muted small>{PURPOSES[purpose]}</Body>
        </Card>
      ))}
      <Button label="Read the full privacy notice" variant="link" onPress={() => router.push('/privacy')} />
      <ErrorNote error={error} />
    </Screen>
  );
}

function Interests({ onDone }: { onDone: () => void }) {
  const { accessToken } = useSession();
  const queryClient = useQueryClient();
  const fields = useFields();
  const me = useMe();
  const [picked, setPicked] = useState<string[]>([]);
  const save = useAction(async () => {
    await saveProfile(accessToken, { birth_date: me.data?.birth_date ?? '', interests: picked });
    await queryClient.invalidateQueries({ queryKey: ['me-details'] });
    onDone();
  });
  const toggle = (id: string) =>
    setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : p.length < 3 ? [...p, id] : p));
  const topLevel = (fields.data ?? []).filter((f) => f.parent_id === null).map((f) => ({ id: f.id, label: f.name }));

  return (
    <Screen
      title="Interests · step 2 of 3"
      back={false}
      footer={
        <>
          <Button label="Continue" onPress={save.run} busy={save.busy} disabled={picked.length === 0} />
          <Button label="Not sure yet — skip" variant="link" onPress={onDone} />
        </>
      }
    >
      <StepBar step={2} />
      <Heading>What would you enjoy?</Heading>
      <Body muted>Pick up to 3. This only changes the order of results — never what you qualify for.</Body>
      <Chips options={topLevel} value={picked} onChange={toggle} wrap />
      <Body muted small>{picked.length} of 3 picked</Body>
      <ErrorNote error={save.error} />
    </Screen>
  );
}

// Step 3: marks typed straight in, with the APS worked out as you go.
function Marks() {
  const { accessToken } = useSession();
  const queryClient = useQueryClient();
  const [typed, setTyped] = useMarks();
  const [rows, setRows] = useState<Row[]>(typed.length ? typed : blankRows());
  const [period, setPeriod] = useState<(typeof PERIODS)[number]['id']>('gr12_june');
  const marks = useResolvedMarks(rows);
  const save = useAction(async () => {
    await saveMarks(accessToken, period, marks);
    setTyped(rows);
    await queryClient.invalidateQueries({ queryKey: ['saved-marks'] });
    router.replace('/plan');
  });

  return (
    <Screen
      title="Your marks · step 3 of 3"
      back={false}
      footer={
        <>
          <Button label="See my options" onPress={save.run} busy={save.busy} disabled={Object.keys(marks).length === 0} />
          <Button label="Add them later" variant="link" onPress={() => router.replace('/(tabs)')} />
        </>
      }
    >
      <StepBar step={3} />
      <Heading>Add your marks</Heading>
      <Title>Which results are these?</Title>
      <Chips options={[...PERIODS]} value={period} onChange={setPeriod} />
      <MarksEditor rows={rows} setRows={setRows} />
      <ApsSummary marks={marks} />
      <ErrorNote error={save.error} />
    </Screen>
  );
}

export default function Onboarding() {
  const { status } = useSession();
  const me = useMe();
  const [tooYoung, setTooYoung] = useState(false);
  const [interestsDone, setInterestsDone] = useState(false);
  // Set when the learner agrees here, so they carry on to interests and marks.
  const [agreedHere, setAgreedHere] = useState(false);

  if (tooYoung) {
    return (
      <Screen title="Not just yet" back={false} footer={<Button label="Browse courses" onPress={() => router.replace('/study')} />}>
        <Heading>Not just yet</Heading>
        <Body>
          EduLift accounts are for people aged 17 and over, so we haven’t kept anything. You can still use
          the APS calculator and browse. Your Life Orientation teacher can help you plan now.
        </Body>
      </Screen>
    );
  }
  if (status !== 'signed-in') return <Redirect href="/sign-in" />;
  if (me.isPending) return <Loading />;
  if (!me.data) {
    return (
      <Screen title="Setting up">
        <ErrorNote error={me.error} />
        <Button label="Try again" onPress={() => me.refetch()} />
      </Screen>
    );
  }
  const d = me.data;
  // Someone who finished setup before comes back to Home.
  if (!agreedHere && d.status === 'active' && d.birth_date) return <Redirect href="/(tabs)" />;
  if (!d.birth_date) return <Basics onTooYoung={() => setTooYoung(true)} />;
  if (d.status === 'pending_guardian' || d.status === 'restricted') return <Guardian />;
  if (!d.consents.includes('account')) return <Choices me={d} onAgreed={() => setAgreedHere(true)} />;
  if (!interestsDone && d.interests.length === 0) return <Interests onDone={() => setInterestsDone(true)} />;
  return <Marks />;
}
