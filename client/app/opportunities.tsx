import { router } from 'expo-router';
import { useState } from 'react';

import { KIND_LABELS, useMyOpportunities, useOpportunities, type Matched, type Opportunity } from '../src/opportunities';
import { useSession } from '../src/session';
import { Body, Button, Card, Empty, Heading, QueryState, Screen, SourceLine, Title } from '../src/ui';

const CRITERION = { met: '✓ Met', not_met: '✗ Not met', unknown: '? Not confirmed' };
const VERDICT = {
  qualifies: 'Meets the criteria we could check.',
  may_qualify: 'You may qualify — confirm with the provider.',
  not_checked: 'Finish setting up your account to see if you may qualify.',
};

function MatchedCard({ item }: { item: Matched }) {
  return (
    <Card>
      <Title>{item.name}</Title>
      <Body muted>{item.provider}</Body>
      <Body>{VERDICT[item.verdict]}</Body>
      {item.checks.map((c) => (
        <Body key={c.check} muted>
          {c.check.replace('_', ' ')}: {CRITERION[c.status]}
        </Body>
      ))}
      <SourceLine source={item.source} />
    </Card>
  );
}

function PlainCard({ item }: { item: Opportunity }) {
  return (
    <Card>
      <Title>{item.name}</Title>
      <Body muted>{item.provider}</Body>
      {item.closes_on && <Body muted>Closes {item.closes_on}</Body>}
      <SourceLine source={item.source} />
    </Card>
  );
}

export default function OpportunitiesScreen() {
  const { status, accessToken } = useSession();
  const [kind, setKind] = useState<string | null>(null);
  const signedIn = status === 'signed-in';
  const mine = useMyOpportunities(kind, signedIn ? accessToken : null);
  const browse = useOpportunities(kind);
  const query = signedIn ? mine : browse;

  return (
    <Screen>
      <Heading>Funding and work</Heading>
      <Body muted>Each one shows its criteria and where they came from. We never say you will be accepted.</Body>
      {!signedIn && <Button label="Sign in to see what you may qualify for" onPress={() => router.push('/sign-in')} />}
      {[null, ...Object.keys(KIND_LABELS)].map((k) => (
        <Button key={k ?? 'all'} label={k ? KIND_LABELS[k] : 'All'} onPress={() => setKind(k)} disabled={kind === k} />
      ))}
      <QueryState query={query}>
        {query.data && query.data.length === 0 && (
          <Empty message="Nothing is listed yet. We add each one once its page has been checked." />
        )}
        {signedIn
          ? mine.data?.map((item) => <MatchedCard key={item.id} item={item} />)
          : browse.data?.map((item) => <PlainCard key={item.id} item={item} />)}
      </QueryState>
    </Screen>
  );
}
