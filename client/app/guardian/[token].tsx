import { useQuery } from '@tanstack/react-query';
import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Switch, View } from 'react-native';

import { decideGuardianRequest, GUARDIAN_PURPOSES, viewGuardianRequest } from '../../src/account';
import { Body, Button, Card, ErrorNote, Heading, QueryState, Screen, Title } from '../../src/ui';

// For parents. No account; the emailed link is the key, and it works once.
export default function GuardianApproval() {
  const { token } = useLocalSearchParams<{ token: string }>();
  const view = useQuery({ queryKey: ['guardian', token], queryFn: () => viewGuardianRequest(token), retry: false });
  const [relationship, setRelationship] = useState<'parent' | 'legal_guardian' | null>(null);
  const [declared, setDeclared] = useState(false);
  const [purposes, setPurposes] = useState<string[]>([]);
  const [done, setDone] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);

  async function decide(decision: 'approve' | 'decline') {
    setBusy(true);
    setError(null);
    try {
      await decideGuardianRequest(token, { decision, relationship, declaration: declared, purposes });
      setDone(decision === 'approve' ? 'Thank you. They can now use EduLift.' : 'Done. We’ve deleted what they entered.');
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <Screen>
        <Heading>{done}</Heading>
      </Screen>
    );
  }

  const learner = view.data?.learner_first_name ?? '';
  return (
    <Screen>
      <QueryState query={view}>
        {view.data && (
          <>
            <Heading>{learner} wants to use EduLift</Heading>
            <Body>
              EduLift shows school leavers which universities, colleges, funding and jobs they qualify for.
              {' '}{learner} is 17, so we need your permission before we keep their details.
            </Body>
            <Title>What we keep</Title>
            <Body muted>
              Their first name, date of birth, school marks, and the programmes and applications they save.
              Never an ID number, income or race. They can download or delete it any time.
            </Body>

            <Title>You are their</Title>
            <Button label={relationship === 'parent' ? '✓ Parent' : 'Parent'} onPress={() => setRelationship('parent')} />
            <Button
              label={relationship === 'legal_guardian' ? '✓ Legal guardian' : 'Legal guardian'}
              onPress={() => setRelationship('legal_guardian')}
            />

            <Title>Optional extras</Title>
            {view.data.optional_purposes.map((p) => (
              <Card key={p}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                  <View style={{ flex: 1 }}>
                    <Body>{GUARDIAN_PURPOSES[p] ?? p}</Body>
                  </View>
                  <Switch
                    accessibilityLabel={GUARDIAN_PURPOSES[p] ?? p}
                    value={purposes.includes(p)}
                    onValueChange={(on) => setPurposes((ps) => (on ? [...ps, p] : ps.filter((x) => x !== p)))}
                  />
                </View>
              </Card>
            ))}

            <Card>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <View style={{ flex: 1 }}>
                  <Body>
                    I am {learner}’s parent or legal guardian, and I agree to EduLift using their information
                    as described above.
                  </Body>
                </View>
                <Switch accessibilityLabel="I confirm I am the parent or legal guardian" value={declared} onValueChange={setDeclared} />
              </View>
            </Card>
            <ErrorNote error={error} />
            <Button label="I agree" onPress={() => decide('approve')} busy={busy} disabled={!declared || !relationship} />
            <Button label="No, delete it" onPress={() => decide('decline')} busy={busy} />
          </>
        )}
      </QueryState>
    </Screen>
  );
}
