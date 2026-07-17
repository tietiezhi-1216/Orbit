const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/**
 * How long ago `timestamp` (ms since epoch) was, in Chinese: seconds up to a
 * minute, then minutes / hours / days, falling back to a date past a month.
 * Returns null for messages written before timestamps existed (0).
 */
export function formatRelativeTime(timestamp: number, now = Date.now()): string | null {
  if (!timestamp) return null;

  const elapsed = Math.max(0, now - timestamp);
  if (elapsed < MINUTE) {
    const seconds = Math.floor(elapsed / 1000);
    return seconds <= 1 ? "刚刚" : `${seconds} 秒前`;
  }
  if (elapsed < HOUR) return `${Math.floor(elapsed / MINUTE)} 分钟前`;
  if (elapsed < DAY) return `${Math.floor(elapsed / HOUR)} 小时前`;
  if (elapsed < 30 * DAY) return `${Math.floor(elapsed / DAY)} 天前`;

  const date = new Date(timestamp);
  const sameYear = date.getFullYear() === new Date(now).getFullYear();
  const month = date.getMonth() + 1;
  const day = date.getDate();
  return sameYear ? `${month} 月 ${day} 日` : `${date.getFullYear()} 年 ${month} 月 ${day} 日`;
}
