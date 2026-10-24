import { Linking } from 'react-native';

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

export default function Help() {
  const handoffs = useHandoffs();
  return (
    <Screen>
      <Heading>Help</Heading>

      <Body muted>Draft guides. Each one is checked against its source before launch.</Body>
      <Title>Guides</Title>
      {GUIDES.map((g) => (
        <Card key={g.title}>
          <Title>{g.title}</Title>
          <Body>{g.body}</Body>
        </Card>
      ))}

      <ScamNotice />

      <Title>Talk to a person</Title>
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
