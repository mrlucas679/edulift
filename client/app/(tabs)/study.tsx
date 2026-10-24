import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';

import { font, space, text, touchTarget, useColors } from '../../src/theme';

import { useInstitutions, useProgrammes } from '../../src/reference';
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
  const institutions = useInstitutions();
  const programmes = useProgrammes({ q, field: 'it', qualification: level ?? undefined });

  return (
    <Screen>
      <Heading>Study</Heading>
      <Card>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <View style={{ flex: 1 }}>
            <Title>APS 32 at most universities</Title>
            <Body muted>Wits and UCT count differently</Body>
          </View>
          <Pressable accessibilityRole="link" onPress={() => router.push('/scores')} style={{ minHeight: touchTarget, justifyContent: 'center' }}>
            <Body>My scores</Body>
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
      <Body muted>IT COURSES · {programmes.data?.items.length ?? 0}</Body>

      <QueryState query={programmes} empty={programmes.data?.items.length === 0}>
        {programmes.data?.items.map((p) => (
          <Card key={p.id} label={p.name} onPress={() => router.push(`/programme/${p.id}`)}>
            <Title>{p.name}</Title>
            <Body muted>
              {LEVELS[p.qualification] ?? p.qualification} · {p.institution_id.toUpperCase()}
            </Body>
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
