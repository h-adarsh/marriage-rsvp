import { describe, it, expect } from 'vitest';
import {
  parseCsvRows,
  processHouseholdCsv,
  checkDuplicates,
  normalizePhone,
  normalizeName,
} from '../../src/services/csv';

describe('CSV Parsing & Duplicate Detection Engine', () => {
  it('parses standard and quoted CSV text with CRLF and commas inside quotes', () => {
    const csv = `Household Name,Primary Contact,Phone,Expected Party Size\r\n"Sharma, Rajesh",Rajesh Sharma,+919876543210,4\r\nVerma Family,Sunita Verma,9876543211,2`;
    const rows = parseCsvRows(csv);

    expect(rows).toHaveLength(3);
    expect(rows[0]).toEqual(['Household Name', 'Primary Contact', 'Phone', 'Expected Party Size']);
    expect(rows[1]).toEqual(['Sharma, Rajesh', 'Rajesh Sharma', '+919876543210', '4']);
    expect(rows[2]).toEqual(['Verma Family', 'Sunita Verma', '9876543211', '2']);
  });

  it('normalizes phone numbers and names consistently', () => {
    expect(normalizePhone('+91 98765-43210')).toBe('+919876543210');
    expect(normalizePhone('(022) 2345 6789')).toBe('+912223456789');

    expect(normalizeName('The Kapoor Family')).toBe('thekapoorfamily');
    expect(normalizeName('  Kapoor   Family! ')).toBe('kapoorfamily');
  });

  it('validates rows and extracts valid and invalid items', () => {
    const csv = `Household Name,Contact,Phone,Party Size,Notes
Kapoor Family,Anil Kapoor,+919876543210,3,VIP
,Missing Name,+919876543211,2,
Invalid Phone Family,John Doe,1234,2,
Verma Family,Sunita Verma,+919876543212,0,Valid with fallback`;

    const { validRows, invalidRows } = processHouseholdCsv(csv);

    expect(validRows).toHaveLength(2);
    expect(invalidRows).toHaveLength(2);

    expect(validRows[0].name).toBe('Kapoor Family');
    expect(validRows[0].expectedPartySize).toBe(3);

    // Checks fallback to 1 for party size 0
    expect(validRows[1].name).toBe('Verma Family');
    expect(validRows[1].expectedPartySize).toBe(1);

    expect(invalidRows[0].validationError).toMatch(/name is missing/i);
    expect(invalidRows[1].validationError).toMatch(/invalid phone/i);
  });

  it('allows two different families sharing the same surname/name with different phones', () => {
    const incoming = [
      {
        rowNumber: 2,
        name: 'Sharma Family',
        primaryContactName: 'Rajesh Sharma',
        phone: '+919876543210',
        expectedPartySize: 4,
        isValid: true,
      },
      {
        rowNumber: 3,
        name: 'Sharma Family',
        primaryContactName: 'Amit Sharma', // Different contact & different phone
        phone: '+919876543299',
        expectedPartySize: 2,
        isValid: true,
      },
    ];

    const { duplicates, uniqueRows } = checkDuplicates(incoming, []);

    expect(duplicates).toHaveLength(0);
    expect(uniqueRows).toHaveLength(2);
    expect(uniqueRows[0].primaryContactName).toBe('Rajesh Sharma');
    expect(uniqueRows[1].primaryContactName).toBe('Amit Sharma');
  });

  it('detects duplicate phone even with different household spelling or name', () => {
    const incoming = [
      {
        rowNumber: 2,
        name: 'Sharma Residence',
        primaryContactName: 'R. Sharma',
        phone: '9876543210', // 10-digit version
        expectedPartySize: 3,
        isValid: true,
      },
    ];

    const existing = [
      { id: '1', name: 'The Sharma Family', primaryContactName: 'Rajesh Sharma', phone: '+91 98765-43210' },
    ];

    const { duplicates, uniqueRows } = checkDuplicates(incoming, existing);

    expect(duplicates).toHaveLength(1);
    expect(duplicates[0].reason).toMatch(/phone matches existing household/i);
    expect(uniqueRows).toHaveLength(0);
  });

  it('detects duplicate when both household name and primary contact match an existing record', () => {
    const incoming = [
      {
        rowNumber: 2,
        name: 'Kapoor Household',
        primaryContactName: 'Anil Kapoor',
        phone: '+919111122222',
        expectedPartySize: 2,
        isValid: true,
      },
    ];

    const existing = [
      { id: '1', name: 'Kapoor Household', primaryContactName: 'Anil Kapoor', phone: '+919999988888' },
    ];

    const { duplicates, uniqueRows } = checkDuplicates(incoming, existing);

    expect(duplicates).toHaveLength(1);
    expect(duplicates[0].reason).toMatch(/both household name and contact match/i);
    expect(uniqueRows).toHaveLength(0);
  });

  it('detects intra-batch duplicates inside the same uploaded CSV file', () => {
    const incoming = [
      {
        rowNumber: 2,
        name: 'Bhatia Family',
        primaryContactName: 'Rohit Bhatia',
        phone: '+919876500000',
        expectedPartySize: 2,
        isValid: true,
      },
      {
        rowNumber: 3,
        name: 'Bhatia Family Duplicate',
        primaryContactName: 'Same Phone Person',
        phone: '+919876500000', // duplicate phone
        expectedPartySize: 1,
        isValid: true,
      },
    ];

    const { duplicates, uniqueRows } = checkDuplicates(incoming, []);

    expect(duplicates).toHaveLength(1);
    expect(duplicates[0].rowNumber).toBe(3);
    expect(duplicates[0].reason).toMatch(/within the uploaded file/i);

    expect(uniqueRows).toHaveLength(1);
    expect(uniqueRows[0].rowNumber).toBe(2);
  });

  it('correctly handles non-ASCII / Devanagari Hindi names without false duplicates', () => {
    const incoming = [
      {
        rowNumber: 2,
        name: 'कपूर परिवार',
        primaryContactName: 'अदिति शर्मा',
        phone: '+919876500030',
        expectedPartySize: 4,
        isValid: true,
      },
      {
        rowNumber: 3,
        name: 'मेहता परिवार',
        primaryContactName: 'राजेश मेहता',
        phone: '+919876500031',
        expectedPartySize: 2,
        isValid: true,
      },
    ];

    const { duplicates, uniqueRows } = checkDuplicates(incoming, []);

    expect(duplicates).toHaveLength(0);
    expect(uniqueRows).toHaveLength(2);
    expect(uniqueRows[0].name).toBe('कपूर परिवार');
    expect(uniqueRows[1].name).toBe('मेहता परिवार');
  });

  it('normalizes 10-digit Indian phones to match +91 formatted numbers in duplicate detection', () => {
    expect(normalizePhone('9876543210')).toBe('+919876543210');
    expect(normalizePhone('+919876543210')).toBe('+919876543210');
    expect(normalizePhone('09876543210')).toBe('+919876543210');
    expect(normalizePhone('+91 98765-43210')).toBe('+919876543210');

    const incoming = [
      {
        rowNumber: 2,
        name: 'Deshmukh Household',
        primaryContactName: 'Amit Deshmukh',
        phone: '9876543210', // 10-digit format
        expectedPartySize: 3,
        isValid: true,
      },
    ];

    const existing = [
      { id: '1', name: 'Existing Deshmukh', phone: '+91 98765 43210' }, // E.164 format
    ];

    const { duplicates, uniqueRows } = checkDuplicates(incoming, existing);

    expect(duplicates).toHaveLength(1);
    expect(duplicates[0].reason).toMatch(/matches existing household/i);
    expect(uniqueRows).toHaveLength(0);
  });

  it('normalizes Devanagari Unicode NFC so composed and decomposed code points match', () => {
    // Precomposed: \u095C (ड़) vs Decomposed: \u0921\u093C (ड + ़)
    const nameComposed = 'बड़ा परिवार';
    const nameDecomposed = 'ब\u0921\u093Cा परिवार';

    expect(normalizeName(nameComposed)).toBe(normalizeName(nameDecomposed));

    const incoming = [
      {
        rowNumber: 2,
        name: nameDecomposed,
        primaryContactName: 'Contact Person',
        phone: '+919876500099',
        expectedPartySize: 2,
        isValid: true,
      },
    ];

    const existing = [
      { id: '1', name: nameComposed, primaryContactName: 'Contact Person', phone: '+919876500099' },
    ];

    const { duplicates } = checkDuplicates(incoming, existing);
    expect(duplicates).toHaveLength(1);
  });

  it('ensures two empty phone numbers never match each other as duplicate phones', () => {
    const incoming = [
      {
        rowNumber: 2,
        name: 'Household Without Phone 1',
        primaryContactName: 'Contact One',
        phone: '',
        expectedPartySize: 2,
        isValid: true,
      },
      {
        rowNumber: 3,
        name: 'Household Without Phone 2',
        primaryContactName: 'Contact Two',
        phone: '',
        expectedPartySize: 3,
        isValid: true,
      },
    ];

    const { duplicates, uniqueRows } = checkDuplicates(incoming, []);
    expect(duplicates).toHaveLength(0);
    expect(uniqueRows).toHaveLength(2);
  });

  it('allows shared phone number across distinct households when allowSharedPhone is enabled', () => {
    const incoming = [
      {
        rowNumber: 2,
        name: 'Sharma Elders Household',
        primaryContactName: 'Dinesh Sharma',
        phone: '+919876543210', // Shared phone
        expectedPartySize: 2,
        isValid: true,
      },
    ];

    const existing = [
      { id: '1', name: 'Sharma Son Household', primaryContactName: 'Rohit Sharma', phone: '+919876543210' },
    ];

    // Default (strict): flags as duplicate warning
    const defaultRes = checkDuplicates(incoming, existing);
    expect(defaultRes.duplicates).toHaveLength(1);
    expect(defaultRes.uniqueRows).toHaveLength(0);

    // Override enabled: allowed because primaryContactName and household name are distinct
    const overrideRes = checkDuplicates(incoming, existing, { allowSharedPhone: true });
    expect(overrideRes.duplicates).toHaveLength(0);
    expect(overrideRes.uniqueRows).toHaveLength(1);
  });

  it('supports per-row override via overriddenRowNumbers allowing specific rows while keeping others flagged', () => {
    const incoming = [
      {
        rowNumber: 2,
        name: 'Sharma Elders Household',
        primaryContactName: 'Dinesh Sharma',
        phone: '+919876543210', // Shared phone with existing
        expectedPartySize: 2,
        isValid: true,
      },
      {
        rowNumber: 3,
        name: 'Verma Shared Household',
        primaryContactName: 'Ajay Verma',
        phone: '+919876543211', // Shared phone with another existing
        expectedPartySize: 3,
        isValid: true,
      },
    ];

    const existing = [
      { id: '1', name: 'Sharma Son', primaryContactName: 'Rohit Sharma', phone: '+919876543210' },
      { id: '2', name: 'Verma Senior', primaryContactName: 'K. Verma', phone: '+919876543211' },
    ];

    // Override only row 2
    const res = checkDuplicates(incoming, existing, { overriddenRowNumbers: [2] });

    expect(res.duplicates).toHaveLength(1);
    expect(res.duplicates[0].rowNumber).toBe(3); // Row 3 remains flagged
    expect(res.uniqueRows).toHaveLength(1);
    expect(res.uniqueRows[0].rowNumber).toBe(2); // Row 2 was imported via per-row override
  });
});

