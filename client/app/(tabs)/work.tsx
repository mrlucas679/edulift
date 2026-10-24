import { OpportunityList } from '../../src/opportunity-list';
import { Heading } from '../../src/ui';

export default function Work() {
  return (
    <OpportunityList
      title={<Heading>Work and skills</Heading>}
      kinds={['learnership', 'work']}
      intro="Learnerships and jobs. Each advert shows its requirements and where it was checked."
    />
  );
}
