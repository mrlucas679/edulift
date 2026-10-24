import { useState } from 'react';
import { Text, View } from 'react-native';
import { useColors, text as textSize } from './theme';

import { useMyOpportunities, useOpportunities, type Matched, type Opportunity } from './opportunities';
import { KindChips, OpportunityCard } from './opportunity-views';
import { useSession } from './session';
import { Body, Empty, Field, QueryState, Screen } from './ui';

export function OpportunityList({
  title,
  kinds,
  intro,
  header,
}: {
  title: React.ReactNode;
  kinds: string[];
  intro: string;
  header?: React.ReactNode;
}) {
  const { status, accessToken } = useSession();
  const signedIn = status === 'signed-in';
  const [kind, setKind] = useState<string | null>(null);
  const mine = useMyOpportunities(null, signedIn ? accessToken : null);
  const browse = useOpportunities(null);
  const query = signedIn ? mine : browse;

  const [search, setSearch] = useState('');
  const colors = useColors();
  const inScope = (item: Opportunity) =>
    kinds.includes(item.kind) &&
    (kind === null || item.kind === kind) &&
    item.name.toLowerCase().includes(search.trim().toLowerCase());
  const matchedById = new Map<string, Matched>((mine.data ?? []).map((m) => [m.id, m]));
  const items = (query.data ?? []).filter(inScope);

  return (
    <Screen>
      {title}
      <Field label="Search" value={search} onChangeText={setSearch} placeholder="Search bursaries, loans, scholarships" maxLength={60} />
      <Body muted>{intro}</Body>
      {header}
      <KindChips kinds={kinds} value={kind} onChange={setKind} />
      <QueryState query={query}>
        {signedIn && items.length > 0 && (
          <View>
            <Text style={{ fontSize: textSize.small, color: colors.inkMuted }}>MATCHES FOR YOU · {items.filter((i) => matchedById.has(i.id)).length}</Text>
          </View>
        )}
        {items.length === 0 && <Empty message="Nothing is listed here yet. We add each one once its page has been checked." />}
        {items.map((item) => (
          <OpportunityCard key={item.id} item={item} matched={signedIn ? matchedById.get(item.id) : undefined} />
        ))}
      </QueryState>
    </Screen>
  );
}
