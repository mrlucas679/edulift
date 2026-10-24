import { router } from 'expo-router';
import { useState } from 'react';

import { useSaved, useToggleSaved } from '../src/tracking';
import { useSession } from '../src/session';
import { KindChips } from '../src/opportunity-views';
import { Body, Button, Card, Empty, ErrorNote, Heading, QueryState, Screen, Title } from '../src/ui';

const TABS = { courses: 'Courses', funding: 'Funding and work' } as const;

export default function SavedScreen() {
  const { accessToken } = useSession();
  const saved = useSaved(accessToken);
  const toggle = useToggleSaved(accessToken);
  const [tab, setTab] = useState<keyof typeof TABS | null>(null);

  const items = (saved.data ?? []).filter((item) => {
    if (tab === null) return true;
    return tab === 'courses' ? item.target_kind === 'programme' : item.target_kind === 'opportunity';
  });

  return (
    <Screen>
      <Heading>Saved</Heading>
      <KindChips
        kinds={Object.keys(TABS)}
        value={tab}
        onChange={(v) => setTab(v as keyof typeof TABS | null)}
        labels={TABS}
      />
      <QueryState query={saved}>
        {items.length === 0 && (
          <Empty message="Tap Save on any course, bursary or opportunity to keep it here." />
        )}
        {items.map((item) => (
          <Card
            key={`${item.target_kind}-${item.target_id}`}
            onPress={() =>
              router.push(
                item.target_kind === 'programme' ? `/programme/${item.target_id}` : `/opportunity/${item.target_id}`,
              )
            }
            label={`Open ${item.name}`}
          >
            <Title>{item.name}</Title>
            <Body muted>{item.closes_on ? `Closes ${item.closes_on}` : 'Closing date not published'}</Body>
            <Button
              label="Remove"
              busy={toggle.isPending}
              onPress={() => toggle.mutate({ kind: item.target_kind as 'programme' | 'opportunity', id: item.target_id, on: false })}
            />
          </Card>
        ))}
      </QueryState>
      <ErrorNote error={toggle.error} />
    </Screen>
  );
}
