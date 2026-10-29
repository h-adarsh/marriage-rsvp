/**
 * Parse an incoming datetime string into a JavaScript Date.
 * If the input originates from HTML5 datetime-local (e.g. "2026-12-10T19:30")
 * without an explicit timezone or offset, interpret it in the wedding venue's
 * local timezone (defaulting to Asia/Kolkata +05:30) rather than UTC or server local time.
 */
export function parseWeddingDateTime(dateTimeStr: string, _timezone: string = 'Asia/Kolkata'): Date {
  if (!dateTimeStr.includes('Z') && !dateTimeStr.match(/[+-]\d{2}(:\d{2})?$/)) {
    // Append standard Indian Standard Time offset (+05:30)
    return new Date(`${dateTimeStr}:00+05:30`);
  }
  return new Date(dateTimeStr);
}
