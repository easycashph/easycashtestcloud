/**
 * Runs before every test file. `shared/config/env.ts` validates required
 * env vars at module-load time and calls `process.exit(1)` on failure —
 * these must be set before any test imports a module that (transitively)
 * imports env.ts, or the whole test run aborts.
 */
process.env.NODE_ENV = process.env.NODE_ENV ?? 'test';
process.env.DATABASE_URL =
  process.env.DATABASE_URL ?? 'postgresql://easycash:easycash@localhost:5432/easycash_test?schema=public';
process.env.JWT_ACCESS_SECRET = process.env.JWT_ACCESS_SECRET ?? 'test-access-secret-at-least-32-characters-long';
process.env.JWT_REFRESH_SECRET =
  process.env.JWT_REFRESH_SECRET ?? 'test-refresh-secret-at-least-32-characters-long';
