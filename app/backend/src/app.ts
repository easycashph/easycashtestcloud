import express, { type Express } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import pinoHttp from 'pino-http';
import { env } from '@shared/config/env';
import { logger } from '@shared/logger/logger';
import { errorHandler } from '@shared/middleware/errorHandler';
import { parseTrustProxy } from '@shared/config/trustProxy';
import { createAuthRouter } from '@modules/identity/interface/http/authRouter';
import { LoginUseCase } from '@modules/identity/application/use-cases/LoginUseCase';
import { RefreshTokenUseCase } from '@modules/identity/application/use-cases/RefreshTokenUseCase';
import { LogoutUseCase } from '@modules/identity/application/use-cases/LogoutUseCase';
import { LogoutAllUseCase } from '@modules/identity/application/use-cases/LogoutAllUseCase';
import { GetCurrentUserUseCase } from '@modules/identity/application/use-cases/GetCurrentUserUseCase';
import { BcryptPasswordHasher } from '@modules/identity/infrastructure/BcryptPasswordHasher';
import { JwtTokenService } from '@modules/identity/infrastructure/JwtTokenService';
import { PrismaUserRepository } from '@modules/identity/infrastructure/PrismaUserRepository';
import { PrismaRefreshTokenRepository } from '@modules/identity/infrastructure/PrismaRefreshTokenRepository';
import { PrismaAuditLogger } from '@modules/identity/infrastructure/PrismaAuditLogger';

/**
 * Composition root. Module routers are mounted here as they're built out
 * — infrastructure implementations are wired into use cases at this single
 * point, per the Clean Architecture dependency direction:
 * interface -> application -> domain <- infrastructure.
 */
export function createApp(): Express {
  const app = express();

  // Audit finding C-02: must be set correctly for the deployment topology
  // BEFORE anything that reads req.ip (rate limiters, audit logging) is
  // registered. See shared/config/trustProxy.ts and app/README.md.
  app.set('trust proxy', parseTrustProxy(env.TRUST_PROXY));

  // Secure-by-default baseline (CLAUDE.md §Security).
  app.use(helmet());
  app.use(cors({ origin: env.CORS_ORIGIN, credentials: true }));
  app.use(
    rateLimit({
      windowMs: 15 * 60 * 1000,
      limit: 300,
      standardHeaders: true,
      legacyHeaders: false,
    }),
  );
  app.use(express.json());
  app.use(cookieParser());
  app.use(pinoHttp({ logger }));

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', service: 'easycash-backend', timestamp: new Date().toISOString() });
  });

  // --- identity module wiring (Milestone 6: Authentication) ---
  const passwordHasher = new BcryptPasswordHasher();
  const tokenService = new JwtTokenService();
  const userRepository = new PrismaUserRepository();
  const refreshTokenRepository = new PrismaRefreshTokenRepository();
  const auditLogger = new PrismaAuditLogger();

  // Audit finding H-01: env.JWT_REFRESH_TTL_MS (pre-parsed, fail-fast in
  // env.ts) is now actually threaded through, instead of the use cases'
  // internal hardcoded fallback constants silently taking over.
  const authRouter = createAuthRouter(
    {
      loginUseCase: new LoginUseCase({
        userRepository,
        passwordHasher,
        tokenService,
        refreshTokenRepository,
        auditLogger,
        refreshTokenTtlMs: env.JWT_REFRESH_TTL_MS,
      }),
      refreshTokenUseCase: new RefreshTokenUseCase({
        userRepository,
        tokenService,
        refreshTokenRepository,
        refreshTokenTtlMs: env.JWT_REFRESH_TTL_MS,
      }),
      logoutUseCase: new LogoutUseCase({ refreshTokenRepository }),
      logoutAllUseCase: new LogoutAllUseCase({ refreshTokenRepository }),
      getCurrentUserUseCase: new GetCurrentUserUseCase({ userRepository }),
    },
    tokenService,
  );
  app.use('/api/v1/auth', authRouter);

  // Further module routers are mounted under /api/v1/* starting in Milestone 8.
  // e.g. app.use('/api/v1/borrowers', borrowerRouter);

  app.use(errorHandler);

  return app;
}
