import 'dotenv/config';
import { z } from 'zod';
import { parseDurationMs } from './duration';
import { validateTrustProxy } from './trustProxy';

/**
 * All runtime configuration is validated at boot. The process must fail fast
 * on missing/invalid config rather than start with silently-wrong values.
 */
const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),

  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),

  JWT_ACCESS_SECRET: z.string().min(32, 'JWT_ACCESS_SECRET must be at least 32 characters'),
  JWT_REFRESH_SECRET: z.string().min(32, 'JWT_REFRESH_SECRET must be at least 32 characters'),
  JWT_ACCESS_TTL: z.string().default('15m'),
  JWT_REFRESH_TTL: z.string().default('7d'),

  CORS_ORIGIN: z.string().min(1).default('http://localhost:5173'),

  // Audit finding C-02: must match actual deployment topology. Default
  // "false" is the safe choice for local dev / direct exposure with no
  // reverse proxy in front. See shared/config/trustProxy.ts and
  // app/README.md for what to set behind nginx/a load balancer.
  TRUST_PROXY: z.string().default('false'),

  STORAGE_DRIVER: z.enum(['local', 's3']).default('local'),
  STORAGE_LOCAL_PATH: z.string().default('./storage'),

  // AI-assisted attachment extraction (2026-07-10) — local Ollama only, no cloud AI service, per
  // CLAUDE.md "avoid unnecessary paid cloud services". `host.docker.internal` is the Docker
  // Desktop DNS name for reaching the Windows/Mac host from inside a container; on native Linux
  // Docker this would need `--add-host=host.docker.internal:host-gateway` or a real host IP.
  OLLAMA_BASE_URL: z.string().default('http://host.docker.internal:11434'),
  OLLAMA_VISION_MODEL: z.string().default('moondream'),
});

export type Env = z.infer<typeof envSchema> & {
  /**
   * Audit finding H-01: pre-parsed milliseconds form of JWT_REFRESH_TTL,
   * computed once at boot (fail-fast on an invalid format, consistent with
   * the rest of this file) so the composition root (app.ts) can wire a
   * real value into the use cases instead of relying on their internal
   * hardcoded fallback constants.
   */
  JWT_REFRESH_TTL_MS: number;
};

function loadEnv(): Env {
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`)
      .join('\n');
    // eslint-disable-next-line no-console
    console.error(`Invalid environment configuration:\n${issues}`);
    process.exit(1);
  }

  const refreshTtlMs = parseDurationMs(parsed.data.JWT_REFRESH_TTL);
  if (refreshTtlMs === null) {
    // eslint-disable-next-line no-console
    console.error(
      `Invalid JWT_REFRESH_TTL format: "${parsed.data.JWT_REFRESH_TTL}". Expected e.g. "7d", "15m", "12h".`,
    );
    process.exit(1);
  }

  // Production-readiness review finding: validate with the SAME function
  // Express itself uses internally (proxy-addr.compile), so a malformed
  // value fails here with our own clear message instead of crashing later,
  // mid-boot, inside app.set('trust proxy', ...) with an unrelated error.
  const trustProxyError = validateTrustProxy(parsed.data.TRUST_PROXY);
  if (trustProxyError) {
    // eslint-disable-next-line no-console
    console.error(trustProxyError);
    process.exit(1);
  }

  return { ...parsed.data, JWT_REFRESH_TTL_MS: refreshTtlMs };
}

export const env = loadEnv();
