import { describe, it, expect } from 'vitest';
import {
  sanitizeCsvField,
  buildCatererCsv,
  buildExportFilename,
  CatererExportData,
} from '../../src/services/csvExport';

describe('Task T3.6: Caterer CSV Export & Formula Injection Defense (Unit Tests)', () => {
  describe('sanitizeCsvField - Formula Injection Neutralization (CWE-1236)', () => {
    it('prepends single quote to dangerous formula trigger characters (=, +, -, @, \\t, \\r)', () => {
      // Equals formula
      expect(sanitizeCsvField('=1+1')).toBe(`'=1+1`);
      expect(sanitizeCsvField('=cmd|\' /C calc\'!A0')).toBe(`'=cmd|\' /C calc\'!A0`);

      // Plus symbol (e.g. phone numbers or formulas)
      expect(sanitizeCsvField('+919876543210')).toBe(`'+919876543210`);
      expect(sanitizeCsvField('+2+3')).toBe(`'+2+3`);

      // Minus symbol (e.g. negative numbers or formula trigger)
      expect(sanitizeCsvField('-5+2')).toBe(`'-5+2`);
      expect(sanitizeCsvField('-allergic to nuts')).toBe(`'-allergic to nuts`);

      // At symbol (e.g. @SUM in Google Sheets/Excel)
      expect(sanitizeCsvField('@SUM(A1:B10)')).toBe(`'@SUM(A1:B10)`);
      expect(sanitizeCsvField('@special dietary request')).toBe(`'@special dietary request`);

      // Tab character
      expect(sanitizeCsvField('\tformula')).toBe(`'\tformula`);
      // Carriage return (enclosed in quotes due to newline)
      expect(sanitizeCsvField('\rformula')).toBe(`"'\rformula"`);
    });

    it('escapes double quotes and encloses fields containing commas or quotes in quotes (RFC 4180)', () => {
      expect(sanitizeCsvField('Kapoor, Anil')).toBe('"Kapoor, Anil"');
      expect(sanitizeCsvField('He said "Hello"')).toBe('"He said ""Hello"""');
      expect(sanitizeCsvField('="malicious","formula"')).toBe(`"'=""malicious"",""formula"""`);
    });

    it('neutralizes dangerous formula syntax inside free-text dietary notes from guests', () => {
      const maliciousDietaryNotes = [
        '=cmd|\' /C calc\'!A0',
        '-2+3+cmd|\' /C calc\'!A0',
        '+allergic to shellfish',
        '@requires Jain food without garlic',
      ];

      for (const note of maliciousDietaryNotes) {
        const sanitized = sanitizeCsvField(note);
        // The inner string must begin with a single quote (') to force text evaluation in Excel
        expect(sanitized).toMatch(/^("')|(')/);
      }
    });

    it('preserves safe alphanumeric strings, numbers, null, and empty fields cleanly', () => {
      expect(sanitizeCsvField('Kapoor Family')).toBe('Kapoor Family');
      expect(sanitizeCsvField(14)).toBe('14');
      expect(sanitizeCsvField(0)).toBe('0');
      expect(sanitizeCsvField(null)).toBe('');
      expect(sanitizeCsvField(undefined)).toBe('');
      expect(sanitizeCsvField('')).toBe('');
    });
  });

  describe('buildExportFilename - Safe Attachment Naming', () => {
    it('generates a clean sanitized filename with wedding name, function name, and date', () => {
      const date = new Date('2026-10-29T12:00:00Z');
      const filename = buildExportFilename(
        "Ananya & Kabir's Wedding",
        'Sangeet & Cocktail',
        date
      );

      expect(filename).toBe('ananya_kabir_s_wedding_sangeet_cocktail_caterer_2026-10-29.csv');
      expect(filename).not.toMatch(/[&'"/\\]/); // No unsafe characters
    });

    it('falls back gracefully if wedding or function names contain only symbols', () => {
      const filename = buildExportFilename('$$$', '###', new Date('2026-10-29'));
      expect(filename).toBe('wedding_function_caterer_2026-10-29.csv');
    });
  });

  describe('buildCatererCsv - Complete Document Assembly', () => {
    it('assembles a full caterer CSV with UTF-8 BOM, metadata header, summary, and sanitized guest rows', () => {
      const sampleData: CatererExportData = {
        weddingTitle: "Ananya & Kabir's Wedding",
        coupleNames: 'Ananya Sharma & Kabir Malhotra',
        functionName: 'Sangeet & Cocktail',
        dateTime: new Date('2026-12-10T19:30:00Z'),
        venue: 'The Grand Ballroom',
        exportedAt: new Date('2026-10-29T12:00:00Z'),
        summary: {
          totalInvitedHouseholds: 2,
          totalInvitedHeadcount: 7,
          confirmedHeadcount: 4,
          vegCount: 3,
          nonvegCount: 1,
          maybeHeadcount: 3,
          declinedHeadcount: 0,
          noResponseHeadcount: 0,
          planningEstimate: 5,
          maybePct: 50,
          formula: 'Planning Estimate = Confirmed (4) + 50% of Maybe (3) = 5 guests',
        },
        rows: [
          {
            householdName: 'Kapoor Family',
            primaryContact: 'Anil Kapoor',
            phone: '+919876543210',
            status: 'yes',
            partySize: 4,
            vegCount: 3,
            nonvegCount: 1,
            dietaryNotes: '=cmd|\' /C calc\'!A0', // Malicious guest input
          },
          {
            householdName: 'Sharma Household',
            primaryContact: 'Rajesh Sharma',
            phone: '+919876543211',
            status: 'maybe',
            partySize: 3,
            vegCount: 0,
            nonvegCount: 0,
            dietaryNotes: '+vegetarian only please',
          },
        ],
      };

      const csv = buildCatererCsv(sampleData);

      // Must start with UTF-8 BOM for Excel unicode support
      expect(csv.charCodeAt(0)).toBe(0xfeff);

      // Metadata section
      expect(csv).toContain("Wedding Title,Ananya & Kabir's Wedding");
      expect(csv).toContain('Function Name,Sangeet & Cocktail');
      expect(csv).toContain('Venue,The Grand Ballroom');

      // Summary section
      expect(csv).toContain('Confirmed Headcount (People),4');
      expect(csv).toContain('Vegetarian Meals (Confirmed),3');
      expect(csv).toContain('Non-Vegetarian Meals (Confirmed),1');
      expect(csv).toContain('Planning Estimate (50% Maybe Buffer),5');

      // Table headers
      expect(csv).toContain(
        'Household Name,Primary Contact,Phone Number,RSVP Status,Headcount (Party Size),Vegetarian Meals,Non-Vegetarian Meals,Dietary Notes / Allergies'
      );

      // Data rows: phone and malicious dietary notes must be sanitized
      expect(csv).toContain("'+919876543210");
      expect(csv).toContain("'+919876543211");
      expect(csv).toContain("'=cmd|' /C calc'!A0");
      expect(csv).toContain("'+vegetarian only please");
    });
  });
});
