import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app } from '../../src/app';

describe('Auth Endpoints Validation & Protection', () => {
  it('rejects registration with short password (< 8 chars)', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({
        email: 'planner@example.com',
        password: 'short',
        name: 'Wedding Planner',
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/at least 8 characters/i);
  });

  it('rejects registration with invalid email format', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({
        email: 'invalid-email-address',
        password: 'validPassword123!',
        name: 'Wedding Planner',
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/invalid email/i);
  });

  it('rejects registration with missing name', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({
        email: 'valid@example.com',
        password: 'validPassword123!',
        name: '',
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toBeDefined();
  });

  it('rejects login with missing or invalid fields', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'not-an-email',
        password: '',
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toBeDefined();
  });

  it('rejects GET /api/auth/me when no session cookie is provided', async () => {
    const res = await request(app).get('/api/auth/me');

    expect(res.status).toBe(401);
    expect(res.body.error).toMatch(/authentication required/i);
  });

  it('handles logout cleanly even if no session exists', async () => {
    const res = await request(app).post('/api/auth/logout');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true });
    // Expect Set-Cookie header clearing the cookie
    const cookies = res.headers['set-cookie'];
    expect(cookies).toBeDefined();
    expect(cookies[0]).toMatch(/sessionId=;/);
  });
});
