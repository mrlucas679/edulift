import { useLocalSearchParams } from 'expo-router';
import { Linking, Text, View } from 'react-native';

import { font, space, text, touchTarget, useColors } from '../../src/theme';

import { KIND_LABELS, useMyOpportunities, useOpportunity } from '../../src/opportunities';
import { safeHost } from '../../src/links';
import { ScamNotice, VERDICT_TEXT } from '../../src/opportunity-views';
import { useSession } from '../../src/session';
import { Body, Button, ErrorNote, Heading, QueryState, Screen, SourceLine } from '../../src/ui';

export default function OpportunityScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { status, accessToken } = useSession();
  const opportunity = useOpportunity(id);
  const mine = useMyOpportunities(null, status === 'signed-in' ? accessToken : null);
  const match = mine.data?.find((m) => m.id === id);
  const host = safeHost(opportunity.data?.url);
  const colors = useColors();

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
                <Body muted>DO YOU QUALIFY?</Body>
                <Body>{VERDICT_TEXT[match.verdict]}</Body>
                {match.checks.map((c) => (
                  <View key={c.check} style={{ flexDirection: 'row', gap: space.md, minHeight: touchTarget }}>
                    <Text style={{ fontFamily: font.bold, fontSize: text.h3, color: colors.ink }}>
                      {c.status === 'met' ? '✓' : c.status === 'not_met' ? '✗' : '?'}
                    </Text>
                    <View style={{ flex: 1 }}>
                      <Body>{c.check.replace(/_/g, ' ')}</Body>
                      <Body muted>{c.status === 'met' ? 'Met' : c.status === 'not_met' ? 'Not met' : 'Check with the provider'}</Body>
                    </View>
                  </View>
                ))}
              </>
            )}
            {status !== 'signed-in' && <Body muted>Sign in to see whether you may qualify.</Body>}

            <ScamNotice />

            {host ? (
              <>
                <Body muted>EduLift never submits for you. You are going to {host}.</Body>
                <Button label={`Apply on ${host}`} onPress={() => Linking.openURL(opportunity.data.url)} />
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
