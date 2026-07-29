import type { NextFunction, Request, Response } from 'express';
import { ValidationError } from '@shared/errors/DomainError';
import type { ExtractLoanApplicationFieldsUseCase } from '../../application/use-cases/ExtractLoanApplicationFieldsUseCase';

export interface AiExtractionControllerDeps {
  extractLoanApplicationFieldsUseCase: ExtractLoanApplicationFieldsUseCase;
}

/** Thin controller only — no business logic here (CLAUDE.md §Architecture). */
export class AiExtractionController {
  constructor(private readonly deps: AiExtractionControllerDeps) {}

  extract = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.file) {
        throw new ValidationError('No file was uploaded (expected multipart field "file").');
      }
      const result = await this.deps.extractLoanApplicationFieldsUseCase.execute(req.file.buffer, req.file.mimetype);
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  };
}
