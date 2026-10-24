import { useLocalSearchParams } from 'expo-router';
import { Linking } from 'react-native';

import { KIND_LABELS, useMyOpportunities, useOpportunity } from '../../src/opportunities';
import { safeHost } from '../../src/links';
import { ScamNotice, VERDICT_TEXT } from '../../src/opportunity-views';
import { useSession } from '../../src/session';
import { Body, Button, Card, ErrorNote, Heading, QueryState, Screen, SourceLine, Title } from '../../src/ui';

export default function OpportunityScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { status, accessToken } = useSession();
  const opportunity = useOpportunity(id);
  const mine = useMyOpportunities(null, status === 'signed-in' ? accessToken : null);
  const match = mine.data?.find((m) => m.id === id);
  const host = safeHost(opportunity.data?.url);

  return (
    <Screen>
      <QueryState query={opportunity}>
        {opportunity.data && (
          <>
            <Heading>{opportunity.data.name}</Heading>
            <Body muted>
              {opportunity.data.provider} · {KIND_LABELS[opportunity.data.kind] ?? opportunity.data.kind}
            </Body>
            <Body>{opportunity.data.closes_on ? `Closes ${opportunity.data.closes_on}` : 'Closing date not published'}</Body>

            {match && (
              <>
                <Title>Your check</Title>
                <Body>{VERDICT_TEXT[match.verdict]}</Body>
                {match.checks.map((c) => (
                  <Card key={c.check}>
                    <Body>
                      {c.check.replace(/_/g, ' ')}: {c.status === 'met' ? '✓ Met' : c.status === 'not_met' ? '✗ Not met' : '? Check with provider'}
                    </Body>
                  </Card>
                ))}
              </>
            )}
            {status !== 'signed-in' && <Body muted>Sign in to see whether you may qualify.</Body>}

            <ScamNotice />

            {host ? (
              <>
                <Body muted>You are going to {host}. EduLift never submits for you.</Body>
                <Button label={`Open ${host}`} onPress={() => Linking.openURL(opportunity.data.url)} />
              </>
            ) : (
              <Body muted>We don’t have a safe link for this yet. Check with the provider.</Body>
            )}
            <SourceLine source={opportunity.data.source} />
          </>
        )}
      </QueryState>
      <ErrorNote error={mine.error} />
    </Screen>
  );
}
