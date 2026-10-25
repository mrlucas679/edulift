import { useMutation } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { toMarks, useMarks } from '../src/marks';
import { saveMarks, useMe } from '../src/account';
import { previewAps, useSubjects } from '../src/reference';
import { useSession } from '../src/session';
import { space, text, useColors } from '../src/theme';
import { Body, Button, Card, ErrorNote, Field, Heading, Screen, Title } from '../src/ui';

const MIN_SUBJECTS = 7; // six plus Life Orientation

type Preview = { scheme: string | null; score: number | null }[];

// Shows "score / maximum" for the first institution on this scheme.
function summaryFor(rows: Preview, scheme: string, max: number | null): string {
  const hit = rows.find((r) => r.scheme === scheme);
  if (!hit || hit.score === null) return 'Not checked yet';
  return max === null ? String(hit.score) : `${hit.score} / ${max}`;
}

function SummaryLine({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.summary}>
      <Body muted>{label}</Body>
      <Title>{value}</Title>
    </View>
  );
}

type Period = 'gr11_final' | 'gr12_june' | 'gr12_prelim' | 'gr12_final';
const PERIODS: [Period, string][] = [
  ['gr11_final', 'Grade 11 final'],
  ['gr12_june', 'Grade 12 June'],
  ['gr12_prelim', 'Grade 12 prelim'],
  ['gr12_final', 'Grade 12 final'],
];

export default function ApsCalculator() {
  const colors = useColors();
  const subjects = useSubjects();
  const [rows, setRows] = useMarks();
  const [filter, setFilter] = useState('');
  const preview = useMutation({ mutationFn: previewAps });
  const { accessToken } = useSession();
  const me = useMe();
  const [period, setPeriod] = useState<Period>('gr11_final');
  const save = useMutation({ mutationFn: () => saveMarks(accessToken, period, toMarks(rows)) });

  const chosen = new Set(rows.map((r) => r.subject));
  const name = (id: string) => subjects.data?.find((s) => s.id === id)?.name ?? id;
  const matches = filter.trim()
    ? (subjects.data ?? [])
        .filter((s) => !chosen.has(s.id) && s.name.toLowerCase().includes(filter.trim().toLowerCase()))
        .slice(0, 6)
    : [];

  const marks = toMarks(rows);
  const ready = Object.keys(marks).length >= MIN_SUBJECTS;

  function setPercent(subject: string, value: string) {
    const digits = value.replace(/\D/g, '').slice(0, 3);
    if (digits !== '' && Number(digits) > 100) return;
    setRows((rs) => rs.map((r) => (r.subject === subject ? { ...r, percent: digits } : r)));
  }

  return (
    <Screen>
      <Heading>APS calculator</Heading>
      <Body muted>No account needed. Nothing you type is saved.</Body>
      <View style={styles.row}>
        <View style={styles.grow}><Body muted>Subject</Body></View>
        <View style={styles.markCol}><Body muted>Mark %</Body></View>
      </View>

      <Field
        label="Add a subject"
        value={filter}
        onChangeText={setFilter}
        placeholder="e.g. Mathematics"
        maxLength={40}
      />
      {matches.map((s) => (
        <Pressable
          key={s.id}
          accessibilityRole="button"
          onPress={() => {
            setRows((rs) => [...rs, { subject: s.id, percent: '' }]);
            setFilter('');
          }}
        >
          <Text style={[styles.option, { color: colors.accent }]}>+ {s.name}</Text>
        </Pressable>
      ))}

      {rows.map((r) => (
        <View key={r.subject} style={styles.row}>
          <View style={styles.grow}>
            <Field
              label={`${name(r.subject)} (%)`}
              value={r.percent}
              onChangeText={(v) => setPercent(r.subject, v)}
              keyboardType="number-pad"
              inputMode="numeric"
              maxLength={3}
            />
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Remove ${name(r.subject)}`}
            onPress={() => setRows((rs) => rs.filter((x) => x.subject !== r.subject))}
          >
            <Text style={[styles.remove, { color: colors.danger }]}>Remove</Text>
          </Pressable>
        </View>
      ))}

      {!ready && <Body muted>Add at least {MIN_SUBJECTS} subjects, including Life Orientation.</Body>}
      <Button
        label="See courses I qualify for"
        onPress={() => {
          preview.mutate(marks);
          router.push('/scores');
        }}
        busy={preview.isPending}
        disabled={!ready}
      />
      <ErrorNote error={preview.error} />

      {preview.data && (
        <Card>
          <SummaryLine
            label="Most universities · best 6, no LO"
            value={summaryFor(preview.data, 'standard_best6', 42)}
          />
          <SummaryLine label="Wits · best 7 incl. LO" value={summaryFor(preview.data, 'wits_best7', null)} />
          <SummaryLine label="UCT · % points, best 6" value={summaryFor(preview.data, 'uct_fps', 600)} />
        </Card>
      )}
      <Pressable accessibilityRole="link" onPress={() => router.push('/help')}>
        <Body>How APS works</Body>
      </Pressable>
      {me.data?.status === 'active' && ready && (
        <>
          <Title>Save these marks</Title>
          {PERIODS.map(([value, label]) => (
            <Button key={value} label={period === value ? `✓ ${label}` : label} onPress={() => setPeriod(value)} />
          ))}
          <Button label="Save to my account" onPress={() => save.mutate()} busy={save.isPending} />
          <ErrorNote error={save.error} />
          {save.isSuccess && <Body muted>Saved.</Body>}
        </>
      )}
      {preview.data && (
        <Body muted>
          Each university counts marks differently. A score is a guide; the institution decides.
        </Body>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-end', gap: space.md },
  grow: { flex: 1 },
  markCol: { width: 96 },
  summary: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: space.sm },
  option: { fontSize: text.body, paddingVertical: space.sm },
  remove: { fontSize: text.small, paddingVertical: space.md },
});
