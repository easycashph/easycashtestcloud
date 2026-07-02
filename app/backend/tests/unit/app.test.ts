import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/app';

/**
 * App-level smoke test that doesn't need a live database — only exercises
 * middleware wiring and the DB-free /health route. Constructing the
 * identity module's Prisma-backed repositories doesn't itself connect to
 * Postgres (Prisma connects lazily on first query), so this is safe to
 * run everywhere, unlike tests/integration/auth.test.ts.
 */
describe('createApp (audit finding C-02: trust proxy wiring)', () => {
  it('applies TRUST_PROXY from config to the Express app', () => {
    const app = createApp();
    // tests/setup.ts doesn't set TRUST_PROXY, so env.ts's default ("false") applies.
    expect(app.get('trust proxy')).toBe(false);
  });

  it('still serves /health correctly with trust proxy configured', async () => {
    const app = createApp();
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
  });
});
