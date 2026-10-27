import { useState } from 'react';
import { Linking } from 'react-native';

import { isOpen } from './dates';
import { safeHost } from './links';
import { useMyOpportunities, useOpportunities, type Matched, type Opportunity } from './opportunities';
import { KindChips, OpportunityCard } from './opportunity-views';
import { useHandoffs } from './reference';
import { useSession } from './session';
import { Body, Button, Card, CardTop, Empty, Field, QueryState, Screen, Section } from './ui';

// The one official place to start, shown above the list (NSFAS, SA Youth).
function Featured({ id, pill, action }: { id: string; pill?: string; action: string }) {
  const handoffs = useHandoffs();
  const h = handoffs.data?.find((x) => x.id === id);
  const host = h ? safeHost(h.url) : null;
  if (!h) return null;
  return (
    <Card>
      <CardTop title={h.name} pill={pill} filled />
      <Body muted small>{h.purpose}</Body>
      {host && <Button label={action} variant="secondary" sub={host} onPress={() => Linking.openURL(h.url)} />}
    </Card>
  );
}

export function OpportunityList({
  title,
  kinds,
  placeholder,
  featured,
}: {
  title: string;
  kinds: string[];
  placeholder: string;
  featured?: { id: string; pill?: string; action: string };
}) {
  const { status, accessToken } = useSession();
  const signedIn = status === 'signed-in';
  const [kind, setKind] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const mine = useMyOpportunities(null, signedIn ? accessToken : null);
  const browse = useOpportunities(null);
  const query = signedIn ? mine : browse;

  const inScope = (item: Opportunity) =>
    kinds.includes(item.kind) &&
    (kind === null || item.kind === kind) &&
    item.name.toLowerCase().includes(search.trim().toLowerCase());
  const matchedById = new Map<string, Matched>((mine.data ?? []).map((m) => [m.id, m]));
  const items = (query.data ?? []).filter(inScope);
  // Matches first, then open with a date, then undated, then closed.
  const rank = (o: Opportunity) =>
    (matchedById.has(o.id) ? 0 : 4) + (!isOpen(o.closes_on) ? 3 : o.closes_on ? 0 : 1);
  items.sort((a, b) => rank(a) - rank(b) || (a.closes_on ?? '9').localeCompare(b.closes_on ?? '9'));

  return (
    <Screen title={title} back={false}>
      <Field label="Search" value={search} onChangeText={setSearch} placeholder={placeholder} maxLength={60} />
      <KindChips kinds={kinds} value={kind} onChange={setKind} />
      {featured && <Featured {...featured} />}
      <QueryState query={query}>
        <Section>{signedIn ? `Matches for you · ${items.length}` : `Listed · ${items.length}`}</Section>
        {items.length === 0 && <Empty message="Nothing is listed here yet. We add each one once its page has been checked." />}
        {items.map((item) => (
          <OpportunityCard key={item.id} item={item} matched={signedIn ? matchedById.get(item.id) : undefined} />
        ))}
      </QueryState>
      {!signedIn && <Body muted small>Sign in to see which ones you may qualify for.</Body>}
    </Screen>
  );
}
