import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Linking, View } from 'react-native';

import { schemeLabel } from '../../src/check-labels';
import { shortDate } from '../../src/dates';
import { useApsPreview } from '../../src/marks-editor';
import { useBatchChecks, useInstitution, useProgrammes } from '../../src/reference';
import { useCurrentMarks } from '../../src/saved-marks';
import { useSession } from '../../src/session';
import { space, useColors } from '../../src/theme';
import { Body, Button, Card, CardTop, Empty, Heading, Pill, QueryState, Row, Screen, Section, SourceLine, Title, hostOf } from '../../src/ui';
import { BANNER, isGood } from '../../src/verdicts';

const ROUTES = { direct: 'Applies directly', cao: 'Applies through CAO', cas: 'Applies through CAS' };
const TYPES: Record<string, string> = {
  university: 'Public university',
  uot: 'University of technology',
  tvet: 'TVET college',
  private: 'Private college',
};

function Logo() {
  const colors = useColors();
  return (
    <View style={{ width: 48, height: 48, borderRadius: 10, borderWidth: 1, borderStyle: 'dashed', borderColor: colors.border, alignItems: 'center', justifyContent: 'center' }}>
      <Body muted small>Logo</Body>
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
  const score = useApsPreview(useCurrentMarks()).data?.find((r) => r.institution_id === id)?.score ?? null;
  const [loadedAt] = useState(() => Date.now());
  const items = [...(programmes.data?.items ?? [])].sort(
    (a, b) => Number(isGood(outcomeOf.get(b.id) ?? '')) - Number(isGood(outcomeOf.get(a.id) ?? '')),
  );
  const d = inst.data;
  const short = id.toUpperCase();

  return (
    <Screen
      title="University"
      footer={d && <Button label={`Open ${short}’s application site`} sub={hostOf(d.apply_url)} onPress={() => Linking.openURL(d.apply_url)} />}
    >
      <QueryState query={inst}>
        {d && (() => {
          const cycle = d.cycles[0];
          const days = cycle ? Math.ceil((new Date(cycle.closes_on).getTime() - loadedAt) / 86_400_000) : null;
          const fee = d.fee_cents === null || d.fee_cents === 0 ? 'Free online' : `R${(d.fee_cents / 100).toFixed(0)}`;
          return (
            <>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
                <Logo />
                <View style={{ flex: 1 }}>
                  <Heading>{d.name}</Heading>
                  <Body muted small>{TYPES[d.type] ?? d.type} · {d.province}</Body>
                </View>
              </View>
              <View style={{ flexDirection: 'row', gap: space.sm, flexWrap: 'wrap' }}>
                {days !== null && <Pill label={days > 0 ? `Open · ${days} days left` : 'Closed'} filled={days > 0} />}
                <Pill label={ROUTES[d.route]} />
              </View>

              <Card>
                <Title>How to apply for {cycle?.intake_year ?? 'next year'}</Title>
                <Row label="Where" value={d.route === 'direct' ? `${short}’s own website` : 'Central application service'} />
                <Row label="Fee" value={fee} />
                <Row label="Choices" value={d.max_choices ? `${d.max_choices}, can’t change later` : 'Not limited'} />
                <Row label="Closes" value={cycle ? shortDate(cycle.closes_on) : 'Not published'} />
              </Card>

              {d.aps_scheme && (
                <Card muted onPress={() => router.push('/scores')} label="Open my scores">
                  <Title>How {short} scores you</Title>
                  <Body muted small>
                    {schemeLabel(d.aps_scheme)}.{score !== null ? ` Your score here: ${score}.` : ' Add your marks to see your score here.'}
                  </Body>
                </Card>
              )}
              {d.cycles.length === 0 && <Empty message="Dates not loaded yet. Check the institution's site." />}
            </>
          );
        })()}
      </QueryState>

      <Section>Your matches at {short} · {items.length}</Section>
      <QueryState query={programmes} empty={items.length === 0}>
        {items.map((p) => {
          const outcome = outcomeOf.get(p.id);
          return (
            <Card key={p.id} label={p.name} onPress={() => router.push(`/programme/${p.id}`)}>
              <CardTop title={p.name} pill={outcome ? BANNER[outcome] : undefined} filled={outcome ? isGood(outcome) : false} />
            </Card>
          );
        })}
      </QueryState>
      {items.length === 0 && <Empty message="No courses loaded yet for this institution." />}
      {d && <SourceLine source={d.source} />}
    </Screen>
  );
}
