import { useState } from 'react';
import { Linking, Pressable, View } from 'react-native';

import { space, touchTarget, useColors } from '../src/theme';
import { Body, Button, Card, Screen, Section, Title } from '../src/ui';

const GUIDES = [
  { title: 'How APS works', body: 'Each university adds your six best subject results, with Life Orientation left out, unless its own rules say otherwise. Wits and UCT count differently.' },
  { title: 'NSFAS or a bursary — what’s the difference?', body: 'NSFAS is government funding for public universities and TVET colleges. A bursary comes from a provider with its own rules. Check each one’s criteria.' },
  { title: 'Degree, diploma, higher certificate, TVET', body: 'A degree is the longest route. A diploma and a higher certificate are shorter. TVET colleges offer NC(V) and N4 courses.' },
  { title: 'What to do if you don’t get in', body: 'Look at Plan B: easier entry, other institutions, TVET, funding and work. Then apply again next intake.' },
];

function Guide({ title, body }: { title: string; body: string }) {
  const colors = useColors();
  const [open, setOpen] = useState(false);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ expanded: open }}
      onPress={() => setOpen((o) => !o)}
      style={{ minHeight: touchTarget, paddingVertical: space.sm, borderBottomWidth: 1, borderColor: colors.border, gap: space.xs }}
    >
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <Body>{title}</Body>
        <Body muted>{open ? '⌄' : '›'}</Body>
      </View>
      {open && <Body muted small>{body}</Body>}
    </Pressable>
  );
}

export default function Help() {
  return (
    <Screen title="Help">
      <Section>Guides</Section>
      {GUIDES.map((g) => <Guide key={g.title} {...g} />)}
      <Card muted>
        <Title>How to spot a scam</Title>
        <Body small>• Real applications are free or paid only to the institution</Body>
        <Body small>• Nobody can “guarantee” you a place or a bursary</Body>
        <Body small>• Never share passwords or banking details</Body>
      </Card>
      <Section>Talk to a person</Section>
      <Card>
        <Title>Khetha career helpline (DHET)</Title>
        <Body muted small>Free career and study advice</Body>
        <View style={{ flexDirection: 'row', gap: space.sm }}>
          <View style={{ flex: 1 }}>
            <Button label="Call 086 999 0123" variant="secondary" onPress={() => Linking.openURL('tel:0869990123')} />
          </View>
          <View style={{ flex: 1 }}>
            <Button label="SMS 072 204 5056" variant="secondary" onPress={() => Linking.openURL('sms:0722045056')} />
          </View>
        </View>
      </Card>
      <Card>
        <Title>Central Application Service (DHET)</Title>
        <Body muted small>Help finding a place to study</Body>
        <Button label="WhatsApp 081 308 4196" variant="secondary" onPress={() => Linking.openURL('https://wa.me/27813084196')} />
      </Card>
    </Screen>
  );
}
