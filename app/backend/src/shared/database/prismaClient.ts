import { PrismaClient } from '@prisma/client';
import { env } from '@shared/config/env';

/**
 * Single shared PrismaClient instance for the whole process — infrastructure
 * repositories import this rather than each constructing their own client,
 * which would otherwise exhaust the database's connection pool.
 */
export const prisma = new PrismaClient({
  log: env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
});
