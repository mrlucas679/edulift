const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// "2026-10-31" → "31 Oct", or "31 Oct 2027" when it isn't this year.
export function shortDate(iso: string | null | undefined): string {
  const m = iso?.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return iso ?? '';
  const [, y, mo, d] = m;
  const label = `${Number(d)} ${MONTHS[Number(mo) - 1]}`;
  return Number(y) === new Date().getFullYear() ? label : `${label} ${y}`;
}

export const isOpen = (closesOn: string | null) => !closesOn || new Date(`${closesOn}T23:59:59`).getTime() >= Date.now();
