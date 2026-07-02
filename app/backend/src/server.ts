import { createApp } from './app';
import { env } from '@shared/config/env';
import { logger } from '@shared/logger/logger';

const app = createApp();

const server = app.listen(env.PORT, () => {
  logger.info(`easycash-backend listening on port ${env.PORT} (${env.NODE_ENV})`);
});

function shutdown(signal: string) {
  logger.info(`Received ${signal}, shutting down gracefully.`);
  server.close(() => process.exit(0));
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
