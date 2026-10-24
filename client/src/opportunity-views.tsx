import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import type { Matched, Opportunity } from './opportunities';
import { KIND_LABELS } from './opportunities';
import { font, radius, space, text, touchTarget, useColors } from './theme';
import { Body, Card, Title } from './ui';

export const VERDICT_TEXT = {
  qualifies: 'Meets the criteria we could check',
  may_qualify: 'You may qualify. Confirm with the provider.',
} as const;

export function KindChips({
  kinds,
  value,
  onChange,
  labels = KIND_LABELS,
}: {
  kinds: string[];
  value: string | null;
  onChange: (kind: string | null) => void;
  labels?: Record<string, string>;
}) {
  const colors = useColors();
  const all: (string | null)[] = [null, ...kinds];
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.sm }}>
      {all.map((kind) => {
        const selected = kind === value;
        return (
          <Pressable
            key={kind ?? 'all'}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            onPress={() => onChange(kind)}
            style={[
              styles.chip,
              { borderColor: colors.border, backgroundColor: selected ? colors.accent : colors.surface },
            ]}
          >
            <Text style={{ fontFamily: font.bold, color: selected ? colors.onAccent : colors.ink, fontSize: text.small }}>
              {kind ? labels[kind] ?? kind : 'All'}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

export function OpportunityCard({ item, matched }: { item: Opportunity | Matched; matched?: Matched }) {
  const verdict = matched?.verdict;
  return (
    <Card onPress={() => router.push(`/opportunity/${item.id}`)} label={`Open ${item.name}`}>
      <Title>{item.name}</Title>
      <Body muted>
        {item.provider} · {KIND_LABELS[item.kind] ?? item.kind}
      </Body>
      {verdict && <Body>{VERDICT_TEXT[verdict]}</Body>}
      <OpportunityStatus closesOn={item.closes_on} />
    </Card>
  );
}

// Open, closed or not published, from the closing date, as on the Work wireframe.
export function OpportunityStatus({ closesOn }: { closesOn: string | null }) {
  const colors = useColors();
  const [loadedAt] = useState(() => Date.now());
  if (!closesOn) return <Body muted>Closing date not published</Body>;
  const open = new Date(closesOn).getTime() >= loadedAt;
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
      <Body muted>Closes {closesOn}</Body>
      <Text style={{ fontFamily: font.bold, fontSize: text.small, color: open ? colors.paper : colors.ink, backgroundColor: open ? colors.ink : colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 999, paddingHorizontal: space.sm, overflow: 'hidden' }}>
        {open ? 'Open' : 'Closed'}
      </Text>
    </View>
  );
}

export const scamNotice = 'Real bursaries and jobs are free to apply for. Never pay anyone to apply, and never share banking details.';

export function ScamNotice() {
  const colors = useColors();
  return (
    <View style={[styles.notice, { borderColor: colors.danger }]}>
      <Body>{scamNotice}</Body>
    </View>
  );
}

const styles = StyleSheet.create({
  chip: { minHeight: touchTarget, paddingHorizontal: space.lg, justifyContent: 'center', borderWidth: 1, borderRadius: radius.pill },
  notice: { borderWidth: 2, borderRadius: radius.card, padding: space.lg },
});
