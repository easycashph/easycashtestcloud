import type { NextFunction, Request, Response } from 'express';
import { getCurrentPortalAccount } from '@modules/client-portal/interface/http/requirePortalAuth';
import type { ListPortalSigningSessionsUseCase } from '../../application/use-cases/portal/ListPortalSigningSessionsUseCase';
import type { GetPortalSigningSessionUseCase } from '../../application/use-cases/portal/GetPortalSigningSessionUseCase';
import type { RequestPortalSigningOtpUseCase } from '../../application/use-cases/portal/RequestPortalSigningOtpUseCase';
import type { VerifyPortalSigningOtpUseCase } from '../../application/use-cases/portal/VerifyPortalSigningOtpUseCase';
import type { GetPortalSigningDocumentFileUseCase } from '../../application/use-cases/portal/GetPortalSigningDocumentFileUseCase';
import type { SignPortalLoanSigningDocumentUseCase } from '../../application/use-cases/portal/SignPortalLoanSigningDocumentUseCase';
import type { SignLoanSigningDocumentRequestBody, VerifySigningOtpRequestBody } from './loanSigningSchemas';

export interface PortalLoanSigningControllerDeps {
  listPortalSigningSessionsUseCase: ListPortalSigningSessionsUseCase;
  getPortalSigningSessionUseCase: GetPortalSigningSessionUseCase;
  requestPortalSigningOtpUseCase: RequestPortalSigningOtpUseCase;
  verifyPortalSigningOtpUseCase: VerifyPortalSigningOtpUseCase;
  getPortalSigningDocumentFileUseCase: GetPortalSigningDocumentFileUseCase;
  signPortalLoanSigningDocumentUseCase: SignPortalLoanSigningDocumentUseCase;
}

/** 2026-08-20 (Portal e-signature, user request): thin controller only, mirrors every other portal
 * controller's shape - `requirePortalAuth` (mounted at the router level) is what actually gates
 * these, `getCurrentPortalAccount(req).sub` supplies the portal account id every use case needs. */
export class PortalLoanSigningController {
  constructor(private readonly deps: PortalLoanSigningControllerDeps) {}

  listSessions = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const account = getCurrentPortalAccount(req);
      const items = await this.deps.listPortalSigningSessionsUseCase.execute(account.sub);
      res.status(200).json({ items });
    } catch (error) {
      next(error);
    }
  };

  getSession = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const account = getCurrentPortalAccount(req);
      const view = await this.deps.getPortalSigningSessionUseCase.execute(req.params.sessionId as string, account.sub);
      res.status(200).json(view);
    } catch (error) {
      next(error);
    }
  };

  requestOtp = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const account = getCurrentPortalAccount(req);
      await this.deps.requestPortalSigningOtpUseCase.execute(req.params.sessionId as string, account.sub);
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  };

  verifyOtp = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const account = getCurrentPortalAccount(req);
      const body = req.body as VerifySigningOtpRequestBody;
      const matched = await this.deps.verifyPortalSigningOtpUseCase.execute(req.params.sessionId as string, account.sub, body.code);
      if (!matched) {
        res.status(400).json({ error: { code: 'OTP_MISMATCH', message: 'That code is incorrect. Try again.' } });
        return;
      }
      res.status(200).json({ verified: true });
    } catch (error) {
      next(error);
    }
  };

  getDocumentFile = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const account = getCurrentPortalAccount(req);
      const buffer = await this.deps.getPortalSigningDocumentFileUseCase.execute(
        req.params.sessionId as string,
        account.sub,
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
      const account = getCurrentPortalAccount(req);
      const body = req.body as SignLoanSigningDocumentRequestBody;
      await this.deps.signPortalLoanSigningDocumentUseCase.execute({
        sessionId: req.params.sessionId as string,
        portalAccountId: account.sub,
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
