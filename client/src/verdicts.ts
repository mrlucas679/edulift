// Plain-language outcome lines. The API decides the outcome; this only words it.
export const OUTCOMES: Record<string, string> = {
  qualifies: 'You meet the published minimums.',
  qualifies_selection: 'You meet the minimums. This programme selects, so a place isn’t guaranteed.',
  qualifies_unconfirmed: 'You meet what we could confirm. Check the rest with the institution.',
  aps_only: 'Your score is enough, but some subject marks are short.',
  subjects_only: 'Your subjects are fine, but your score is short.',
  not_eligible: 'Both your score and some subjects are short.',
  closed: 'Applications for this intake have closed.',
  incomplete: 'Add at least six subjects plus Life Orientation to get a result.',
};

// The short tag beside a course, as on the wireframes.
export const BANNER: Record<string, string> = {
  qualifies: 'You qualify',
  qualifies_selection: 'You qualify',
  qualifies_unconfirmed: 'Not confirmed',
  aps_only: 'Subjects short',
  subjects_only: 'Score short',
  not_eligible: 'Not eligible',
  closed: 'Closed',
  incomplete: 'Add marks',
};

export const isGood = (outcome: string) => outcome === 'qualifies' || outcome === 'qualifies_selection';
