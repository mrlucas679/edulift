import { router, useLocalSearchParams } from 'expo-router';

import { useInstitution, useProgrammes } from '../../src/reference';
import { Body, Card, Empty, ExternalLink, Heading, QueryState, Screen, SourceLine, Title } from '../../src/ui';

const ROUTES = { direct: 'Apply directly', cao: 'Apply through the CAO', cas: 'Apply through CAS' };

export default function InstitutionScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const inst = useInstitution(id);
  const programmes = useProgrammes({ institution: id });

  return (
    <Screen>
      <QueryState query={inst}>
        {inst.data && (
          <>
            <Heading>{inst.data.name}</Heading>
            <Body muted>
              {inst.data.province} · {ROUTES[inst.data.route]}
            </Body>
            <ExternalLink url={inst.data.apply_url} />
            <SourceLine source={inst.data.source} />

            <Title>Application windows</Title>
            {inst.data.cycles.length === 0 ? (
              <Empty message="Dates not loaded yet. Check the institution's site." />
            ) : (
              inst.data.cycles.map((c) => (
                <Card key={c.intake_year}>
                  <Body>
                    {c.intake_year} intake: {c.opens_on} to {c.closes_on}
                  </Body>
                  <SourceLine source={c.source} />
                </Card>
              ))
            )}
          </>
        )}
      </QueryState>

      <Title>Programmes</Title>
      <QueryState query={programmes} empty={programmes.data?.items.length === 0}>
        {programmes.data?.items.map((p) => (
          <Card key={p.id} label={p.name} onPress={() => router.push(`/programme/${p.id}`)}>
            <Body>{p.name}</Body>
          </Card>
        ))}
      </QueryState>
      {programmes.data?.items.length === 0 && (
        <Empty message="No programmes loaded yet for this institution." />
      )}
    </Screen>
  );
}
