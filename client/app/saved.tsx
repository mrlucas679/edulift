import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { shortDate } from '../src/dates';
import { useSession } from '../src/session';
import { useSaved, useToggleSaved, type Saved } from '../src/tracking';
import { Body, Button, Card, Chips, ErrorNote, QueryState, Screen, Section, Title } from '../src/ui';

const WORK = ['learnership', 'work', 'internship'];
type Tab = 'all' | 'course' | 'funding' | 'work';
const group = (item: Saved): Exclude<Tab, 'all'> =>
  item.target_kind === 'programme' ? 'course' : WORK.includes(item.kind ?? '') ? 'work' : 'funding';

export default function SavedScreen() {
  const { accessToken } = useSession();
  const saved = useSaved(accessToken);
  const toggle = useToggleSaved(accessToken);
  const [tab, setTab] = useState<Tab>('all');
  const all = saved.data ?? [];
  const items = all.filter((i) => tab === 'all' || group(i) === tab);

  return (
    <Screen title="Saved">
      <Chips
        options={[
          { id: 'all', label: `All ${all.length}` },
          { id: 'course', label: 'Courses' },
          { id: 'funding', label: 'Funding' },
          { id: 'work', label: 'Work' },
        ]}
        value={tab}
        onChange={setTab}
      />
      <QueryState query={saved}>
        {items.map((item) => (
          <Card
            key={`${item.target_kind}-${item.target_id}`}
            label={`Open ${item.name}`}
            onPress={() => router.push(item.target_kind === 'programme' ? `/programme/${item.target_id}` : `/opportunity/${item.target_id}`)}
          >
            <Section>{group(item)}</Section>
            <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 8 }}>
              <View style={{ flex: 1 }}>
                <Title>{item.name}</Title>
              </View>
              <Button
                label="Remove"
                variant="link"
                onPress={() => toggle.mutate({ kind: item.target_kind as 'programme' | 'opportunity', id: item.target_id, on: false })}
              />
            </View>
            <Body muted small>{item.closes_on ? `Closes ${shortDate(item.closes_on)}` : 'Closing date not published'}</Body>
          </Card>
        ))}
      </QueryState>
      <ErrorNote error={toggle.error} />
      <Body muted small>Tap Save on any course, bursary or opportunity to keep it here.</Body>
    </Screen>
  );
}
