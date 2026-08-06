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

  // Easycash Portal (2026-07-23, Phase 1) - a DELIBERATELY separate secret from the staff
  // JWT_ACCESS_SECRET above, never derived from it: a client-portal token must never verify
  // successfully against the internal staff API's requireAuth, and vice versa - two fully
  // independent trust boundaries, one public-facing (borrowers), one internal (staff). v1 scope:
  // a single longer-lived access token, no refresh-token rotation yet (unlike the staff system's
  // RefreshToken/rotate-on-use) - acceptable for a lower-stakes "log back in occasionally" portal
  // flow; can be hardened to match the staff system's rotation later if warranted.
  PORTAL_JWT_SECRET: z.string().min(32, 'PORTAL_JWT_SECRET must be at least 32 characters'),
  PORTAL_JWT_TTL: z.string().default('24h'),

  CORS_ORIGIN: z.string().min(1).default('http://localhost:5173'),

  // 2026-07-30 (real bug found): e-signature links (CreateLoanSigningSessionUseCase) used to be
  // built directly from CORS_ORIGIN - worked by coincidence while that was a single origin, but
  // CORS_ORIGIN is semantically an ALLOW-LIST (comma-separated once multiple origins are trusted,
  // see app.ts's split(',') below) and the signing link needs exactly ONE canonical, externally
  // reachable URL. Kept as its own var rather than "just take the first CORS_ORIGIN entry" so the
  // externally-facing signing link (must be reachable by the borrower's phone/email, e.g. the
  // Cloudflare Pages URL) can differ from the primary CORS origin used for staff-facing browser
  // requests (e.g. a LAN IP) without one silently breaking the other.
  SIGNING_LINK_BASE_URL: z.string().min(1).default('http://localhost:5173'),

  // Audit finding C-02: must match actual deployment topology. Default
  // "false" is the safe choice for local dev / direct exposure with no
  // reverse proxy in front. See shared/config/trustProxy.ts and
  // app/README.md for what to set behind nginx/a load balancer.
  TRUST_PROXY: z.string().default('false'),

  STORAGE_DRIVER: z.enum(['local', 's3']).default('local'),
  STORAGE_LOCAL_PATH: z.string().default('./storage'),

  // ADR-051 §4: LibreOfficeDocxToPdfConverter shells out to headless LibreOffice. The Docker image
  // installs it on PATH so "soffice" (the default) resolves there unmodified; a local Windows dev
  // machine's install (e.g. via `winget install TheDocumentFoundation.LibreOffice`) is not added to
  // PATH by default, so this lets a dev point straight at the installed soffice.exe without editing
  // the machine/user PATH.
  LIBREOFFICE_BINARY_PATH: z.string().default('soffice'),

  // AI-assisted attachment extraction (2026-07-10) — local Ollama only, no cloud AI service, per
  // CLAUDE.md "avoid unnecessary paid cloud services". `host.docker.internal` is the Docker
  // Desktop DNS name for reaching the Windows/Mac host from inside a container; on native Linux
  // Docker this would need `--add-host=host.docker.internal:host-gateway` or a real host IP.
  OLLAMA_BASE_URL: z.string().default('http://host.docker.internal:11434'),
  OLLAMA_VISION_MODEL: z.string().default('moondream'),

  // Auto SMS Payment Reminders (2026-07-18) - via the M360/Globe SMS API already used by the
  // legacy SDevTech system (legacy/reports/M360 SMS API and Passthru Version 3.3.4.pdf).
  // SMS_ENABLED defaults false so no environment sends real SMS until explicitly turned on -
  // SendPaymentReminderSmsUseCase still runs and logs on the false path, it just skips the
  // real M360 call (dry-run), which is what makes it safe to leave cron running everywhere.
  // NOT z.coerce.boolean() - that coerces via JS `Boolean(str)`, so the string "false" (still
  // non-empty) would coerce to `true`. This only accepts the literal strings "true"/"false".
  SMS_ENABLED: z
    .enum(['true', 'false'])
    .default('false')
    .transform((v) => v === 'true'),
  // Checks every trigger in the 5-stage schedule (5/3/1 days before, due date, Monday past-due)
  // each run - no single offset to configure anymore, see SendPaymentReminderSmsUseCase.
  SMS_REMINDER_CRON: z.string().default('0 8 * * *'), // 8:00 AM Asia/Manila daily
  M360_API_URL: z.string().default('https://api.m360.com.ph/v3/api/broadcast'),
  M360_USERNAME: z.string().optional(),
  M360_PASSWORD: z.string().optional(),
  M360_SHORTCODE_MASK: z.string().optional(),
  // Shared secret M360 must echo back as a query param on the DLR webhook URL we give them -
  // the M360 docs define no auth scheme for that inbound call, so this is our own guard against
  // a stranger who knows the URL forging delivery-status updates.
  SMS_REMINDER_DLR_SECRET: z.string().optional(),

  // Auto Email Payment Reminders (2026-07-18) - the same Reminders feature, second channel, via
  // the company's own Google Workspace SMTP (a real mailbox with a "Send As" alias for
  // collections@easycash.ph, per CLAUDE.md "avoid unnecessary paid cloud services" - no separate
  // paid transactional email API). Same false-by-default dry-run safety as SMS_ENABLED, same
  // NOT-z.coerce.boolean() reasoning.
  EMAIL_ENABLED: z
    .enum(['true', 'false'])
    .default('false')
    .transform((v) => v === 'true'),
  EMAIL_REMINDER_CRON: z.string().default('0 8 * * *'), // 8:00 AM Asia/Manila daily

  // Automated PH Lending/Finance News + Road/Weather Advisory feed (2026-08-06 user request) -
  // curated links only (headline + short excerpt + link out), never republished full articles -
  // see ExternalNewsLink's own doc comment (schema.prisma). Comma-separated RSS feed URL lists,
  // kept configurable (not hardcoded) specifically because feed reachability from this codebase's
  // actual deployment host could not be verified during planning (WebFetch got HTTP 403 from every
  // candidate source tried) - swap a blocked source here without a code change.
  FINANCE_NEWS_FEED_URLS: z.string().default(''),
  ADVISORY_NEWS_FEED_URLS: z.string().default(''),
  FINANCE_NEWS_FETCH_CRON: z.string().default('0 6 * * *'), // 6:00 AM Asia/Manila daily
  SMTP_HOST: z.string().default('smtp.gmail.com'),
  SMTP_PORT: z.coerce.number().int().positive().default(587),
  SMTP_USERNAME: z.string().optional(), // the real mailbox's own login, NOT the Send As alias
  SMTP_PASSWORD: z.string().optional(), // Gmail App Password
  SMTP_FROM_ADDRESS: z.string().default('collections@easycash.ph'),

  // E-signature emails (2026-07-28) - a SEPARATE "From" address from the payment-reminders one
  // above, since collections@easycash.ph reads as a collections/payment-reminder mailbox, not
  // signing links/OTP codes. Same Google Workspace SMTP credentials (SMTP_USERNAME/PASSWORD) -
  // this must already be a verified "Send As" alias on that mailbox, or Gmail/Workspace will
  // reject or silently rewrite the From header (see NodemailerEmailGateway's own doc comment).
  SIGNING_SMTP_FROM_ADDRESS: z.string().default('esignature@easycash.ph'),

  // 2026-07-30 (user request): the OTP code email now sends from a DIFFERENT address than the
  // signing link above, so a recipient can tell the two apart at a glance instead of both reading
  // as generic "esignature@" mail. Same Google Workspace SMTP credentials - like
  // SIGNING_SMTP_FROM_ADDRESS above, this must already be a verified "Send As" alias on that
  // mailbox or Gmail/Workspace will reject or silently rewrite the From header.
  SIGNING_OTP_SMTP_FROM_ADDRESS: z.string().default('noreply-verify@easycash.ph'),
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

  if (parsed.data.SMS_ENABLED) {
    const missing = (['M360_USERNAME', 'M360_PASSWORD', 'M360_SHORTCODE_MASK', 'SMS_REMINDER_DLR_SECRET'] as const).filter(
      (key) => !parsed.data[key],
    );
    if (missing.length > 0) {
      // eslint-disable-next-line no-console
      console.error(`SMS_ENABLED=true requires the following to also be set: ${missing.join(', ')}`);
      process.exit(1);
    }
  }

  if (parsed.data.EMAIL_ENABLED) {
    const missing = (['SMTP_USERNAME', 'SMTP_PASSWORD'] as const).filter((key) => !parsed.data[key]);
    if (missing.length > 0) {
      // eslint-disable-next-line no-console
      console.error(`EMAIL_ENABLED=true requires the following to also be set: ${missing.join(', ')}`);
      process.exit(1);
    }
  }

  return { ...parsed.data, JWT_REFRESH_TTL_MS: refreshTtlMs };
}

export const env = loadEnv();
