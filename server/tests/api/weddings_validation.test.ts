import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app } from '../../src/app';

describe('Weddings & Functions Authorization and Input Validation', () => {
  it('blocks unauthenticated access to GET /api/weddings with 401', async () => {
    const res = await request(app).get('/api/weddings');
    expect(res.status).toBe(401);
    expect(res.body.error).toMatch(/authentication required/i);
  });

  it('blocks unauthenticated access to POST /api/weddings with 401', async () => {
    const res = await request(app).post('/api/weddings').send({
      title: 'Test Wedding',
      coupleNames: 'Bride & Groom',
      startDate: '2026-11-01',
      endDate: '2026-11-03',
    });
    expect(res.status).toBe(401);
  });

  it('blocks unauthenticated access to PUT /api/weddings/:id with 401', async () => {
    const res = await request(app).put('/api/weddings/some-uuid').send({
      title: 'Updated Wedding',
      coupleNames: 'Bride & Groom',
      startDate: '2026-11-01',
      endDate: '2026-11-03',
    });
    expect(res.status).toBe(401);
  });

  it('blocks unauthenticated access to DELETE /api/weddings/:id with 401', async () => {
    const res = await request(app).delete('/api/weddings/some-uuid');
    expect(res.status).toBe(401);
  });

  it('blocks unauthenticated access to /api/weddings/:id/functions with 401', async () => {
    const res = await request(app).get('/api/weddings/some-uuid/functions');
    expect(res.status).toBe(401);
  });

  it('blocks unauthenticated access to PUT /api/functions/:id with 401', async () => {
    const res = await request(app).put('/api/functions/some-uuid').send({
      name: 'Sangeet Night',
      dateTime: '2026-11-02T19:00:00Z',
      venue: 'Grand Ballroom',
    });
    expect(res.status).toBe(401);
  });

  it('blocks unauthenticated access to DELETE /api/functions/:id with 401', async () => {
    const res = await request(app).delete('/api/functions/some-uuid');
    expect(res.status).toBe(401);
  });
});
