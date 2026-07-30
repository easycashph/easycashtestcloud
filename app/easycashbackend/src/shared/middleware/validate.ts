import type { NextFunction, Request, RequestHandler, Response } from 'express';
import type { ZodSchema } from 'zod';
import { ValidationError } from '@shared/errors/DomainError';

/**
 * Generic Zod request-body validator, reusable by every future module's
 * routes — not identity-specific, hence placed in `shared/`. Replaces
 * `req.body` with the parsed (and coerced/trimmed) value on success.
 */
export function validateBody(schema: ZodSchema): RequestHandler {
  return function validate(req: Request, _res: Response, next: NextFunction): void {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      next(new ValidationError(result.error.issues.map((issue) => issue.message).join('; ')));
      return;
    }
    req.body = result.data;
    next();
  };
}
