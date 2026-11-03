// The API's name rule (api/app/schemas.py). The API decides; this only says the rule early.
export const NAME_RULE = 'Use letters, spaces, apostrophes and hyphens only, like Mary-Jane or O’Neil.';

const NAME = /^[\p{L}\p{M}]+(?:[ '’-][\p{L}\p{M}]+)*$/u;

export function nameProblem(name: string): string | null {
  return name === '' || NAME.test(name) ? null : NAME_RULE;
}
