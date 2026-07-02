import pino from 'pino';
import { env } from '@shared/config/env';

// Structured JSON logs by default — suited to Docker/self-hosted log
// aggregation. No pino-pretty dependency added to keep the dependency
// footprint minimal (CLAUDE.md: "avoid unnecessary dependencies").
export const logger = pino({
  level: env.NODE_ENV === 'production' ? 'info' : 'debug',
});
