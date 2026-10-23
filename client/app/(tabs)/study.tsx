import { router } from 'expo-router';
import { useEffect, useState } from 'react';

import { useInstitutions, useProgrammes } from '../../src/reference';
import { Body, Card, Empty, Field, Heading, QueryState, Screen, Title } from '../../src/ui';

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
  const q = useDebounced(search.trim());
  const institutions = useInstitutions();
  const programmes = useProgrammes({ q });

  return (
    <Screen>
      <Heading>Study</Heading>
      <Field
        label="Search programmes"
        value={search}
        onChangeText={setSearch}
        maxLength={80}
        placeholder="e.g. computer science"
      />

      {q ? (
        <QueryState query={programmes} empty={programmes.data?.items.length === 0}>
          {programmes.data?.items.map((p) => (
            <Card key={p.id} label={p.name} onPress={() => router.push(`/programme/${p.id}`)}>
              <Title>{p.name}</Title>
              <Body muted>{p.institution_id.toUpperCase()}</Body>
            </Card>
          ))}
        </QueryState>
      ) : (
        <>
          <Title>Institutions</Title>
          <QueryState query={institutions}>
            {institutions.data?.map((i) => (
              <Card key={i.id} label={i.name} onPress={() => router.push(`/institution/${i.id}`)}>
                <Title>{i.name}</Title>
                <Body muted>{i.province}</Body>
              </Card>
            ))}
          </QueryState>
        </>
      )}
      {q !== '' && programmes.data?.items.length === 0 && (
        <Empty message="No programmes match that yet. Try another word." />
      )}
    </Screen>
  );
}
