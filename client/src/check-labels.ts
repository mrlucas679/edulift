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

// Plain name for a scoring scheme, for the scores screen.
export function schemeLabel(scheme: string | null): string {
  if (!scheme) return 'Scheme not verified yet';
  return SCHEME_NAME[scheme] ?? 'Score';
}
