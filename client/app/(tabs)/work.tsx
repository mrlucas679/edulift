import { OpportunityList } from '../../src/opportunity-list';

export default function Work() {
  return (
    <OpportunityList
      title="Work and skills"
      kinds={['learnership', 'work']}
      placeholder="Search learnerships and jobs"
      featured={{ id: 'sayouth', action: 'Open SA Youth' }}
    />
  );
}
