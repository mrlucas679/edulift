import { useLocalSearchParams } from 'expo-router';
import { Linking } from 'react-native';
import { useState } from 'react';

import { useSession } from '../../src/session';
import { STATUSES, useApplication, useTickItem, useUpdateApplication } from '../../src/tracking';
import { Body, Button, Card, ErrorNote, Field, Heading, QueryState, Screen, Title } from '../../src/ui';

// Shows the domain before anything opens, and only opens https links.
function OfficialSite({ url }: { url: string }) {
  const domain = safeHost(url);
  if (!domain) return <Body>We don’t have a safe link for this yet. Check with the institution.</Body>;
  return (
    <>
      <Body muted>You are going to {domain}. EduLift never submits for you.</Body>
      <Button label={`Open ${domain}`} onPress={() => Linking.openURL(url)} />
    </>
  );
}

function safeHost(url: string): string | null {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:' ? parsed.hostname : null;
  } catch {
    return null;
  }
}

export default function ApplicationScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const numericId = Number(id);
  const { accessToken } = useSession();
  const application = useApplication(numericId, accessToken);
  const update = useUpdateApplication(numericId, accessToken);
  const tick = useTickItem(numericId, accessToken);
  const [reference, setReference] = useState('');

  return (
    <Screen>
      <QueryState query={application}>
        {application.data && (
          <>
            <Heading>{application.data.name}</Heading>
            <Title>Official site</Title>
            <OfficialSite url={application.data.apply_url} />
            <Title>Status</Title>
            {STATUSES.map((s) => (
              <Button
                key={s}
                label={s}
                disabled={application.data.status === s}
                busy={update.isPending}
                onPress={() => update.mutate({ status: s })}
              />
            ))}
            {application.data.needs_reference && <Body>Add your reference number below.</Body>}
            <Field
              label="Reference number"
              value={reference || application.data.external_reference || ''}
              onChangeText={setReference}
              maxLength={60}
            />
            <Button
              label="Save reference"
              disabled={!reference}
              onPress={() => update.mutate({ external_reference: reference })}
            />
            {application.data.deadline_soon && <Body>Offer deadline within a week.</Body>}

            <Title>Documents</Title>
            {application.data.checklist.map((item) => (
              <Card key={item.id} onPress={() => tick.mutate({ itemId: item.id, done: !item.done })} label={item.label}>
                <Body>
                  {item.done ? '✓' : '☐'} {item.label}
                </Body>
              </Card>
            ))}
            <ErrorNote error={update.error ?? tick.error} />
          </>
        )}
      </QueryState>
    </Screen>
  );
}
