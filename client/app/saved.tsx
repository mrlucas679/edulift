import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { useSaved, useToggleSaved } from '../src/tracking';
import { useSession } from '../src/session';
import { font, space, text, touchTarget, useColors } from '../src/theme';
import { Body, Empty, ErrorNote, Heading, QueryState, Screen } from '../src/ui';

const TABS = [
  { id: 'all', label: 'All' },
  { id: 'courses', label: 'Courses' },
  { id: 'funding', label: 'Funding and work' },
] as const;

function Pill({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  const colors = useColors();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={{
        minHeight: touchTarget,
        paddingHorizontal: space.lg,
        justifyContent: 'center',
        borderRadius: 999,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: selected ? colors.ink : colors.surface,
      }}
    >
      <Text style={{ fontFamily: font.bold, fontSize: text.small, color: selected ? colors.paper : colors.ink }}>{label}</Text>
    </Pressable>
  );
}

export default function SavedScreen() {
  const { accessToken } = useSession();
  const saved = useSaved(accessToken);
  const toggle = useToggleSaved(accessToken);
  const [tab, setTab] = useState<(typeof TABS)[number]['id']>('all');
  const colors = useColors();

  const all = saved.data ?? [];
  const items = all.filter((item) => {
    if (tab === 'all') return true;
    return tab === 'courses' ? item.target_kind === 'programme' : item.target_kind === 'opportunity';
  });
  const WORK = ['learnership', 'work', 'internship'];
  const label = (item: (typeof all)[number]) =>
    item.target_kind === 'programme' ? 'COURSE' : WORK.includes(item.kind ?? '') ? 'WORK' : 'FUNDING';

  return (
    <Screen>
      <Heading>Saved</Heading>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
        {TABS.map((t) => (
          <Pill
            key={t.id}
            label={t.id === 'all' ? `All ${all.length}` : t.label}
            selected={tab === t.id}
            onPress={() => setTab(t.id)}
          />
        ))}
      </View>
      <QueryState query={saved}>
        {items.length === 0 && <Empty message="Tap Save on any course, bursary or opportunity to keep it here." />}
        {items.map((item) => {
          const open = () =>
            router.push(item.target_kind === 'programme' ? `/programme/${item.target_id}` : `/opportunity/${item.target_id}`);
          return (
            <View
              key={`${item.target_kind}-${item.target_id}`}
              style={{
                padding: space.md,
                borderRadius: 12,
                borderWidth: 1,
                borderColor: colors.border,
                backgroundColor: colors.surface,
                gap: space.xs,
              }}
            >
              <Pressable accessibilityRole="button" accessibilityLabel={`Open ${item.name}`} onPress={open}>
                <Body muted>{label(item)}</Body>
                <Text style={{ fontFamily: font.bold, fontSize: text.body, color: colors.ink }}>{item.name}</Text>
                <Body muted>{item.closes_on ? `Closes ${item.closes_on}` : 'Closing date not published'}</Body>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                onPress={() =>
                  toggle.mutate({ kind: item.target_kind as 'programme' | 'opportunity', id: item.target_id, on: false })
                }
                style={{ minHeight: touchTarget, justifyContent: 'center', alignSelf: 'flex-end' }}
              >
                <Text style={{ fontFamily: font.regular, fontSize: text.small, color: colors.ink, textDecorationLine: 'underline' }}>
                  Remove
                </Text>
              </Pressable>
            </View>
          );
        })}
      </QueryState>
      <ErrorNote error={toggle.error} />
      <Body muted>Tap Save on any course, bursary or opportunity to keep it here.</Body>
    </Screen>
  );
}
