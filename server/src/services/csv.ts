export interface ParsedHouseholdRow {
  rowNumber: number;
  name: string;
  primaryContactName: string;
  phone: string;
  expectedPartySize: number;
  notes?: string;
  isValid: boolean;
  validationError?: string;
}

export interface DuplicateReport {
  rowNumber: number;
  name: string;
  phone: string;
  reason: string;
}

export interface ExistingHouseholdSummary {
  id: string;
  name: string;
  phone: string;
}

/**
 * Robust CSV parser that correctly handles quoted strings, escaped quotes, and newlines
 */
export function parseCsvRows(csvText: string): string[][] {
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentField = '';
  let insideQuotes = false;

  const text = csvText.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const nextChar = text[i + 1];

    if (char === '"') {
      if (insideQuotes && nextChar === '"') {
        currentField += '"';
        i++; // skip escaped quote
      } else {
        insideQuotes = !insideQuotes;
      }
    } else if (char === ',' && !insideQuotes) {
      currentRow.push(currentField.trim());
      currentField = '';
    } else if (char === '\n' && !insideQuotes) {
      currentRow.push(currentField.trim());
      if (currentRow.some((f) => f.length > 0)) {
        rows.push(currentRow);
      }
      currentRow = [];
      currentField = '';
    } else {
      currentField += char;
    }
  }

  if (currentField.length > 0 || currentRow.length > 0) {
    currentRow.push(currentField.trim());
    if (currentRow.some((f) => f.length > 0)) {
      rows.push(currentRow);
    }
  }

  return rows;
}

/**
 * Normalizes phone numbers for duplicate comparison and storage.
 * Handles standard 10-digit Indian numbers, leading 0, and country code prefix (+91).
 */
export function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 10) return `+91${digits}`;
  if (digits.length === 11 && digits.startsWith('0')) return `+91${digits.slice(1)}`;
  if (digits.length === 12 && digits.startsWith('91')) return `+${digits}`;
  return phone.startsWith('+') ? `+${digits}` : (digits ? `+${digits}` : '');
}

/**
 * Normalizes household names for fuzzy comparison across languages (including Devanagari/Hindi).
 * Preserves unicode letters (\p{L}), marks (\p{M}), and numbers (\p{N}).
 */
export function normalizeName(name: string): string {
  return name.toLowerCase().replace(/[^\p{L}\p{M}\p{N}]/gu, '').trim();
}

/**
 * Parses and validates CSV rows from raw text into structured household candidates
 */
export function processHouseholdCsv(csvContent: string): {
  validRows: ParsedHouseholdRow[];
  invalidRows: ParsedHouseholdRow[];
} {
  const rawRows = parseCsvRows(csvContent);
  if (rawRows.length < 2) {
    return { validRows: [], invalidRows: [] };
  }

  const header = rawRows[0].map((h) => h.toLowerCase().replace(/[^a-z0-9]/g, ''));
  
  // Find column indexes with flexible header naming
  const nameIdx = header.findIndex((h) => h.includes('household') || h.includes('family') || h === 'name');
  const contactIdx = header.findIndex((h) => h.includes('contact') || h.includes('primary'));
  const phoneIdx = header.findIndex((h) => h.includes('phone') || h.includes('mobile'));
  const sizeIdx = header.findIndex((h) => h.includes('party') || h.includes('size') || h.includes('guest') || h.includes('count'));
  const notesIdx = header.findIndex((h) => h.includes('note') || h.includes('comment'));

  const validRows: ParsedHouseholdRow[] = [];
  const invalidRows: ParsedHouseholdRow[] = [];

  for (let i = 1; i < rawRows.length; i++) {
    const row = rawRows[i];
    const rowNum = i + 1;

    const rawName = nameIdx !== -1 && row[nameIdx] ? row[nameIdx].trim() : '';
    const rawContact = contactIdx !== -1 && row[contactIdx] ? row[contactIdx].trim() : '';
    const rawPhone = phoneIdx !== -1 && row[phoneIdx] ? row[phoneIdx].trim() : '';
    const rawSize = sizeIdx !== -1 && row[sizeIdx] ? row[sizeIdx].trim() : '';
    const rawNotes = notesIdx !== -1 && row[notesIdx] ? row[notesIdx].trim() : '';

    const cleanPhone = normalizePhone(rawPhone);
    const parsedSize = parseInt(rawSize, 10);
    const expectedPartySize = isNaN(parsedSize) || parsedSize < 1 ? 1 : Math.min(parsedSize, 50);

    let error: string | null = null;
    if (!rawName) {
      error = 'Household name is missing';
    } else if (!rawContact) {
      error = 'Primary contact name is missing';
    } else if (!cleanPhone || !/^\+?[0-9]{7,15}$/.test(cleanPhone)) {
      error = 'Invalid phone number (must be 7-15 digits)';
    }

    const parsedRow: ParsedHouseholdRow = {
      rowNumber: rowNum,
      name: rawName,
      primaryContactName: rawContact,
      phone: cleanPhone,
      expectedPartySize,
      notes: rawNotes || undefined,
      isValid: !error,
      validationError: error || undefined,
    };

    if (error) {
      invalidRows.push(parsedRow);
    } else {
      validRows.push(parsedRow);
    }
  }

  return { validRows, invalidRows };
}

/**
 * Detect duplicates between incoming rows and existing database records,
 * as well as intra-batch duplicates inside the CSV itself.
 */
export function checkDuplicates(
  incomingRows: ParsedHouseholdRow[],
  existingHouseholds: ExistingHouseholdSummary[]
): {
  duplicates: DuplicateReport[];
  uniqueRows: ParsedHouseholdRow[];
} {
  const duplicates: DuplicateReport[] = [];
  const uniqueRows: ParsedHouseholdRow[] = [];

  // Existing database lookup sets
  const existingPhones = new Map<string, string>();
  const existingNames = new Map<string, string>();

  for (const h of existingHouseholds) {
    existingPhones.set(normalizePhone(h.phone), h.name);
    existingNames.set(normalizeName(h.name), h.name);
  }

  // Intra-batch tracker sets
  const seenPhones = new Set<string>();
  const seenNames = new Set<string>();

  for (const row of incomingRows) {
    const normPhone = normalizePhone(row.phone);
    const normName = normalizeName(row.name);

    if (normPhone && existingPhones.has(normPhone)) {
      duplicates.push({
        rowNumber: row.rowNumber,
        name: row.name,
        phone: row.phone,
        reason: `Phone matches existing household "${existingPhones.get(normPhone)}"`,
      });
      continue;
    }

    if (normName && existingNames.has(normName)) {
      duplicates.push({
        rowNumber: row.rowNumber,
        name: row.name,
        phone: row.phone,
        reason: `Name matches existing household "${existingNames.get(normName)}"`,
      });
      continue;
    }

    if (normPhone && seenPhones.has(normPhone)) {
      duplicates.push({
        rowNumber: row.rowNumber,
        name: row.name,
        phone: row.phone,
        reason: 'Duplicate phone number within the uploaded file',
      });
      continue;
    }

    if (normName && seenNames.has(normName)) {
      duplicates.push({
        rowNumber: row.rowNumber,
        name: row.name,
        phone: row.phone,
        reason: 'Duplicate household name within the uploaded file',
      });
      continue;
    }

    if (normPhone) seenPhones.add(normPhone);
    if (normName) seenNames.add(normName);
    uniqueRows.push(row);
  }

  return { duplicates, uniqueRows };
}
