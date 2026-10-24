import { useLocalSearchParams } from 'expo-router';
import { Linking, Pressable, Text, View } from 'react-native';

import { useSession } from '../../src/session';
import { useApplication, useTickItem } from '../../src/tracking';
import { font, space, text, touchTarget, useColors } from '../../src/theme';
import { Body, Button, ErrorNote, Heading, QueryState, Screen, Title } from '../../src/ui';

// The documents needed to apply, with a tick for each one ready.
export default function DocumentsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const numericId = Number(id);
  const { accessToken } = useSession();
  const application = useApplication(numericId, accessToken);
  const tick = useTickItem(numericId, accessToken);
  const colors = useColors();

  return (
    <Screen>
      <QueryState query={application}>
        {application.data && (() => {
          const items = application.data.checklist;
          const done = items.filter((c) => c.done).length;
          return (
            <>
              <Heading>Documents to apply</Heading>
              <Body muted>{application.data.name}</Body>
              <Title>{`${done} of ${items.length} ready`}</Title>
              {items.map((item) => (
                <Pressable
                  key={item.id}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: item.done }}
                  onPress={() => tick.mutate({ itemId: item.id, done: !item.done })}
                  style={{ minHeight: touchTarget, flexDirection: 'row', alignItems: 'center', gap: space.md }}
                >
                  <Text style={{ fontSize: text.h3, color: colors.ink }}>{item.done ? '☑' : '☐'}</Text>
                  <Text style={{ flex: 1, fontFamily: font.regular, fontSize: text.body, color: colors.ink }}>{item.label}</Text>
                </Pressable>
              ))}
              <Body muted>Only the official site takes applications. EduLift never submits for you.</Body>
              <Button label={`Open ${application.data.name} site`} onPress={() => Linking.openURL(application.data.apply_url)} />
            </>
          );
        })()}
      </QueryState>
      <ErrorNote error={tick.error} />
      <View />
    </Screen>
  );
}
