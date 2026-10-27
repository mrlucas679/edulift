import { OpportunityList } from '../../src/opportunity-list';

export default function Funding() {
  return (
    <OpportunityList
      title="Funding"
      kinds={['bursary', 'loan']}
      placeholder="Search bursaries, loans, scholarships"
      featured={{ id: 'nsfas', action: 'Check and apply on myNSFAS' }}
    />
  );
}
