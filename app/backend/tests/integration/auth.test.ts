import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/app';
import { prisma } from '../../src/shared/database/prismaClient';

/**
 * Full HTTP round-trip tests against a real PostgreSQL database — per the
 * Milestone 6 plan §9, these require `docker compose up postgres` and are
 * NOT run by default (this dev environment has no local Postgres/Docker
 * available). Opt in explicitly:
 *
 *   RUN_INTEGRATION_TESTS=1 DATABASE_URL=postgresql://... npm run test
 *
 * Unit tests (tests/unit/) run everywhere with no DB dependency.
 */
const runIntegration = process.env.RUN_INTEGRATION_TESTS === '1';

describe.skipIf(!runIntegration)('Auth API (integration)', () => {
  const app = createApp();
  let branchId: string;

  beforeAll(async () => {
    const branch = await prisma.branch.upsert({
      where: { code: 'TEST-HQ' },
      update: {},
      create: { code: 'TEST-HQ', name: 'Test Branch' },
    });
    branchId = branch.id;
  });

  afterAll(async () => {
    await prisma.refreshToken.deleteMany({});
    await prisma.userRole.deleteMany({});
    await prisma.user.deleteMany({ where: { branchId } });
    await prisma.branch.deleteMany({ where: { id: branchId } });
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    await prisma.refreshToken.deleteMany({});
    await prisma.userRole.deleteMany({});
    await prisma.user.deleteMany({ where: { branchId } });

    await prisma.user.create({
      data: {
        branchId,
        email: 'integration-test@easycash.ph',
        // bcrypt hash of "correct-horse-battery-staple-12"
        passwordHash: await import('bcrypt').then((b) => b.hash('correct-horse-battery-staple-12', 12)),
        firstName: 'Test',
        lastName: 'User',
      },
    });
  });

  it('logs in with correct credentials, sets a refresh-token cookie, and never returns it in the JSON body', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'integration-test@easycash.ph', password: 'correct-horse-battery-staple-12' });

    expect(res.status).toBe(200);
    expect(res.body.accessToken).toEqual(expect.any(String));
    expect(JSON.stringify(res.body)).not.toContain('refreshToken');
    expect(res.headers['set-cookie']?.[0]).toMatch(/refreshToken=.*HttpOnly/);
  });

  it('rejects wrong password with a generic 401', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'integration-test@easycash.ph', password: 'totally-wrong' });
    expect(res.status).toBe(401);
    expect(res.body.error.message).toBe('Invalid email or password.');
  });

  it('full rotation cycle: login -> refresh -> replaying the OLD refresh token is rejected and revokes the session', async () => {
    const agent = request.agent(app);

    const loginRes = await agent
      .post('/api/v1/auth/login')
      .send({ email: 'integration-test@easycash.ph', password: 'correct-horse-battery-staple-12' });
    const originalCookie = loginRes.headers['set-cookie'][0];

    const refreshRes = await agent.post('/api/v1/auth/refresh');
    expect(refreshRes.status).toBe(200);
    expect(refreshRes.body.accessToken).not.toBe(loginRes.body.accessToken);

    // Replay the ORIGINAL (now-rotated) cookie directly — simulates a stolen token.
    const replayRes = await request(app).post('/api/v1/auth/refresh').set('Cookie', originalCookie);
    expect(replayRes.status).toBe(401);

    // The rotated (second, currently-valid) token should now ALSO be dead,
    // since reuse detection revokes the whole session family.
    const secondRefreshRes = await agent.post('/api/v1/auth/refresh');
    expect(secondRefreshRes.status).toBe(401);
  });

  it('C-01: concurrent refresh with the SAME token — exactly one request succeeds, the other is treated as reuse', async () => {
    const loginRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'integration-test@easycash.ph', password: 'correct-horse-battery-staple-12' });
    const cookie = loginRes.headers['set-cookie'][0];

    // Fire two refresh requests presenting the identical cookie at the
    // same time — this is the exact race C-01 fixes: without the atomic
    // conditional UPDATE in PrismaRefreshTokenRepository.revoke, both
    // could succeed and issue divergent token pairs with no reuse
    // detected. With the fix, Postgres row-locking guarantees only one
    // `UPDATE ... WHERE revoked_at IS NULL` affects a row.
    const [first, second] = await Promise.all([
      request(app).post('/api/v1/auth/refresh').set('Cookie', cookie),
      request(app).post('/api/v1/auth/refresh').set('Cookie', cookie),
    ]);

    const statuses = [first.status, second.status].sort();
    expect(statuses).toEqual([200, 401]);

    // Reuse detection must have revoked the whole session family — even
    // the token issued to the winning request is now dead.
    const winner = first.status === 200 ? first : second;
    const winnerCookie = winner.headers['set-cookie'][0];
    const followUp = await request(app).post('/api/v1/auth/refresh').set('Cookie', winnerCookie);
    expect(followUp.status).toBe(401);
  });

  it('GET /me requires a valid access token', async () => {
    const unauth = await request(app).get('/api/v1/auth/me');
    expect(unauth.status).toBe(401);

    const loginRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'integration-test@easycash.ph', password: 'correct-horse-battery-staple-12' });

    const meRes = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${loginRes.body.accessToken}`);
    expect(meRes.status).toBe(200);
    expect(meRes.body.email).toBe('integration-test@easycash.ph');
  });

  it('trips the login rate limiter after repeated failed attempts', async () => {
    for (let i = 0; i < 8; i += 1) {
      await request(app)
        .post('/api/v1/auth/login')
        .send({ email: 'integration-test@easycash.ph', password: 'wrong' });
    }
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'integration-test@easycash.ph', password: 'wrong' });
    expect(res.status).toBe(429);
  });
});
