import { useQuery } from '@tanstack/react-query';
import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';

import { request } from '../../../src/api';
import { withdrawGuardianApproval } from '../../../src/account';
import { Body, Button, ErrorNote, Heading, QueryState, Screen, Title } from '../../../src/ui';
import { z } from 'zod';

const withdrawView = z.object({ learner_first_name: z.string(), guardian_name: z.string() });

// The link from the confirmation email: see the approval and withdraw it.
export default function WithdrawApproval() {
  const { token } = useLocalSearchParams<{ token: string }>();
  const view = useQuery({
    queryKey: ['guardian-withdraw', token],
    queryFn: () => request(`/v1/guardian/withdraw/${encodeURIComponent(token)}`, withdrawView),
    retry: false,
  });
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const learner = view.data?.learner_first_name ?? 'They';

  if (done) {
    return (
      <Screen title="EduLift" back={false}>
        <Heading>Approval withdrawn</Heading>
        <Body>{learner}’s saved account is deleted. They can still use the app as a guest.</Body>
      </Screen>
    );
  }

  return (
    <Screen title="EduLift" back={false}>
      <QueryState query={view}>
        {view.data && (
          <>
            <Heading>Withdraw your approval for {learner}?</Heading>
            <Body>This deletes their saved account. They can still use the app as a guest.</Body>
            <Title>This cannot be undone</Title>
            <ErrorNote error={error} />
            <Button
              label="Withdraw approval and delete data"
              busy={busy}
              onPress={async () => {
                setBusy(true);
                setError(null);
                try {
                  await withdrawGuardianApproval(token);
                  setDone(true);
                } catch (e) {
                  setError(e);
                } finally {
                  setBusy(false);
                }
              }}
            />
          </>
        )}
      </QueryState>
    </Screen>
  );
}
