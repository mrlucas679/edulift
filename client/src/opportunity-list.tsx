import { useState } from 'react';

import { useMyOpportunities, useOpportunities, type Matched, type Opportunity } from './opportunities';
import { KindChips, OpportunityCard } from './opportunity-views';
import { useSession } from './session';
import { Body, Empty, QueryState, Screen } from './ui';

export function OpportunityList({ title, kinds, intro }: { title: React.ReactNode; kinds: string[]; intro: string }) {
  const { status, accessToken } = useSession();
  const signedIn = status === 'signed-in';
  const [kind, setKind] = useState<string | null>(null);
  const mine = useMyOpportunities(null, signedIn ? accessToken : null);
  const browse = useOpportunities(null);
  const query = signedIn ? mine : browse;

  const inScope = (item: Opportunity) => kinds.includes(item.kind) && (kind === null || item.kind === kind);
  const matchedById = new Map<string, Matched>((mine.data ?? []).map((m) => [m.id, m]));
  const items = (query.data ?? []).filter(inScope);

  return (
    <Screen>
      {title}
      <Body muted>{intro}</Body>
      <KindChips kinds={kinds} value={kind} onChange={setKind} />
      <QueryState query={query}>
        {items.length === 0 && <Empty message="Nothing is listed here yet. We add each one once its page has been checked." />}
        {items.map((item) => (
          <OpportunityCard key={item.id} item={item} matched={signedIn ? matchedById.get(item.id) : undefined} />
        ))}
      </QueryState>
    </Screen>
  );
}
