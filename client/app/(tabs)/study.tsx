import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';

import { font, space, text, touchTarget, useColors } from '../../src/theme';

import { useMe } from '../../src/account';
import { useBatchChecks, useInstitutions, useProgrammes } from '../../src/reference';
import { useSession } from '../../src/session';
import { KindChips } from '../../src/opportunity-views';
import { Body, Card, Empty, Field, Heading, QueryState, Screen, Title } from '../../src/ui';

const LEVELS: Record<string, string> = {
  degree: 'Degree',
  diploma: 'Diploma',
  higher_certificate: 'Higher certificate',
  nc_v: 'NC(V)',
};

function useDebounced(value: string, ms = 300) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return debounced;
}

export default function Study() {
  const [search, setSearch] = useState('');
  const [level, setLevel] = useState<string | null>(null);
  const q = useDebounced(search.trim());
  const colors = useColors();
  const { status, accessToken } = useSession();
  const me = useMe();
  const lowData = me.data?.consents.includes('low_data') ?? false;
  const batch = useBatchChecks(status === 'signed-in' && !lowData ? accessToken : null);
  const outcomeOf = new Map((batch.data ?? []).map((r) => [r.programme_id, r.outcome]));
  const BADGE: Record<string, string> = {
    qualifies: 'You qualify',
    qualifies_selection: 'You qualify',
    qualifies_unconfirmed: 'Check',
    aps_only: 'Subjects short',
    subjects_only: 'Score short',
    not_eligible: 'Not eligible',
  };
  const institutions = useInstitutions();
  // IT is the default. Typing a search looks across every field.
  const programmes = useProgrammes({ q, field: q ? undefined : 'it', qualification: level ?? undefined });

  return (
    <Screen>
      <Heading>Study</Heading>
      <Card>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: space.sm }}>
          <View style={{ flexGrow: 1, flexShrink: 1, minWidth: 180 }}>
            <Title>APS 32 at most universities</Title>
            <Body muted>Wits and UCT count differently</Body>
          </View>
          <Pressable accessibilityRole="link" onPress={() => router.push('/scores')} style={{ minHeight: touchTarget, justifyContent: 'center' }}>
            <Body>My scores</Body>
          </Pressable>
          <Pressable accessibilityRole="link" onPress={() => router.push('/ask')} style={{ minHeight: touchTarget, justifyContent: 'center' }}>
            <Body>Ask a question about your options</Body>
          </Pressable>
        </View>
      </Card>

      <Field
        label="Search courses"
        value={search}
        onChangeText={setSearch}
        maxLength={80}
        placeholder="Search courses, e.g. computer science"
      />
      <KindChips kinds={Object.keys(LEVELS)} value={level} onChange={setLevel} labels={LEVELS} />
      <Body muted>{q ? 'COURSES' : 'IT COURSES'} · {programmes.data?.items.length ?? 0}</Body>

      <QueryState query={programmes} empty={programmes.data?.items.length === 0}>
        {(lowData ? programmes.data?.items.slice(0, 10) : programmes.data?.items)?.map((p) => (
          <Card key={p.id} label={p.name} onPress={() => router.push(`/programme/${p.id}`)}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: space.sm }}>
              <View style={{ flex: 1 }}>
                <Title>{p.name}</Title>
                <Body muted>
                  {LEVELS[p.qualification] ?? p.qualification} · {p.institution_id.toUpperCase()}
                </Body>
              </View>
              {outcomeOf.get(p.id) && BADGE[outcomeOf.get(p.id) ?? ''] && (
                <Text style={{ fontFamily: font.bold, fontSize: text.small, color: colors.ink, borderWidth: 1, borderColor: colors.border, borderRadius: 999, paddingHorizontal: space.sm, paddingVertical: 2 }}>
                  {BADGE[outcomeOf.get(p.id) ?? '']}
                </Text>
              )}
            </View>
          </Card>
        ))}
      </QueryState>
      {programmes.data?.items.length === 0 && (
        <Empty message="No programmes match that yet. Try another word or level." />
      )}

      <Body muted>INSTITUTIONS</Body>
      <QueryState query={institutions}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.sm }}>
          {institutions.data?.map((i) => (
            <Pressable
              key={i.id}
              accessibilityRole="button"
              accessibilityLabel={i.name}
              onPress={() => router.push(`/institution/${i.id}`)}
              style={{
                minHeight: touchTarget,
                paddingHorizontal: space.lg,
                justifyContent: 'center',
                borderRadius: 999,
                borderWidth: 1,
                borderColor: colors.border,
                backgroundColor: colors.surface,
              }}
            >
              <Text style={{ fontFamily: font.bold, fontSize: text.small, color: colors.ink }}>{i.id.toUpperCase()}</Text>
            </Pressable>
          ))}
        </ScrollView>
      </QueryState>
    </Screen>
  );
}
