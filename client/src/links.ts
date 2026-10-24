export function safeHost(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:' ? parsed.hostname : null;
  } catch {
    return null;
  }
}
