import { router, useLocalSearchParams } from 'expo-router';
import { Linking, Pressable, Text, View } from 'react-native';
import { useState } from 'react';

import { useSession } from '../../src/session';
import { STATUSES, useApplication, useTickItem, useUpdateApplication } from '../../src/tracking';
import { font, space, text, touchTarget, useColors } from '../../src/theme';
import { Body, Button, Field, Heading, QueryState, Screen, Title } from '../../src/ui';

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

  return (
    <Screen>
      <QueryState query={application}>
        {application.data && (
          <>
            <Heading>{application.data.name}</Heading>
            <Body muted>
              {application.data.offer_deadline ? `Closes ${application.data.offer_deadline}` : 'Closing date not published'}
            </Body>

            <Title>Status</Title>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
              {STATUSES.map((s) => {
                const selected = application.data.status === s;
                return (
                  <Pressable
                    key={s}
                    accessibilityRole="button"
                    accessibilityState={{ selected }}
                    disabled={update.isPending}
                    onPress={() => update.mutate({ status: s })}
                    style={{
                      minHeight: touchTarget,
                      paddingHorizontal: space.md,
                      justifyContent: 'center',
                      borderRadius: 999,
                      borderWidth: 1,
                      borderColor: colors.border,
                      backgroundColor: selected ? colors.ink : colors.surface,
                    }}
                  >
                    <Text style={{ fontFamily: font.bold, fontSize: text.small, color: selected ? colors.paper : colors.ink }}>{s}</Text>
                  </Pressable>
                );
              })}
            </View>

            <Field
              label="Your reference number"
              value={reference ?? application.data.external_reference ?? ''}
              onChangeText={setReference}
              maxLength={60}
            />
            <Button
              label="Save reference"
              disabled={reference === null}
              onPress={() => update.mutate({ external_reference: reference ?? '' })}
            />
            {application.data.needs_reference && <Body>Add your reference number.</Body>}

            <Title>{`DOCUMENTS · ${application.data.checklist.filter((c) => c.done).length} OF ${application.data.checklist.length}`}</Title>
            {application.data.checklist.map((item) => (
              <Pressable
                key={item.id}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: item.done }}
                onPress={() => tick.mutate({ itemId: item.id, done: !item.done })}
                style={{ minHeight: touchTarget, flexDirection: 'row', alignItems: 'center', gap: space.md }}
              >
                <Text style={{ fontSize: text.h3, color: colors.ink }}>{item.done ? '☑' : '☐'}</Text>
                <Body>{item.label}</Body>
              </Pressable>
            ))}

            <Field label="Notes" value={notes ?? application.data.notes} onChangeText={setNotes} multiline maxLength={1000} />
            <Button
              label="Save notes"
              disabled={notes === null}
              onPress={() => update.mutate({ notes: notes ?? '' })}
            />
            {application.data.deadline_soon && <Body>Offer deadline within a week.</Body>}
            <Button label="Documents I need to apply" onPress={() => router.push({ pathname: "/documents/[id]", params: { id: String(numericId) } })} />

            {(() => {
              const domain = safeHost(application.data.apply_url);
              if (!domain) return <Body>We don’t have a safe link for this yet. Check with the institution.</Body>;
              return (
                <>
                  <Body muted>EduLift never submits for you. You will go to {domain}.</Body>
                  <Button
                    label={`Open ${domain}`}
                    onPress={() => Linking.openURL(application.data.apply_url)}
                  />
                </>
              );
            })()}
            {update.error && <Body muted>Could not save. Try again.</Body>}
          </>
        )}
      </QueryState>
    </Screen>
  );
}
