import { Linking, Pressable, Text, View } from 'react-native';
import { useState } from 'react';

import { font, space, text, touchTarget, useColors } from '../src/theme';

import { safeHost } from '../src/links';
import { useHandoffs } from '../src/reference';
import { ScamNotice } from '../src/opportunity-views';
import { Body, Button, Card, Heading, QueryState, Screen, Title } from '../src/ui';

const GUIDES = [
  { title: 'How APS works', body: 'Each university adds your six best subject results, with Life Orientation left out, unless its own rules say otherwise. Wits and UCT count differently.' },
  { title: 'NSFAS or a bursary: what is the difference?', body: 'NSFAS is government funding for public universities and TVET colleges. A bursary comes from a provider with its own rules. Check each one’s criteria.' },
  { title: 'Degree, diploma, higher certificate, TVET', body: 'A degree is the longest route. A diploma and a higher certificate are shorter. TVET colleges offer NC(V) and N4 courses.' },
  { title: 'What to do if you don’t get in', body: 'Look at Plan B: easier entry, other institutions, TVET, funding and work. Then apply again next intake.' },
];

function GuideRow({ title, body }: { title: string; body: string }) {
  const colors = useColors();
  const [open, setOpen] = useState(false);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ expanded: open }}
      onPress={() => setOpen((o) => !o)}
      style={{ minHeight: touchTarget, paddingVertical: space.sm, borderBottomWidth: 1, borderColor: colors.border }}
    >
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <Text style={{ fontFamily: font.regular, fontSize: text.body, color: colors.ink, flex: 1 }}>{title}</Text>
        <Text style={{ fontSize: text.body, color: colors.inkMuted }}>{open ? '⌄' : '›'}</Text>
      </View>
      {open && <Body muted>{body}</Body>}
    </Pressable>
  );
}

export default function Help() {
  const handoffs = useHandoffs();
  return (
    <Screen>
      <Heading>Help</Heading>

      <Body muted>Draft guides. Each one is checked against its source before launch.</Body>
      <Body muted>GUIDES</Body>
      {GUIDES.map((g) => (
        <GuideRow key={g.title} title={g.title} body={g.body} />
      ))}

      <ScamNotice />

      <Body muted>TALK TO A PERSON</Body>
      <Body muted>These are the official helplines and services. Use the contact details on their sites.</Body>
      <QueryState query={handoffs}>
        {handoffs.data?.map((h) => (
          <Card key={h.id}>
            <Title>{h.name}</Title>
            <Body>{h.purpose}</Body>
            {safeHost(h.url) && <Button label={`Open ${safeHost(h.url)}`} onPress={() => Linking.openURL(h.url)} />}
          </Card>
        ))}
      </QueryState>
    </Screen>
  );
}
