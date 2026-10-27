import { router, useLocalSearchParams } from 'expo-router';
import { Linking, View } from 'react-native';

import { isOpen, shortDate } from '../../src/dates';
import { safeHost } from '../../src/links';
import { KIND_LABELS, useMyOpportunities, useOpportunity } from '../../src/opportunities';
import { checkName, checkResult, ScamNotice, VERDICT_TEXT } from '../../src/opportunity-views';
import { useSession } from '../../src/session';
import { space } from '../../src/theme';
import { useSaved, useToggleSaved } from '../../src/tracking';
import { Body, Button, Check, ErrorNote, Heading, Pill, QueryState, Screen, Section, SourceLine } from '../../src/ui';

const TITLES: Record<string, string> = { bursary: 'Bursary', loan: 'Loan', learnership: 'Learnership', work: 'Opportunity' };

export default function OpportunityScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { status, accessToken } = useSession();
  const signedIn = status === 'signed-in';
  const opportunity = useOpportunity(id);
  const mine = useMyOpportunities(null, signedIn ? accessToken : null);
  const saved = useSaved(signedIn ? accessToken : null);
  const toggleSaved = useToggleSaved(accessToken);
  const match = mine.data?.find((m) => m.id === id);
  const o = opportunity.data;
  const host = safeHost(o?.url);
  const isSaved = saved.data?.some((s) => s.target_id === id) ?? false;
  const open = o ? isOpen(o.closes_on) : false;

  return (
    <Screen
      title={o ? (TITLES[o.kind] ?? 'Opportunity') : ''}
      footer={
        o && (
          <View style={{ flexDirection: 'row', gap: space.sm }}>
            {host && (
              <View style={{ flex: 2 }}>
                <Button label={`Apply on ${host}`} onPress={() => Linking.openURL(o.url)} />
              </View>
            )}
            <View style={{ flex: 1 }}>
              <Button
                label={isSaved ? 'Saved ✓' : 'Save'}
                variant="secondary"
                busy={toggleSaved.isPending}
                onPress={() => (signedIn ? toggleSaved.mutate({ kind: 'opportunity', id, on: !isSaved }) : router.push('/sign-in'))}
              />
            </View>
          </View>
        )
      }
    >
      <QueryState query={opportunity}>
        {o && (
          <>
            <Heading>{o.name}</Heading>
            <Body muted small>{o.provider} · {KIND_LABELS[o.kind] ?? o.kind}</Body>
            <View style={{ flexDirection: 'row', gap: space.sm }}>
              <Pill label={open ? 'Open' : 'Not open now'} filled={open} />
              {o.closes_on && <Pill label={`Closes ${shortDate(o.closes_on)}`} />}
            </View>

            {match ? (
              <>
                <Section>Do you qualify?</Section>
                <Body small>{VERDICT_TEXT[match.verdict]}</Body>
                {match.checks.map((c) => (
                  <Check
                    key={c.check}
                    result={checkResult(c.status)}
                    label={checkName(c.check)}
                    note={c.status === 'unknown' ? 'We don’t ask this — check with the provider' : undefined}
                  />
                ))}
              </>
            ) : (
              !signedIn && <Button label="Sign in to see if you qualify" variant="link" onPress={() => router.push('/sign-in')} />
            )}

            {signedIn && (
              <Button
                label="Write a motivation letter for this"
                variant="link"
                onPress={() => router.push({ pathname: '/draft', params: { target: `${o.name} (${o.provider})` } })}
              />
            )}
            <ScamNotice />
            {host ? (
              <Body muted small>EduLift never applies for you. The button opens {host}. Some are applied for through a university or training provider: check the page first.</Body>
            ) : (
              <Body muted small>We don’t have a safe link for this yet. Check with the provider.</Body>
            )}
            <SourceLine source={o.source} />
          </>
        )}
      </QueryState>
      <ErrorNote error={mine.error ?? toggleSaved.error} />
    </Screen>
  );
}
