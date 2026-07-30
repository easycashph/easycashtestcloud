import type { NextFunction, Request, Response } from 'express';
import { DomainError } from '@shared/errors/DomainError';
import { logger } from '@shared/logger/logger';

/**
 * Central error handler. Never leaks stack traces or internal details to
 * clients (CLAUDE.md §Security: "Never expose sensitive information").
 */
export function errorHandler(
  err: unknown,
  req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _next: NextFunction,
): void {
  if (err instanceof DomainError) {
    logger.warn({ code: err.code, ruleId: err.ruleId, path: req.path }, err.message);
    res.status(err.httpStatus).json({
      error: { code: err.code, message: err.message, ruleId: err.ruleId },
    });
    return;
  }

  logger.error({ err, path: req.path }, 'Unhandled error');
  res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred.' } });
}
