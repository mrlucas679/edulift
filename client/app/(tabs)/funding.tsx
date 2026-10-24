import { OpportunityList } from '../../src/opportunity-list';
import { Heading } from '../../src/ui';

export default function Funding() {
  return (
    <OpportunityList
      title={<Heading>Funding</Heading>}
      kinds={['bursary', 'loan']}
      intro="Bursaries and loans, with the criteria we could check. Apply on the provider's own site."
    />
  );
}
