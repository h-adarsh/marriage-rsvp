import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { app } from '../../src/app';

describe('CSV Import Robustness & Edge Cases (API)', () => {
  let cookie: string;
  let weddingId: string;

  beforeAll(async () => {
    const timestamp = Date.now();
    const res = await request(app)
      .post('/api/auth/register')
      .send({
        email: `csv_tester_${timestamp}@test.com`,
        password: 'Password123!',
        name: 'CSV Tester',
      });
    expect(res.status).toBe(201);
    cookie = res.headers['set-cookie']?.[0]?.split(';')[0] || '';

    const wedRes = await request(app)
      .post('/api/weddings')
      .set('Cookie', cookie)
      .send({
        title: 'CSV Test Wedding',
        coupleNames: 'Bride & Groom',
        startDate: '2026-12-10',
        endDate: '2026-12-12',
      });
    expect(wedRes.status).toBe(201);
    weddingId = wedRes.body.id;
  });

  it('correctly accepts 10-digit Indian phone numbers without country code', async () => {
    const csvContent = `Household Name,Primary Contact,Phone Number,Party Size,Notes
Deshmukh Family,Amit Deshmukh,9876543210,4,Veg only`;

    const res = await request(app)
      .post(`/api/weddings/${weddingId}/households/import-csv?dryRun=true`)
      .set('Cookie', cookie)
      .attach('file', Buffer.from(csvContent, 'utf-8'), '10_digit.csv');

    expect(res.status).toBe(200);
    expect(res.body.validCount).toBe(1);
    expect(res.body.previewRows[0].phone).toBe('+919876543210');
  });

  it('handles Hindi / Devanagari names without false duplicates', async () => {
    const csvContent = `Household Name,Primary Contact,Phone Number,Party Size,Notes
कपूर परिवार,अदिति शर्मा,+919876500030,4,शाकाहारी
मेहता परिवार,राजेश मेहता,+919876500031,2,जैन खाना`;

    const res = await request(app)
      .post(`/api/weddings/${weddingId}/households/import-csv?dryRun=true`)
      .set('Cookie', cookie)
      .attach('file', Buffer.from(csvContent, 'utf-8'), 'hindi.csv');

    expect(res.status).toBe(200);
    expect(res.body.validCount).toBe(2);
    expect(res.body.duplicateCount).toBe(0);
    expect(res.body.previewRows[0].name).toBe('कपूर परिवार');
    expect(res.body.previewRows[1].name).toBe('मेहता परिवार');
  });

  it('handles Excel-saved CSV with UTF-8 BOM and CRLF line endings', async () => {
    const csvContent = '\uFEFFHousehold Name,Primary Contact,Phone Number,Party Size,Notes\r\nExcel Family,Pooja Patel,9876500050,3,Excel test\r\n';

    const res = await request(app)
      .post(`/api/weddings/${weddingId}/households/import-csv?dryRun=true`)
      .set('Cookie', cookie)
      .attach('file', Buffer.from(csvContent, 'utf-8'), 'excel.csv');

    expect(res.status).toBe(200);
    expect(res.body.validCount).toBe(1);
    expect(res.body.previewRows[0].name).toBe('Excel Family');
  });

  it('gracefully ignores blank lines between and after data rows', async () => {
    const csvContent = `Household Name,Primary Contact,Phone Number,Party Size,Notes

Sharma Family,Rohit Sharma,+919876500010,3,Middle blank

Verma Family,Sanjay Verma,+919876500011,4,Trailing blank

`;

    const res = await request(app)
      .post(`/api/weddings/${weddingId}/households/import-csv?dryRun=true`)
      .set('Cookie', cookie)
      .attach('file', Buffer.from(csvContent, 'utf-8'), 'blanks.csv');

    expect(res.status).toBe(200);
    expect(res.body.validCount).toBe(2);
    expect(res.body.invalidCount).toBe(0);
  });

  it('rejects files exceeding 2MB with HTTP 413 and clean JSON error', async () => {
    const line = 'Large Family,Large Contact,+919876500099,4,Large payload testing\n';
    const repeatCount = Math.ceil((2.1 * 1024 * 1024) / line.length);
    const largeBuffer = Buffer.from('Household Name,Primary Contact,Phone Number,Party Size,Notes\n' + line.repeat(repeatCount), 'utf-8');

    const res = await request(app)
      .post(`/api/weddings/${weddingId}/households/import-csv?dryRun=true`)
      .set('Cookie', cookie)
      .attach('file', largeBuffer, 'huge.csv');

    expect(res.status).toBe(413);
    expect(res.body.error).toMatch(/exceeds 2mb/i);
  });
});
