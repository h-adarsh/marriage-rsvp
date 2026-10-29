import { eq, and } from 'drizzle-orm';
import { db } from '../db';
import { householdFunctions, households, rsvps, functions, weddings } from '../db/schema';
import { calculateHeadcountFromRows, HeadcountOptions } from './headcount';

/**
 * CWE-1236 Defense: Neutralize CSV formula injection.
 * If a field starts with '=', '+', '-', '@', '\t', or '\r', spreadsheet engines
 * like Excel, Calc, and Google Sheets may execute arbitrary commands or formulas.
 * Prepending a single quote (') forces spreadsheet applications to treat the cell as plain text.
 */
export function sanitizeCsvField(val: string | number | null | undefined): string {
  if (val === null || val === undefined) {
    return '';
  }

  const str = String(val);
  if (str.length === 0) {
    return '';
  }

  let sanitized = str;

  // Check for dangerous formula trigger prefix
  const firstChar = str[0];
  if (firstChar === '=' || firstChar === '+' || firstChar === '-' || firstChar === '@' || firstChar === '\t' || firstChar === '\r') {
    sanitized = `'${str}`;
  }

  // RFC 4180: If field contains quotes, commas, or newlines, escape inner quotes and wrap in double quotes
  if (sanitized.includes('"') || sanitized.includes(',') || sanitized.includes('\n') || sanitized.includes('\r')) {
    return `"${sanitized.replace(/"/g, '""')}"`;
  }

  return sanitized;
}

export interface CatererExportData {
  weddingTitle: string;
  coupleNames: string;
  functionName: string;
  dateTime: Date | string;
  venue: string;
  exportedAt: Date;
  summary: {
    totalInvitedHouseholds: number;
    totalInvitedHeadcount: number;
    confirmedHeadcount: number;
    vegCount: number;
    nonvegCount: number;
    maybeHeadcount: number;
    declinedHeadcount: number;
    noResponseHeadcount: number;
    planningEstimate: number;
    maybePct: number;
    formula: string;
  };
  rows: Array<{
    householdName: string;
    primaryContact: string;
    phone: string | null;
    status: 'yes' | 'no' | 'maybe' | 'no_response';
    partySize: number;
    vegCount: number;
    nonvegCount: number;
    dietaryNotes: string | null;
  }>;
}

/**
 * Builds standard RFC 4180 CSV text with formula injection protection
 */
export function buildCatererCsv(data: CatererExportData): string {
  const lines: string[] = [];

  // 1. Header Metadata Section
  lines.push('WEDDING CATERING HEADCOUNT & DIETARY SUMMARY');
  lines.push(`Wedding Title,${sanitizeCsvField(data.weddingTitle)}`);
  lines.push(`Couple Names,${sanitizeCsvField(data.coupleNames)}`);
  lines.push(`Function Name,${sanitizeCsvField(data.functionName)}`);
  const formattedDate = new Date(data.dateTime).toISOString().replace('T', ' ').substring(0, 19) + ' UTC';
  lines.push(`Event Date & Time,${sanitizeCsvField(formattedDate)}`);
  lines.push(`Venue,${sanitizeCsvField(data.venue)}`);
  const exportTimestamp = data.exportedAt.toISOString().replace('T', ' ').substring(0, 19) + ' UTC';
  lines.push(`Export Generated At,${sanitizeCsvField(exportTimestamp)}`);
  lines.push('');

  // 2. Headcount & Catering Totals Section
  lines.push('CATERING HEADCOUNT SUMMARY');
  lines.push(`Confirmed Headcount (People),${data.summary.confirmedHeadcount}`);
  lines.push(`Vegetarian Meals (Confirmed),${data.summary.vegCount}`);
  lines.push(`Non-Vegetarian Meals (Confirmed),${data.summary.nonvegCount}`);
  lines.push(`Planning Estimate (${data.summary.maybePct}% Maybe Buffer),${data.summary.planningEstimate}`);
  lines.push(`Tentative (Maybe) Headcount,${data.summary.maybeHeadcount}`);
  lines.push(`Declined Headcount,${data.summary.declinedHeadcount}`);
  lines.push(`Pending (No Response) Headcount,${data.summary.noResponseHeadcount}`);
  lines.push(`Total Invited Households,${data.summary.totalInvitedHouseholds}`);
  lines.push(`Planning Formula,${sanitizeCsvField(data.summary.formula)}`);
  lines.push('');

  // 3. Detailed Guest Breakdown Table
  lines.push('DETAILED GUEST & DIETARY BREAKDOWN');
  lines.push(
    [
      'Household Name',
      'Primary Contact',
      'Phone Number',
      'RSVP Status',
      'Headcount (Party Size)',
      'Vegetarian Meals',
      'Non-Vegetarian Meals',
      'Dietary Notes / Allergies',
    ].join(',')
  );

  for (const row of data.rows) {
    const statusLabel =
      row.status === 'yes'
        ? 'Confirmed'
        : row.status === 'maybe'
        ? 'Tentative (Maybe)'
        : row.status === 'no'
        ? 'Declined'
        : 'Pending (No Response)';

    const line = [
      sanitizeCsvField(row.householdName),
      sanitizeCsvField(row.primaryContact),
      sanitizeCsvField(row.phone || ''),
      sanitizeCsvField(statusLabel),
      sanitizeCsvField(row.partySize),
      sanitizeCsvField(row.vegCount),
      sanitizeCsvField(row.nonvegCount),
      sanitizeCsvField(row.dietaryNotes || ''),
    ].join(',');

    lines.push(line);
  }

  // Prepend UTF-8 BOM so Excel opens non-ASCII characters (e.g. Hindi/Devanagari names) cleanly
  return '\uFEFF' + lines.join('\r\n');
}

