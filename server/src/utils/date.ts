/**
 * Validates whether an IANA timezone string is recognized by the runtime Intl engine.
 */
export function isValidTimeZone(timeZone?: string | null): boolean {
  if (!timeZone || typeof timeZone !== 'string') return false;
  try {
    Intl.DateTimeFormat(undefined, { timeZone });
    return true;
  } catch {
    return false;
  }
}

/**
 * Returns a safe IANA timezone, falling back to 'Asia/Kolkata' if invalid or empty.
 */
export function getSafeTimeZone(timeZone?: string | null): string {
  if (isValidTimeZone(timeZone)) {
    return timeZone!;
  }
  return 'Asia/Kolkata';
}

/**
 * Parse an incoming datetime string into a JavaScript Date.
 * If the input originates from HTML5 datetime-local (e.g. "2026-12-10T19:30")
 * without an explicit timezone or offset, interpret it as local wall-clock time
 * in the specified IANA timezone and convert to the exact UTC timestamp.
 */
export function parseWeddingDateTime(dateTimeStr: string, timeZoneInput: string = 'Asia/Kolkata'): Date {
  if (dateTimeStr.includes('Z') || dateTimeStr.match(/[+-]\d{2}(:\d{2})?$/)) {
    return new Date(dateTimeStr);
  }

  const timeZone = getSafeTimeZone(timeZoneInput);
  const [datePart, timePart = '00:00:00'] = dateTimeStr.split('T');
  const [year, month, day] = datePart.split('-').map(Number);
  const [hours, minutes, seconds = 0] = timePart.split(':').map(Number);

  let targetUtcMs = Date.UTC(year, month - 1, day, hours, minutes, seconds);

  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    second: 'numeric',
    hour12: false,
  });

  // Iteratively converge to the exact UTC millisecond matching target wall-clock
  for (let i = 0; i < 3; i++) {
    const parts = dtf.formatToParts(new Date(targetUtcMs));
    const p: Record<string, string> = {};
    for (const part of parts) p[part.type] = part.value;
    const formattedY = Number(p.year);
    const formattedM = Number(p.month);
    const formattedD = Number(p.day);
    let formattedH = Number(p.hour);
    if (formattedH === 24) formattedH = 0;
    const formattedMin = Number(p.minute);
    const formattedS = Number(p.second);

    const formattedUtcMs = Date.UTC(formattedY, formattedM - 1, formattedD, formattedH, formattedMin, formattedS);
    const wantedUtcMs = Date.UTC(year, month - 1, day, hours, minutes, seconds);
    const diff = wantedUtcMs - formattedUtcMs;
    if (diff === 0) break;
    targetUtcMs += diff;
  }

  return new Date(targetUtcMs);
}

/**
 * Formats a Date or ISO string into an HTML5 datetime-local string (YYYY-MM-DDTHH:mm)
 * preserving the local wall-clock time in the given IANA timezone.
 */
export function formatDateTimeForInput(date: Date | string, timeZoneInput: string = 'Asia/Kolkata'): string {
  const timeZone = getSafeTimeZone(timeZoneInput);
  const d = new Date(date);
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
  const parts = dtf.formatToParts(d);
  const p: Record<string, string> = {};
  for (const part of parts) p[part.type] = part.value;
  let hour = p.hour;
  if (hour === '24') hour = '00';
  return `${p.year}-${p.month}-${p.day}T${hour}:${p.minute}`;
}

/**
 * Formats a Date into a human-readable string in the specified IANA timezone.
 */
export function formatDateTimeInZone(date: Date | string, timeZoneInput: string = 'Asia/Kolkata'): string {
  const timeZone = getSafeTimeZone(timeZoneInput);
  const d = new Date(date);
  const dateStr = d.toLocaleDateString('en-IN', {
    timeZone,
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
  const timeStr = d.toLocaleTimeString('en-IN', {
    timeZone,
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
  return `${dateStr} ${timeStr} (${timeZone})`;
}
