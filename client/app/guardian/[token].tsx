import { useQuery } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, Switch, Text, View , Share } from 'react-native';

import {
  approveGuardianRequest,
  decideGuardianRequest,
  GUARDIAN_PURPOSES,
  guardianExport,
  viewGuardianRequest,
  withdrawGuardianApproval,
} from '../../src/account';

import { font, space, text, touchTarget, useColors } from '../../src/theme';
import { Body, Button, Card, ErrorNote, Heading, QueryState, Screen, Title } from '../../src/ui';

// For parents. No account; the emailed link is the key, and it works once.
export default function GuardianApproval() {
  const { token } = useLocalSearchParams<{ token: string }>();
  const colors = useColors();
  const view = useQuery({ queryKey: ['guardian', token], queryFn: () => viewGuardianRequest(token), retry: false });
  const [declared, setDeclared] = useState(false);
  const [purposes, setPurposes] = useState<string[]>([]);
  const [done, setDone] = useState<string | null>(null);
  const [withdrawToken, setWithdrawToken] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const learner = view.data?.learner_first_name ?? 'They';

  async function decide(decision: 'approve' | 'decline') {
    setBusy(true);
    setError(null);
    try {
      if (decision === 'approve') {
        const { withdraw_token } = await approveGuardianRequest(token, {
          decision,
          relationship: 'parent',
          declaration: declared,
          purposes,
        });
        setWithdrawToken(withdraw_token);
        setDone(`Thank you. ${learner}’s account is open.`);
      } else {
        await decideGuardianRequest(token, { decision, relationship: 'parent', declaration: declared, purposes });
        setDone('Done. We’ve deleted what was entered.');
      }
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <Screen>
        <Text style={{ fontFamily: font.bold, fontSize: text.small, color: colors.ink }}>Matric Pathways</Text>
        <Heading>{done}</Heading>
        {withdrawToken && (
          <>
            <Body>We’ve let {learner} know. Keep this email — its link lets you see or delete their data later.</Body>
            <Card>
              <Title>Changed your mind?</Title>
              <Body muted>Withdrawing deletes their saved account. They can still use the app as a guest.</Body>
              <Button
                label="Withdraw approval and delete data"
                busy={busy}
                onPress={async () => {
                  setBusy(true);
                  setError(null);
                  try {
                    await withdrawGuardianApproval(withdrawToken);
                    setWithdrawToken(null);
                    setDone('Approval withdrawn. Their saved account is deleted.');
                  } catch (e) {
                    setError(e);
                  } finally {
                    setBusy(false);
                  }
                }}
              />
            </Card>
            <Card>
              <Title>Want a copy of what we hold?</Title>
              <Button
                label={`Download ${learner}’s data`}
                busy={busy}
                onPress={async () => {
                  setBusy(true);
                  setError(null);
                  try {
                    const data = await guardianExport(withdrawToken);
                    await Share.share({ message: JSON.stringify(data, null, 2), title: `${learner}’s EduLift data` });
                  } catch (e) {
                    setError(e);
                  } finally {
                    setBusy(false);
                  }
                }}
              />
            </Card>
            <ErrorNote error={error} />
          </>
        )}
      </Screen>
    );
  }

  return (
    <Screen>
      <Text style={{ fontFamily: font.bold, fontSize: text.small, color: colors.ink }}>Matric Pathways</Text>
      <QueryState query={view}>
        {view.data && (
          <>
            <Heading>{learner} asked you to approve their account</Heading>
            <Body muted>
              Matric Pathways helps learners see which courses, funding and work they qualify for. They apply on the official sites themselves.
            </Body>
            <Card>
              <Title>If you approve, we will keep</Title>
              <Body>• Their first name, date of birth and province</Body>
              <Body>• Their school marks</Body>
              <Body>• Courses, funding and applications they save</Body>
              <Body>• Reminder emails, only if they turn them on</Body>
            </Card>
            <Card>
              <Title>We never</Title>
              <Body>• Ask for ID numbers, income or banking details</Body>
              <Body>• Send their details to universities or funders</Body>
              <Body>• Show them adverts</Body>
            </Card>
            <Body muted>Optional. You can allow these now, or they stay off until {learner} turns them on.</Body>
            {view.data.optional_purposes.map((p) => (
              <View key={p} style={{ flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: touchTarget }}>
                <Text style={{ flex: 1, fontFamily: font.regular, fontSize: text.body, color: colors.ink }}>{GUARDIAN_PURPOSES[p] ?? p}</Text>
                <Switch
                  accessibilityLabel={GUARDIAN_PURPOSES[p] ?? p}
                  value={purposes.includes(p)}
                  onValueChange={(on) => setPurposes((ps) => (on ? [...ps, p] : ps.filter((x) => x !== p)))}
                />
              </View>
            ))}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: touchTarget }}>
              <Switch accessibilityLabel={`I am ${learner}’s parent or legal guardian`} value={declared} onValueChange={setDeclared} />
              <Text style={{ flex: 1, fontFamily: font.regular, fontSize: text.body, color: colors.ink }}>
                I am {learner}’s parent or legal guardian
              </Text>
            </View>
            <ErrorNote error={error} />
            <View style={{ flexDirection: 'row', gap: space.sm }}>
              <View style={{ flex: 1 }}>
                <Button label="Decline" onPress={() => decide('decline')} busy={busy} />
              </View>
              <View style={{ flex: 1 }}>
                <Button label="Approve" onPress={() => decide('approve')} busy={busy} disabled={!declared} />
              </View>
            </View>
            <Body muted>You can withdraw and delete their data any time using the link in your email.</Body>
            <Pressable accessibilityRole="link" onPress={() => router.push('/privacy')} style={{ minHeight: touchTarget, justifyContent: 'center' }}>
              <Text style={{ fontFamily: font.regular, fontSize: text.small, color: colors.ink, textDecorationLine: 'underline' }}>Privacy notice</Text>
            </Pressable>
          </>
        )}
      </QueryState>
    </Screen>
  );
}
