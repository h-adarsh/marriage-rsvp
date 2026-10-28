import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { app } from '../../src/app';

describe('CSRF & Cross-Origin Security Defense', () => {
  let cookie: string;

  beforeAll(async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({
        email: `csrf_test_${Date.now()}@example.com`,
        password: 'Password123!',
        name: 'CSRF Test Planner',
      });
    expect(res.status).toBe(201);
    cookie = res.headers['set-cookie']?.[0]?.split(';')[0] || '';
  });

  it('rejects mutating requests from untrusted cross-origin sources with 403', async () => {
    const res = await request(app)
      .post('/api/weddings')
      .set('Cookie', cookie)
      .set('Origin', 'https://malicious-attacker.com')
      .send({
        title: 'Attacker Wedding',
        coupleNames: 'Attacker & Victim',
        startDate: '2026-12-01',
        endDate: '2026-12-02',
      });

    expect(res.status).toBe(403);
    expect(res.body.error).toMatch(/untrusted cross-origin request/i);
  });

  it('rejects mutating requests where browser reports sec-fetch-site: cross-site with 403', async () => {
    const res = await request(app)
      .post('/api/weddings')
      .set('Cookie', cookie)
      .set('Sec-Fetch-Site', 'cross-site')
      .send({
        title: 'Cross-Site Injected Wedding',
        coupleNames: 'Attacker & Victim',
        startDate: '2026-12-01',
        endDate: '2026-12-02',
      });

    expect(res.status).toBe(403);
    expect(res.body.error).toMatch(/cross-site request rejected/i);
  });

  it('allows safe GET requests even without origin header', async () => {
    const res = await request(app)
      .get('/api/weddings')
      .set('Cookie', cookie);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });
});
