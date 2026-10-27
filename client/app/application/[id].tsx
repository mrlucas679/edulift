import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Linking, Pressable, View } from 'react-native';

import { shortDate } from '../../src/dates';
import { useSession } from '../../src/session';
import { space, touchTarget, useColors } from '../../src/theme';
import { STATUSES, useApplication, useTickItem, useUpdateApplication } from '../../src/tracking';
import { Body, Button, Chips, ErrorNote, Field, Heading, QueryState, Screen, Section } from '../../src/ui';

const LABELS: Record<string, string> = {
  planning: 'Planning',
  submitted: 'Submitted',
  offer: 'Offer',
  waitlist: 'Waitlist',
  declined: 'Declined',
  withdrawn: 'Withdrawn',
};

// Shows the domain before anything opens, and only opens https links.
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
  const colors = useColors();
  const [reference, setReference] = useState<string | null>(null);
  const [notes, setNotes] = useState<string | null>(null);
  const a = application.data;
  const domain = a ? safeHost(a.apply_url) : null;

  return (
    <Screen
      title="Application"
      footer={a && domain && <Button label="Open the application site" sub={domain} onPress={() => Linking.openURL(a.apply_url)} />}
    >
      <QueryState query={application}>
        {a && (
          <>
            <Heading>{a.name}</Heading>
            <Body muted small>{a.offer_deadline ? `Closes ${shortDate(a.offer_deadline)}` : 'Closing date not published'}</Body>

            <Section>Status</Section>
            <Chips
              options={STATUSES.map((s) => ({ id: s, label: LABELS[s] }))}
              value={a.status}
              onChange={(s) => update.mutate({ status: s })}
            />
            {a.status === 'submitted' && a.submitted_on && <Body muted small>Submitted on {shortDate(a.submitted_on)}</Body>}

            {/* Saves when you leave the box: no separate Save button. */}
            <Field
              label="Your reference number"
              value={reference ?? a.external_reference ?? ''}
              onChangeText={setReference}
              onBlur={() => reference !== null && update.mutate({ external_reference: reference })}
              maxLength={60}
            />

            <Section>{`Documents · ${a.checklist.filter((c) => c.done).length} of ${a.checklist.length}`}</Section>
            {a.checklist.map((item) => (
              <Pressable
                key={item.id}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: item.done }}
                onPress={() => tick.mutate({ itemId: item.id, done: !item.done })}
                style={{ minHeight: touchTarget, flexDirection: 'row', alignItems: 'center', gap: space.md }}
              >
                <View
                  style={{
                    width: 22,
                    height: 22,
                    borderRadius: 4,
                    borderWidth: 1.5,
                    borderColor: item.done ? colors.accent : colors.ink,
                    backgroundColor: item.done ? colors.accent : 'transparent',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  {item.done && <Ionicons name="checkmark" size={16} color={colors.onAccent} />}
                </View>
                <Body>{item.label}</Body>
              </Pressable>
            ))}
            <Button
              label="What each document means"
              variant="link"
              onPress={() => router.push({ pathname: '/documents/[id]', params: { id: String(numericId) } })}
            />

            <Field
              label="Notes"
              value={notes ?? a.notes}
              onChangeText={setNotes}
              onBlur={() => notes !== null && update.mutate({ notes })}
              multiline
              maxLength={1000}
            />
            {a.deadline_soon && <Body>Offer deadline within a week.</Body>}
            {!domain && <Body muted small>We don’t have a safe link for this yet. Check with the institution.</Body>}
            {domain && <Body muted small>EduLift never submits for you. The button opens {domain}.</Body>}
            <ErrorNote error={update.error ?? tick.error} />
          </>
        )}
      </QueryState>
    </Screen>
  );
}
