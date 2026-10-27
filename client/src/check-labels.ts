// Plain names for the rows of a verdict, so a learner sees "UKZN APS: 33 of 30", not "score".
const SCHEME_NAME: Record<string, string> = {
  standard_best6: 'APS',
  wits_best7: 'Wits APS',
  uct_fps: 'UCT points',
  uct_science: 'UCT points',
  uct_health: 'UCT points',
  ukzn_aps: 'UKZN APS',
};

export function checkLabel(name: string, scheme: string | null): string {
  if (name === 'score') return scheme ? SCHEME_NAME[scheme] ?? 'Score' : 'Score';
  if (name.startsWith('subjects_')) return 'Subjects';
  if (name.startsWith('nbt_')) return 'NBT';
  if (name === 'next_three') return 'Other subjects';
  return name;
}

// How each scheme counts, worded as on the My scores wireframe.
const SCHEME_HOW: Record<string, string> = {
  standard_best6: 'Best 6 subjects, Life Orientation not counted',
  ukzn_aps: 'English, Maths and best 4 others; 8 points for 90%+; no Life Orientation',
  wits_best7: 'Best 6 plus Life Orientation (max 4); +2 for English and Maths at 60%+',
  uct_fps: '% of best 6 incl. English, out of 600',
  uct_science: '% of best 6 incl. English, Maths and Physical Sciences counted twice, out of 800',
  uct_health: '% of English, Maths, Physical Sciences and next 3 best, out of 600 · NBT also counts',
};

// Plain description of a scoring scheme, for the scores screen.
export function schemeLabel(scheme: string | null): string {
  if (!scheme) return 'Scheme not verified yet';
  return SCHEME_HOW[scheme] ?? SCHEME_NAME[scheme] ?? 'Score';
}