/**
 * Sanitize filename for safe HTTP Content-Disposition attachment header
 */
export function buildExportFilename(
  weddingTitle: string,
  functionName: string,
  date = new Date()
): string {
  const sanitize = (name: string) =>
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '');

  const cleanWedding = sanitize(weddingTitle) || 'wedding';
  const cleanFunction = sanitize(functionName) || 'function';
  const timestamp = date.toISOString().split('T')[0];

  return `${cleanWedding}_${cleanFunction}_caterer_${timestamp}.csv`;
}

/**
 * Fetches all necessary function, wedding, household, and RSVP data and generates caterer CSV.
 */
export async function generateCatererCsvData(
  functionId: string,
  options?: HeadcountOptions
): Promise<{ filename: string; csvContent: string }> {
  // 1. Fetch function and wedding metadata
  const [fn] = await db
    .select({
      functionId: functions.id,
      functionName: functions.name,
      dateTime: functions.dateTime,
      venue: functions.venue,
      weddingId: weddings.id,
      weddingTitle: weddings.title,
      coupleNames: weddings.coupleNames,
    })
    .from(functions)
    .innerJoin(weddings, eq(functions.weddingId, weddings.id))
    .where(eq(functions.id, functionId))
    .limit(1);

  if (!fn) {
    throw new Error('Function not found');
  }

  // 2. Fetch all invited households and RSVP responses for this function
  const rawRows = await db
    .select({
      householdId: householdFunctions.householdId,
      householdName: households.name,
      primaryContact: households.primaryContactName,
      phone: households.phone,
      expectedPartySize: households.expectedPartySize,
      rsvpStatus: rsvps.status,
      rsvpPartySize: rsvps.partySize,
      rsvpVegCount: rsvps.vegCount,
      rsvpNonvegCount: rsvps.nonvegCount,
      rsvpDietaryNotes: rsvps.dietaryNotes,
      rsvpRespondedAt: rsvps.respondedAt,
    })
    .from(householdFunctions)
    .innerJoin(households, eq(householdFunctions.householdId, households.id))
    .leftJoin(
      rsvps,
      and(
        eq(rsvps.functionId, householdFunctions.functionId),
        eq(rsvps.householdId, householdFunctions.householdId)
      )
    )
    .where(eq(householdFunctions.functionId, functionId));

  // 3. Compute headcount summary using the shared calculation engine
  const metrics = calculateHeadcountFromRows(functionId, rawRows as any, options);

  // 4. Format detailed breakdown rows
  const detailedRows = rawRows.map((r) => {
    const status = (r.rsvpStatus as 'yes' | 'no' | 'maybe') || 'no_response';
    const partySize =
      status === 'yes'
        ? r.rsvpPartySize || r.expectedPartySize
        : status === 'maybe'
        ? r.rsvpPartySize && r.rsvpPartySize > 0
          ? r.rsvpPartySize
          : r.expectedPartySize
        : status === 'no'
        ? 0
        : r.expectedPartySize;

    return {
      householdName: r.householdName,
      primaryContact: r.primaryContact,
      phone: r.phone,
      status,
      partySize,
      vegCount: status === 'yes' ? r.rsvpVegCount || 0 : 0,
      nonvegCount: status === 'yes' ? r.rsvpNonvegCount || 0 : 0,
      dietaryNotes: r.rsvpDietaryNotes || null,
    };
  });

  const exportData: CatererExportData = {
    weddingTitle: fn.weddingTitle,
    coupleNames: fn.coupleNames,
    functionName: fn.functionName,
    dateTime: fn.dateTime,
    venue: fn.venue,
    exportedAt: new Date(),
    summary: {
      totalInvitedHouseholds: metrics.invitedCount,
      totalInvitedHeadcount: metrics.totalInvitedHeadcount,
      confirmedHeadcount: metrics.confirmedHeadcount,
      vegCount: metrics.vegCount,
      nonvegCount: metrics.nonvegCount,
      maybeHeadcount: metrics.maybeHeadcount,
      declinedHeadcount: metrics.declinedHeadcount,
      noResponseHeadcount: metrics.noResponseHeadcount,
      planningEstimate: metrics.planningEstimate,
      maybePct: metrics.maybePct,
      formula: metrics.formula,
    },
    rows: detailedRows,
  };

  const filename = buildExportFilename(fn.weddingTitle, fn.functionName, exportData.exportedAt);
  const csvContent = buildCatererCsv(exportData);

  return { filename, csvContent };
}
