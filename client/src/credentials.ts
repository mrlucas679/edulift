// The same rules the API applies (api/app/schemas.py, api/app/passwords.py). The API is the
// authority; checking here only saves a round trip and says the rule before it is broken.

export const USERNAME_RULE = '3 to 30 letters, numbers, dots or underscores.';
export const PASSWORD_RULE = 'At least 15 characters. A few unrelated words work well, like “copper lantern mango”.';
export const MIN_PASSWORD = 15;
export const MAX_PASSWORD = 128;

const USERNAME = /^[A-Za-z0-9._]{3,30}$/;

export function usernameProblem(username: string): string | null {
  if (!username) return null;
  return USERNAME.test(username) ? null : `Usernames use ${USERNAME_RULE.toLowerCase()}`;
}

export function passwordProblem(password: string, username: string): string | null {
  if (!password) return null;
  if (password.length < MIN_PASSWORD) return `Use at least ${MIN_PASSWORD} characters (${password.length} so far).`;
  if (password.length > MAX_PASSWORD) return `Use at most ${MAX_PASSWORD} characters.`;
  if (username && password.toLowerCase().includes(username.toLowerCase())) return 'Don’t use your username in your password.';
  return null;
}
