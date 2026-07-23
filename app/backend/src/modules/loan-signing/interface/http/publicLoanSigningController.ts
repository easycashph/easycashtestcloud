import type { NextFunction, Request, Response } from 'express';
import type { RequestSigningOtpUseCase } from '../../application/use-cases/RequestSigningOtpUseCase';
import type { VerifySigningOtpUseCase } from '../../application/use-cases/VerifySigningOtpUseCase';
import type { GetLoanSigningSessionUseCase } from '../../application/use-cases/GetLoanSigningSessionUseCase';
import type { GetLoanSigningDocumentFileUseCase } from '../../application/use-cases/GetLoanSigningDocumentFileUseCase';
import type { SignLoanSigningDocumentUseCase } from '../../application/use-cases/SignLoanSigningDocumentUseCase';
import type { SignLoanSigningDocumentRequestBody, VerifySigningOtpRequestBody } from './loanSigningSchemas';

export interface PublicLoanSigningControllerDeps {
  requestSigningOtpUseCase: RequestSigningOtpUseCase;
  verifySigningOtpUseCase: VerifySigningOtpUseCase;
  getLoanSigningSessionUseCase: GetLoanSigningSessionUseCase;
  getLoanSigningDocumentFileUseCase: GetLoanSigningDocumentFileUseCase;
  signLoanSigningDocumentUseCase: SignLoanSigningDocumentUseCase;
}

/** UNAUTHENTICATED (no `requireAuth`) - the client has no staff session/JWT to present. Every
 * method's only access control is the raw link token itself (hashed and compared inside each use
 * case, mirroring `smsReminderDlrController`'s "no requireAuth, secret checked in the controller/
 * use case" precedent) plus, past the first read, a fresh OTP verification. Never log or echo the
 * raw token/OTP code in a response body beyond what the use case itself returns. */
export class PublicLoanSigningController {
  constructor(private readonly deps: PublicLoanSigningControllerDeps) {}

  requestOtp = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      await this.deps.requestSigningOtpUseCase.execute(req.params.token as string);
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  };

  verifyOtp = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const body = req.body as VerifySigningOtpRequestBody;
      const matched = await this.deps.verifySigningOtpUseCase.execute(req.params.token as string, body.code);
      if (!matched) {
        res.status(400).json({ error: { code: 'OTP_MISMATCH', message: 'That code is incorrect. Try again.' } });
        return;
      }
      res.status(200).json({ verified: true });
    } catch (error) {
      next(error);
    }
  };

  getSession = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const view = await this.deps.getLoanSigningSessionUseCase.execute(req.params.token as string);
      res.status(200).json(view);
    } catch (error) {
      next(error);
    }
  };

  getDocumentFile = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const buffer = await this.deps.getLoanSigningDocumentFileUseCase.execute(
        req.params.token as string,
        req.params.documentId as string,
      );
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', 'inline');
      res.status(200).send(buffer);
    } catch (error) {
      next(error);
    }
  };

  signDocument = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const body = req.body as SignLoanSigningDocumentRequestBody;
      await this.deps.signLoanSigningDocumentUseCase.execute({
        rawToken: req.params.token as string,
        signingDocumentId: req.params.documentId as string,
        consentChecked: body.consentChecked,
        signatureImagePng: body.signatureImagePng,
        ipAddress: req.ip,
        userAgent: req.get('user-agent') ?? undefined,
      });
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  };
}
