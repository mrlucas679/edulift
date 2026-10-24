import { router } from 'expo-router';
import { useEffect, useState } from 'react';

import { useInstitutions, useProgrammes } from '../../src/reference';
import { KindChips } from '../../src/opportunity-views';
import { Body, Button, Card, Empty, Field, Heading, QueryState, Screen, Title } from '../../src/ui';

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
  const institutions = useInstitutions();
  const programmes = useProgrammes({ q, field: 'it', qualification: level ?? undefined });

  return (
    <Screen>
      <Heading>Study</Heading>
      <Body muted>Courses and colleges. Your fit with each one is on its page.</Body>
      <Button label="My scores" onPress={() => router.push('/scores')} />

      <Field
        label="Search programmes"
        value={search}
        onChangeText={setSearch}
        maxLength={80}
        placeholder="e.g. computer science"
      />
      <KindChips kinds={Object.keys(LEVELS)} value={level} onChange={setLevel} labels={LEVELS} />
      <Body muted>IT courses{level ? `, ${LEVELS[level]}` : ''}</Body>

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

      <Title>Institutions</Title>
      <QueryState query={institutions}>
        {institutions.data?.map((i) => (
          <Card key={i.id} label={i.name} onPress={() => router.push(`/institution/${i.id}`)}>
            <Title>{i.name}</Title>
            <Body muted>{i.province}</Body>
          </Card>
        ))}
      </QueryState>
    </Screen>
  );
}
