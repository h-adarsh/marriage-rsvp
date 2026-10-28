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

  it('detects existing phone duplicates and existing name duplicates', () => {
    const incoming = [
      {
        rowNumber: 2,
        name: 'Sharma Family',
        primaryContactName: 'Rajesh Sharma',
        phone: '+919876543210',
        expectedPartySize: 3,
        isValid: true,
      },
      {
        rowNumber: 3,
        name: 'Kapoor Household',
        primaryContactName: 'Anil Kapoor',
        phone: '+919999999999',
        expectedPartySize: 2,
        isValid: true,
      },
      {
        rowNumber: 4,
        name: 'Gupta Family',
        primaryContactName: 'Vikas Gupta',
        phone: '+918888888888',
        expectedPartySize: 4,
        isValid: true,
      },
    ];

    const existing = [
      { id: '1', name: 'Existing Sharma', phone: '+91 98765 43210' }, // Matches phone of row 2
      { id: '2', name: 'Kapoor Household', phone: '+91 11111 22222' }, // Matches name of row 3
    ];

    const { duplicates, uniqueRows } = checkDuplicates(incoming, existing);

    expect(duplicates).toHaveLength(2);
    expect(duplicates[0].rowNumber).toBe(2);
    expect(duplicates[0].reason).toMatch(/matches existing household/i);

    expect(duplicates[1].rowNumber).toBe(3);
    expect(duplicates[1].reason).toMatch(/matches existing household/i);

    expect(uniqueRows).toHaveLength(1);
    expect(uniqueRows[0].name).toBe('Gupta Family');
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
});
