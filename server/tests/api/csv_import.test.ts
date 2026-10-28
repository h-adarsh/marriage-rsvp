import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app } from '../../src/app';

describe('CSV Import Endpoint Protection & File Validation', () => {
  it('blocks unauthenticated access to import-csv with 401', async () => {
    const res = await request(app)
      .post('/api/weddings/some-wedding-id/households/import-csv')
      .attach('file', Buffer.from('Household Name,Primary Contact,Phone\nTest,Test,1234567890'), 'guests.csv');

    expect(res.status).toBe(401);
    expect(res.body.error).toMatch(/authentication required/i);
  });
});
