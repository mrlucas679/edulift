import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { toMarks, useMarks } from '../src/marks';
import { previewAps, useSubjects } from '../src/reference';
import { space, text, useColors } from '../src/theme';
import { Body, Button, Card, ErrorNote, Field, Heading, Screen, Title } from '../src/ui';

const MIN_SUBJECTS = 7; // six plus Life Orientation

export default function ApsCalculator() {
  const colors = useColors();
  const subjects = useSubjects();
  const [rows, setRows] = useMarks();
  const [filter, setFilter] = useState('');
  const preview = useMutation({ mutationFn: previewAps });

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
      <Body muted>Try your marks without an account. Nothing is saved.</Body>

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
        label="Work out my score"
        onPress={() => preview.mutate(marks)}
        busy={preview.isPending}
        disabled={!ready}
      />
      <ErrorNote error={preview.error} />

      {preview.data?.map((p) => (
        <Card key={p.institution_id}>
          <Title>{p.institution}</Title>
          <Body muted>
            {p.score === null ? 'Check your score on their site.' : `Your score: ${p.score}`}
          </Body>
        </Card>
      ))}
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
  option: { fontSize: text.body, paddingVertical: space.sm },
  remove: { fontSize: text.small, paddingVertical: space.md },
});
