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

  it('rejects mutating requests by default in production when ALLOWED_ORIGINS is empty', async () => {
    const prevEnv = process.env.NODE_ENV;
    const prevClientUrl = process.env.CLIENT_URL;
    const prevAllowed = process.env.ALLOWED_ORIGINS;

    try {
      process.env.NODE_ENV = 'production';
      delete process.env.CLIENT_URL;
      delete process.env.ALLOWED_ORIGINS;

      const res = await request(app)
        .post('/api/weddings')
        .set('Cookie', cookie)
        .set('Origin', 'https://example-production-domain.com')
        .send({
          title: 'Unconfigured Prod Wedding',
          coupleNames: 'Couple & Partner',
          startDate: '2026-12-01',
          endDate: '2026-12-02',
        });

      expect(res.status).toBe(403);
      expect(res.body.error).toMatch(/Forbidden.*(Untrusted cross-origin|No trusted origins)/i);
    } finally {
      process.env.NODE_ENV = prevEnv;
      if (prevClientUrl) process.env.CLIENT_URL = prevClientUrl;
      if (prevAllowed) process.env.ALLOWED_ORIGINS = prevAllowed;
    }
  });

  it('rejects mutating requests in production when Origin and Referer are both missing', async () => {
    const prevEnv = process.env.NODE_ENV;
    const prevClientUrl = process.env.CLIENT_URL;

    try {
      process.env.NODE_ENV = 'production';
      process.env.CLIENT_URL = 'https://app.realwedding.com';

      const res = await request(app)
        .post('/api/weddings')
        .set('Cookie', cookie)
        .send({
          title: 'Missing Origin Wedding',
          coupleNames: 'Couple & Partner',
          startDate: '2026-12-01',
          endDate: '2026-12-02',
        });

      expect(res.status).toBe(403);
      expect(res.body.error).toMatch(/missing origin and referer/i);
    } finally {
      process.env.NODE_ENV = prevEnv;
      if (prevClientUrl) process.env.CLIENT_URL = prevClientUrl;
      else delete process.env.CLIENT_URL;
    }
  });

  it('validates Referer origin when Origin header is omitted', async () => {
    // Untrusted Referer rejected
    const badRes = await request(app)
      .post('/api/weddings')
      .set('Cookie', cookie)
      .set('Referer', 'https://untrusted-site.com/some/path')
      .send({
        title: 'Untrusted Referer Wedding',
        coupleNames: 'Couple & Partner',
        startDate: '2026-12-01',
        endDate: '2026-12-02',
      });
    expect(badRes.status).toBe(403);
    expect(badRes.body.error).toMatch(/untrusted cross-origin request rejected/i);

    // Malformed Referer rejected
    const malformedRes = await request(app)
      .post('/api/weddings')
      .set('Cookie', cookie)
      .set('Referer', 'not-a-valid-url')
      .send({
        title: 'Malformed Referer Wedding',
        coupleNames: 'Couple & Partner',
        startDate: '2026-12-01',
        endDate: '2026-12-02',
      });
    expect(malformedRes.status).toBe(403);
    expect(malformedRes.body.error).toMatch(/malformed referer/i);
  });
});

