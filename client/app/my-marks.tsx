import { useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { saveMarks, useMe } from '../src/account';
import { type Row } from '../src/marks';
import { ApsSummary, blankRows, MarksEditor, useResolvedMarks } from '../src/marks-editor';
import { NBT_COMPONENTS, NBT_LEVELS, removeNbtLevel, saveNbtLevel, useNbt, type NbtComponent, type NbtLevel } from '../src/nbt';
import { PERIODS, useSavedMarks } from '../src/saved-marks';
import { useSession } from '../src/session';
import { font, space, text, touchTarget, useColors } from '../src/theme';
import { Body, Button, Chips, ErrorNote, QueryState, Screen, Section, Title } from '../src/ui';

type PeriodId = (typeof PERIODS)[number]['id'];

export default function MyMarks() {
  const { accessToken } = useSession();
  const saved = useSavedMarks();
  const queryClient = useQueryClient();
  const me = useMe();
  const [period, setPeriod] = useState<PeriodId>('gr12_june');
  const [edits, setEdits] = useState<Partial<Record<PeriodId, Row[]>>>({});
  const fromServer = saved.data?.[period];
  const rows =
    edits[period] ??
    (fromServer ? Object.entries(fromServer).map(([subject, percent]) => ({ subject, percent: String(percent) })) : blankRows());
  const marks = useResolvedMarks(rows);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [done, setDone] = useState(false);

  async function save() {
    setBusy(true);
    setError(null);
    try {
      await saveMarks(accessToken, period, marks);
      setDone(true);
      await queryClient.invalidateQueries({ queryKey: ['saved-marks'] });
      await queryClient.invalidateQueries({ queryKey: ['plan'] });
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }

  if (me.data && me.data.status !== 'active') {
    return (
      <Screen title="My marks" footer={<Button label="Finish setting up" onPress={() => router.replace('/onboarding')} />}>
        <Body>Finish setting up your account to save marks.</Body>
      </Screen>
    );
  }

  return (
    <Screen
      title="My marks"
      footer={
        <>
          <Body muted small>Saving updates your scores and Plan B straight away.</Body>
          {done ? (
            <Button label="See my plan" onPress={() => router.push('/plan')} />
          ) : (
            <Button label="Save marks" busy={busy} disabled={Object.keys(marks).length === 0} onPress={save} />
          )}
        </>
      }
    >
      <Title>Which results?</Title>
      <Chips options={[...PERIODS]} value={period} onChange={(p) => { setPeriod(p); setDone(false); }} />
      <Body muted small>Newest results are used for matching. Older ones are kept so you can compare.</Body>
      <QueryState query={saved}>
        <MarksEditor rows={rows} setRows={(next) => { setEdits({ ...edits, [period]: next }); setDone(false); }} />
        <ApsSummary marks={marks} />
      </QueryState>
      <ErrorNote error={error} />
      <NbtSection />
    </Screen>
  );
}

function NbtSection() {
  const { accessToken } = useSession();
  const me = useMe();
  const nbt = useNbt();
  const queryClient = useQueryClient();
  const colors = useColors();
  const [error, setError] = useState<unknown>(null);
  const on = me.data?.consents.includes('nbt_results') ?? false;

  async function run(action: () => Promise<unknown>) {
    setError(null);
    try {
      await action();
      await queryClient.invalidateQueries({ queryKey: ['nbt'] });
    } catch (e) {
      setError(e);
    }
  }

  return (
    <>
      <Section>NBT results (optional)</Section>
      {!on ? (
        <>
          <Body muted>
            Some admission rules need your NBT levels. Turn this on in Settings to add them. Without them, those rules show as unconfirmed.
          </Body>
          <Button label="Open settings" variant="secondary" onPress={() => router.push('/settings')} />
        </>
      ) : (
        NBT_COMPONENTS.map((c) => {
          const current = nbt.data?.[c.id];
          return (
            <View key={c.id} style={{ gap: space.sm }}>
              <Body>
                {c.label}: {current ? NBT_LEVELS.find((l) => l.id === current)?.label : 'not added'}
              </Body>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
                {NBT_LEVELS.map((l) => {
                  const selected = current === l.id;
                  return (
                    <Pressable
                      key={l.id}
                      accessibilityRole="button"
                      accessibilityState={{ selected }}
                      onPress={() => run(() => saveNbtLevel(accessToken, c.id as NbtComponent, l.id as NbtLevel))}
                      style={{
                        minHeight: touchTarget,
                        paddingHorizontal: space.lg,
                        justifyContent: 'center',
                        borderRadius: 999,
                        borderWidth: 1,
                        borderColor: colors.border,
                        backgroundColor: selected ? colors.accent : colors.surface,
                      }}
                    >
                      <Text style={{ fontFamily: font.bold, color: selected ? colors.onAccent : colors.ink, fontSize: text.small }}>
                        {l.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
              {current && (
                <Button label={`Remove ${c.label}`} onPress={() => run(() => removeNbtLevel(accessToken, c.id as NbtComponent))} />
              )}
            </View>
          );
        })
      )}
      <ErrorNote error={error} />
    </>
  );
}
