import { describe, expect, it } from 'vitest';

import { nameProblem } from './names';

// The same examples as api/tests/test_input_rules.py, so the app and API agree.
describe('nameProblem', () => {
  it.each(['Thandi', 'Mary-Jane', "O'Neil", 'O’Neil', 'Ntombi Zodwa', 'Émile', 'ǃXóõ', ''])('accepts %s', (name) => {
    expect(nameProblem(name)).toBeNull();
  });
  it.each(['Th4ndi', '<b>Thandi</b>', 'Ann  Lee', '-Ann', 'Lerato_', "Robert'); DROP TABLE"])('refuses %s', (name) => {
    expect(nameProblem(name)).not.toBeNull();
  });
});
