import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { View } from 'react-native';

import { useMe } from '../../src/account';
import { scoreFor, useApsPreview } from '../../src/marks-editor';
import { useBatchChecks, useFields, useInstitutions, useProgrammes } from '../../src/reference';
import { useCurrentMarks } from '../../src/saved-marks';
import { useSession } from '../../src/session';
import { space } from '../../src/theme';
import { Body, Button, Card, CardTop, Chips, Empty, Field, QueryState, Screen, Section, Title } from '../../src/ui';
import { BANNER, isGood } from '../../src/verdicts';

const LEVELS: Record<string, string> = {
  degree: 'Degree',
  diploma: 'Diploma',
  higher_certificate: 'Higher cert.',
  nc_v: 'TVET',
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
  const { status, accessToken } = useSession();
  const me = useMe();
  const fields = useFields();
  const marks = useCurrentMarks();
  const aps = scoreFor(useApsPreview(marks).data, 'standard_best6');
  const [search, setSearch] = useState('');
  const [level, setLevel] = useState<string | null>(null);
  const [fieldOn, setFieldOn] = useState(true);
  const q = useDebounced(search.trim());
  // The learner's first interest is the default; typing a search looks across every field.
  const field = me.data?.interests[0] ?? 'it';
  const fieldName = fields.data?.find((f) => f.id === field)?.name ?? 'Courses';
  const lowData = me.data?.consents.includes('low_data') ?? false;
  const batch = useBatchChecks(status === 'signed-in' && !lowData ? accessToken : null);
  const outcomeOf = new Map((batch.data ?? []).map((r) => [r.programme_id, r.outcome]));
  const institutions = useInstitutions();
  const programmes = useProgrammes({ q, field: q || !fieldOn ? undefined : field, qualification: level ?? undefined });
  const items = programmes.data?.items ?? [];
  const sorted = [...items].sort((a, b) => Number(isGood(outcomeOf.get(b.id) ?? '')) - Number(isGood(outcomeOf.get(a.id) ?? '')));

  return (
    <Screen title="Study" back={false}>
      <Card muted onPress={() => router.push('/scores')} label="Open my scores">
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
          <View style={{ flex: 1 }}>
            <Title>{aps === null ? 'Add your marks to see your APS' : `APS ${aps} at most universities`}</Title>
            <Body muted small>Wits and UCT count differently</Body>
          </View>
          <Body small>My scores ›</Body>
        </View>
      </Card>
      <Field label="Search" value={search} onChangeText={setSearch} maxLength={80} placeholder="Search courses, e.g. computer science" />
      {/* One row, as on the wireframe: your interest first, then the levels. */}
      <Chips
        options={[{ id: 'field', label: fieldName }, ...Object.entries(LEVELS).map(([id, label]) => ({ id, label }))]}
        value={[...(fieldOn ? ['field'] : []), ...(level ? [level] : [])]}
        onChange={(id) => (id === 'field' ? setFieldOn(!fieldOn) : setLevel(level === id ? null : id))}
      />
      <Section>{q || !fieldOn ? 'Courses' : fieldName} · {items.length}{lowData && items.length > 10 ? ' · showing 10 (low-data)' : ''}</Section>

      <QueryState query={programmes} empty={items.length === 0}>
        {(lowData ? sorted.slice(0, 10) : sorted).map((p) => {
          const outcome = outcomeOf.get(p.id);
          return (
            <Card key={p.id} label={p.name} onPress={() => router.push(`/programme/${p.id}`)}>
              <CardTop title={p.name} pill={outcome ? BANNER[outcome] : undefined} filled={outcome ? isGood(outcome) : false} />
              <Body muted small>
                {p.institution_id.toUpperCase()} · {LEVELS[p.qualification] ?? p.qualification}
              </Body>
            </Card>
          );
        })}
      </QueryState>
      {items.length === 0 && <Empty message="No courses match that yet. Try another word or level." />}

      <Section>Institutions</Section>
      <QueryState query={institutions}>
        <Chips
          options={(institutions.data ?? []).map((i) => ({ id: i.id, label: i.id.toUpperCase() }))}
          value={null}
          onChange={(id) => router.push(`/institution/${id}`)}
          wrap
        />
      </QueryState>
      <Button label="Ask a question about your options" variant="link" onPress={() => router.push('/ask-ai')} />
    </Screen>
  );
}
