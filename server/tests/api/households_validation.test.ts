import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app } from '../../src/app';

describe('Household Authorization Endpoints', () => {
  it('blocks unauthenticated access to GET /api/weddings/:id/households with 401', async () => {
    const res = await request(app).get('/api/weddings/some-wedding-id/households');
    expect(res.status).toBe(401);
    expect(res.body.error).toMatch(/authentication required/i);
  });

  it('blocks unauthenticated access to POST /api/weddings/:id/households with 401', async () => {
    const res = await request(app).post('/api/weddings/some-wedding-id/households').send({
      name: 'Sharma Family',
      primaryContactName: 'Rajesh Sharma',
      phone: '+919876543210',
      expectedPartySize: 4,
    });
    expect(res.status).toBe(401);
    expect(res.body.error).toMatch(/authentication required/i);
  });

  it('blocks unauthenticated access to PUT /api/households/:id with 401', async () => {
    const res = await request(app).put('/api/households/some-household-id').send({
      name: 'Sharma Family',
      primaryContactName: 'Rajesh Sharma',
      phone: '+919876543210',
      expectedPartySize: 4,
    });
    expect(res.status).toBe(401);
  });

  it('blocks unauthenticated access to DELETE /api/households/:id with 401', async () => {
    const res = await request(app).delete('/api/households/some-household-id');
    expect(res.status).toBe(401);
  });
});
