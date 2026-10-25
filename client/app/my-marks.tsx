import { useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { saveMarks, useMe } from '../src/account';
import { resolveSubjects, toMarks, type Row } from '../src/marks';
import { useSubjectNames, useSubjects } from '../src/reference';
import { SubjectSuggestions } from '../src/subject-suggest';
import { NBT_COMPONENTS, NBT_LEVELS, removeNbtLevel, saveNbtLevel, useNbt, type NbtComponent, type NbtLevel } from '../src/nbt';
import { PERIODS, useSavedMarks } from '../src/saved-marks';
import { useSession } from '../src/session';
import { font, space, text, touchTarget, useColors } from '../src/theme';
import { Body, Button, ErrorNote, Field, Heading, QueryState, Screen, Title } from '../src/ui';

type PeriodId = (typeof PERIODS)[number]['id'];

export default function MyMarks() {
  const { accessToken } = useSession();
  const saved = useSavedMarks();
  const queryClient = useQueryClient();
  const colors = useColors();
  const [period, setPeriod] = useState<PeriodId>('gr12_june');
  const [edits, setEdits] = useState<Partial<Record<PeriodId, Row[]>>>({});
  const saved_ = saved.data?.[period];
  const fromServer: Row[] = saved_
    ? Object.entries(saved_).map(([subject, percent]) => ({ subject, percent: String(percent) }))
    : [{ subject: '', percent: '' }];
  const rows = edits[period] ?? fromServer;
  const setRows = (next: Row[]) => setEdits({ ...edits, [period]: next });
  const subjectNames = useSubjectNames();
  const subjectList = useSubjects();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [done, setDone] = useState(false);

  function update(index: number, patch: Partial<Row>) {
    setRows(rows.map((r, i) => (i === index ? { ...r, ...patch } : r)));
    setDone(false);
  }

  async function save() {
    setBusy(true);
    setError(null);
    try {
      await saveMarks(accessToken, period, toMarks(resolveSubjects(rows, subjectNames.data ?? new Map())));
      setDone(true);
      await queryClient.invalidateQueries({ queryKey: ['saved-marks'] });
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen>
      <Heading>My marks</Heading>
      <Body muted>Newest results are used for matching. Older ones are kept so you can compare.</Body>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
        {PERIODS.map((p) => {
          const selected = period === p.id;
          return (
            <Pressable
              key={p.id}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              onPress={() => setPeriod(p.id)}
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
                {p.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <QueryState query={saved}>
        <Title>Subjects</Title>
        {rows.map((row, i) => (
          <View key={i} style={{ flexDirection: 'row', gap: space.sm, alignItems: 'flex-end' }}>
            <View style={{ flex: 2 }}>
              <Field label="Subject" value={row.subject} onChangeText={(v) => update(i, { subject: v })} maxLength={60} />
              <SubjectSuggestions all={subjectList.data} typed={row.subject} onPick={(name) => update(i, { subject: name })} />
            </View>
            <View style={{ flex: 1 }}>
              <Field
                label="Mark %"
                value={row.percent}
                onChangeText={(v) => update(i, { percent: v.replace(/[^0-9]/g, '').slice(0, 3) })}
                keyboardType="number-pad"
                maxLength={3}
              />
            </View>
          </View>
        ))}
        <Button label="Add a subject" onPress={() => setRows([...rows, { subject: '', percent: '' }])} />
        <Button label={done ? 'Saved' : 'Save marks'} busy={busy} disabled={done} onPress={save} />
        <ErrorNote error={error} />
        <Body muted>Saving updates your scores and Plan B straight away.</Body>
      </QueryState>
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
      <Title>NBT results (optional)</Title>
      {!on ? (
        <>
          <Body muted>
            Some admission rules need your NBT levels. Turn this on in Settings to add them. Without them, those rules show as unconfirmed.
          </Body>
          <Button label="Open settings" onPress={() => router.push('/settings')} />
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
