export function monthsSince(year: number, month: number, now = new Date()): number {
  return (now.getFullYear() - year) * 12 + (now.getMonth() + 1 - month);
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "2024-09" → "Sep 2024" */
export function formatMonth(ym: string): string {
  const [y, m] = ym.split('-').map(Number);
  return `${MONTHS[m - 1]} ${y}`;
}

/** "2024-09" → "09.2024" */
export function formatMonthShort(ym: string): string {
  const [y, m] = ym.split('-');
  return `${m}.${y}`;
}

export function formatPeriod(from: string, to: string | null, short = false): string {
  const f = short ? formatMonthShort : formatMonth;
  return `${f(from)} – ${to ? f(to) : short ? 'now' : 'present'}`;
}

/**
 * Hours (0 … 24, fractional) and seconds in Ho Chi Minh City. Vietnam is UTC+7 with no daylight saving,
 * so a fixed offset is exact and cheap enough to call every frame.
 */
export function hcmClock(now = Date.now()) {
  const d = new Date(now + 7 * 3600_000);
  const seconds = d.getUTCSeconds() + d.getUTCMilliseconds() / 1000;
  const minutes = d.getUTCMinutes() + seconds / 60;
  return { hours: d.getUTCHours() + minutes / 60, minutes, seconds };
}
