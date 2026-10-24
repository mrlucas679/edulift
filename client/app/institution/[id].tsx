import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Linking, Pressable, Text, View } from 'react-native';

import { useBatchChecks, useInstitution, useProgrammes } from '../../src/reference';
import { useSession } from '../../src/session';
import { font, space, text, touchTarget, useColors } from '../../src/theme';
import { Body, Button, Card, Empty, QueryState, Screen, SourceLine, Title } from '../../src/ui';

const ROUTES = { direct: 'Applies directly', cao: 'Applies through CAO', cas: 'Applies through CAS' };
const TYPES = { university: 'Public university', uot: 'University of technology', tvet: 'TVET college', private: 'Private college' };
const BADGE: Record<string, string> = {
  qualifies: 'You qualify',
  qualifies_selection: 'You qualify',
  qualifies_unconfirmed: 'Check',
  aps_only: 'Subjects short',
  subjects_only: 'Score short',
  not_eligible: 'Not eligible',
};

function Pill({ label, dark }: { label: string; dark?: boolean }) {
  const colors = useColors();
  return (
    <Text
      style={{
        fontFamily: font.bold,
        fontSize: text.small,
        color: dark ? colors.paper : colors.ink,
        backgroundColor: dark ? colors.ink : colors.surface,
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: 999,
        paddingHorizontal: space.md,
        paddingVertical: space.xs,
        overflow: 'hidden',
      }}
    >
      {label}
    </Text>
  );
}

function Line({ label, value }: { label: string; value: string }) {
  const colors = useColors();
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: space.sm, gap: space.md }}>
      <Text style={{ fontFamily: font.regular, fontSize: text.body, color: colors.ink }}>{label}</Text>
      <Text style={{ fontFamily: font.regular, fontSize: text.small, color: colors.inkMuted, flexShrink: 1, textAlign: 'right' }}>{value}</Text>
    </View>
  );
}

export default function InstitutionScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const inst = useInstitution(id);
  const programmes = useProgrammes({ institution: id });
  const { status, accessToken } = useSession();
  const batch = useBatchChecks(status === 'signed-in' ? accessToken : null);
  const outcomeOf = new Map((batch.data ?? []).map((r) => [r.programme_id, r.outcome]));
  const colors = useColors();
  const [loadedAt] = useState(() => Date.now());

  return (
    <Screen>
      <QueryState query={inst}>
        {inst.data && (() => {
          const cycle = inst.data.cycles[0];
          const days = cycle ? Math.ceil((new Date(cycle.closes_on).getTime() - loadedAt) / 86_400_000) : null;
          const fee = inst.data.fee_cents === null ? 'Free online' : `R${(inst.data.fee_cents / 100).toFixed(0)}`;
          return (
            <>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
                <View style={{ width: 48, height: 48, borderRadius: 10, borderWidth: 1, borderStyle: 'dashed', borderColor: colors.border, alignItems: 'center', justifyContent: 'center' }}>
                  <Body muted>Logo</Body>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontFamily: font.bold, fontSize: text.h3, color: colors.ink }}>{inst.data.name}</Text>
                  <Body muted>
                    {TYPES[inst.data.type as keyof typeof TYPES] ?? inst.data.type} · {inst.data.province}
                  </Body>
                </View>
              </View>
              <View style={{ flexDirection: 'row', gap: space.sm, flexWrap: 'wrap' }}>
                {days !== null && <Pill label={days > 0 ? `Open · ${days} days left` : 'Closed'} dark />}
                <Pill label={ROUTES[inst.data.route]} />
              </View>

              <Card>
                <Title>How to apply for {cycle?.intake_year ?? 'next year'}</Title>
                <Line label="Where" value={inst.data.route === 'direct' ? `${inst.data.name}'s own website` : 'Central application service'} />
                <Line label="Fee" value={fee} />
                <Line label="Choices" value={inst.data.max_choices ? `${inst.data.max_choices}, can't change later` : 'Not limited'} />
                <Line label="Closes" value={cycle ? cycle.closes_on : 'Not published'} />
              </Card>
              <Button label={`Open ${inst.data.name}'s application site`} onPress={() => Linking.openURL(inst.data.apply_url)} />

              {inst.data.aps_scheme && (
                <Card>
                  <Title>How {inst.data.name} scores you</Title>
                  <Body muted>We show each university’s own score on the My scores page.</Body>
                  <Pressable accessibilityRole="link" onPress={() => router.push('/scores')} style={{ minHeight: touchTarget, justifyContent: 'center' }}>
                    <Body>See my score</Body>
                  </Pressable>
                </Card>
              )}

              {inst.data.cycles.length === 0 && <Empty message="Dates not loaded yet. Check the institution's site." />}
              <SourceLine source={inst.data.source} />
            </>
          );
        })()}
      </QueryState>

      <Body muted>YOUR MATCHES AT {inst.data?.name.toUpperCase() ?? ''} · {programmes.data?.items.length ?? 0}</Body>
      <QueryState query={programmes} empty={programmes.data?.items.length === 0}>
        {programmes.data?.items.map((p) => {
          const label = BADGE[outcomeOf.get(p.id) ?? ''];
          return (
            <Card key={p.id} label={p.name} onPress={() => router.push(`/programme/${p.id}`)}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: space.sm }}>
                <Body>{p.name}</Body>
                {label && <Pill label={label} />}
              </View>
            </Card>
          );
        })}
      </QueryState>
      {programmes.data?.items.length === 0 && <Empty message="No programmes loaded yet for this institution." />}
    </Screen>
  );
}
