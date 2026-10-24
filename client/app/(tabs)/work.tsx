import { Linking } from 'react-native';

import { safeHost } from '../../src/links';
import { OpportunityList } from '../../src/opportunity-list';
import { useHandoffs } from '../../src/reference';
import { Body, Button, Card, Heading, QueryState, Title } from '../../src/ui';

export default function Work() {
  const handoffs = useHandoffs();
  const sayouth = handoffs.data?.find((h) => h.id === 'sayouth');
  return (
    <OpportunityList
      title={<Heading>Work and skills</Heading>}
      kinds={['learnership', 'work']}
      intro="Learnerships and jobs. Each advert shows its requirements and where it was checked."
      header={
        <QueryState query={handoffs}>
          {sayouth && (
            <Card>
              <Title>{sayouth.name}</Title>
              <Body muted>{sayouth.purpose}</Body>
              {safeHost(sayouth.url) && (
                <Button label={`Open ${safeHost(sayouth.url)}`} onPress={() => Linking.openURL(sayouth.url)} />
              )}
            </Card>
          )}
        </QueryState>
      }
    />
  );
}
