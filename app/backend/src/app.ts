import express, { type Express } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import pinoHttp from 'pino-http';
import { env } from '@shared/config/env';
import { logger } from '@shared/logger/logger';
import { errorHandler } from '@shared/middleware/errorHandler';

/**
 * Composition root. Module routers are mounted here as they're built out
 * (Milestone 8) — infrastructure implementations are wired into use cases
 * at this single point, per the Clean Architecture dependency direction:
 * interface -> application -> domain <- infrastructure.
 */
export function createApp(): Express {
  const app = express();

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
  app.use(pinoHttp({ logger }));

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', service: 'easycash-backend', timestamp: new Date().toISOString() });
  });

  // Module routers are mounted under /api/v1/* starting in Milestone 8.
  // e.g. app.use('/api/v1/borrowers', borrowerRouter);

  app.use(errorHandler);

  return app;
}
