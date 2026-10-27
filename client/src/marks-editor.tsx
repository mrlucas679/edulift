import Ionicons from '@expo/vector-icons/Ionicons';
import { useQuery } from '@tanstack/react-query';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { resolveSubjects, toMarks, type Row } from './marks';
import { previewAps, useSubjectNames, useSubjects, type PreviewRow } from './reference';
import { SubjectSuggestions } from './subject-suggest';
import { font, radius, space, text, touchTarget, useColors } from './theme';
import { Body, Button, Card, ErrorNote, Title } from './ui';

export const MIN_SUBJECTS = 7; // six plus Life Orientation

// Seven empty rows: a full matric, so nobody taps "Add a subject" six times.
export const blankRows = (): Row[] => Array.from({ length: MIN_SUBJECTS }, () => ({ subject: '', percent: '' }));

// Subject + mark rows, used by onboarding, My marks and the APS calculator.
export function MarksEditor({ rows, setRows }: { rows: Row[]; setRows: (rows: Row[]) => void }) {
  const colors = useColors();
  const names = useSubjectNames();
  const subjects = useSubjects();
  // Saved marks arrive keyed by id; show the subject's name.
  const shown = (s: string) => names.data?.get(s) ?? s;
  const update = (i: number, patch: Partial<Row>) => setRows(rows.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  const input = [styles.input, { color: colors.ink, backgroundColor: colors.surface, borderColor: colors.border }];

  return (
    <>
      <View style={styles.row}>
        <View style={styles.grow}><Body muted small>Subject</Body></View>
        <View style={styles.mark}><Body muted small>Mark %</Body></View>
        <View style={styles.x} />
      </View>
      {rows.map((r, i) => (
        <View key={i}>
          <View style={styles.row}>
            <TextInput
              accessibilityLabel={`Subject ${i + 1}`}
              value={shown(r.subject)}
              onChangeText={(v) => update(i, { subject: v })}
              placeholder="e.g. Mathematics"
              placeholderTextColor={colors.inkMuted}
              maxLength={60}
              style={[input, styles.grow]}
            />
            <TextInput
              accessibilityLabel={`Mark for ${shown(r.subject) || `subject ${i + 1}`}`}
              value={r.percent}
              onChangeText={(v) => {
                const digits = v.replace(/\D/g, '').slice(0, 3);
                if (digits === '' || Number(digits) <= 100) update(i, { percent: digits });
              }}
              keyboardType="number-pad"
              inputMode="numeric"
              maxLength={3}
              style={[input, styles.mark]}
            />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Remove ${shown(r.subject) || `subject ${i + 1}`}`}
              onPress={() => setRows(rows.filter((_, j) => j !== i))}
              style={styles.x}
            >
              <Ionicons name="close" size={18} color={colors.inkMuted} />
            </Pressable>
          </View>
          <SubjectSuggestions all={subjects.data} typed={shown(r.subject)} onPick={(name) => update(i, { subject: name })} />
        </View>
      ))}
      <Button label="+ Add a subject" variant="dashed" onPress={() => setRows([...rows, { subject: '', percent: '' }])} />
    </>
  );
}

// The rows as the API wants them: subject ids and numbers.
export function useResolvedMarks(rows: Row[]): Record<string, number> {
  const names = useSubjectNames();
  return toMarks(resolveSubjects(rows, names.data ?? new Map()));
}

export function useApsPreview(marks: Record<string, number>) {
  return useQuery({
    queryKey: ['aps-preview', marks],
    queryFn: () => previewAps(marks),
    enabled: Object.keys(marks).length >= MIN_SUBJECTS,
  });
}

export function scoreFor(rows: PreviewRow[] | undefined, scheme: string): number | null {
  return rows?.find((r) => r.scheme === scheme && r.score !== null)?.score ?? null;
}

// "APS 32 at most universities", worked out from the marks as they're typed.
export function ApsSummary({ marks, full }: { marks: Record<string, number>; full?: boolean }) {
  const preview = useApsPreview(marks);
  const count = Object.keys(marks).length;
  if (count < MIN_SUBJECTS) {
    return (
      <Card muted>
        <Body muted small>Add at least {MIN_SUBJECTS} subjects, including Life Orientation, to see your APS.</Body>
      </Card>
    );
  }
  if (preview.error) return <ErrorNote error={preview.error} />;
  const aps = scoreFor(preview.data, 'standard_best6');
  if (!full) {
    return (
      <Card muted>
        <Title>{aps === null ? 'Working out your APS…' : `APS ${aps} at most universities`}</Title>
        <Body muted small>Best 6 subjects, Life Orientation not counted. Wits and UCT score differently — see My scores.</Body>
      </Card>
    );
  }
  const wits = scoreFor(preview.data, 'wits_best7');
  const uct = scoreFor(preview.data, 'uct_fps');
  const line = (label: string, value: string) => (
    <View style={styles.summary}>
      <Body muted small>{label}</Body>
      <Title>{value}</Title>
    </View>
  );
  return (
    <Card muted>
      {line('Most universities · best 6, no LO', aps === null ? '—' : `${aps} / 42`)}
      {line('Wits · best 7 incl. LO, bonuses', wits === null ? '—' : String(wits))}
      {line('UCT · % points, best 6', uct === null ? '—' : `${uct} / 600`)}
    </Card>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  grow: { flex: 1 },
  mark: { width: 72, textAlign: 'center' },
  x: { width: 28, minHeight: touchTarget, alignItems: 'center', justifyContent: 'center' },
  input: {
    minHeight: touchTarget,
    borderWidth: 1,
    borderRadius: radius.card,
    paddingHorizontal: space.md,
    fontFamily: font.regular,
    fontSize: text.body,
  },
  summary: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: space.xs },
});
