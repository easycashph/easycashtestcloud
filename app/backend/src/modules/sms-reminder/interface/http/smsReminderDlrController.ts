import type { NextFunction, Request, Response } from 'express';
import { env } from '@shared/config/env';
import type { ISmsReminderRepository } from '../../application/ports/ISmsReminderRepository';

/** M360's own DLR Status Codes (see the M360 API doc, §IX) - only the 3 that map to a real
 * delivery outcome are handled; 8 (Acknowledge/Successful, SMSC accepted it) is a no-op here since
 * SmsReminderLog already starts at SENT the moment the broadcast call itself succeeded. */
const DLR_STATUS_MAP: Record<string, 'DELIVERED' | 'UNDELIVERED' | 'REJECTED'> = {
  '1': 'DELIVERED',
  '2': 'UNDELIVERED',
  '16': 'REJECTED',
};

export interface SmsReminderDlrControllerDeps {
  smsReminderRepository: ISmsReminderRepository;
}

/**
 * M360's DLR webhook has no auth scheme of its own (see the API doc, §IX) - the `key` query param
 * is our own addition, a shared secret we give M360 to embed in the webhook URL we hand them, so a
 * stranger who merely knows this URL can't forge delivery-status updates. Deliberately NOT behind
 * `requireAuth` (M360's servers have no user session/JWT to present) - this endpoint's only
 * protection is the secret, which is why SMS_ENABLED=true requires SMS_REMINDER_DLR_SECRET to be
 * set (see env.ts).
 */
export class SmsReminderDlrController {
  constructor(private readonly deps: SmsReminderDlrControllerDeps) {}

  receive = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!env.SMS_REMINDER_DLR_SECRET || req.query.key !== env.SMS_REMINDER_DLR_SECRET) {
        res.status(401).json({ error: 'Invalid or missing key.' });
        return;
      }

      const transid = typeof req.query.transid === 'string' ? req.query.transid : undefined;
      const statusCode = typeof req.query.status_code === 'string' ? req.query.status_code : undefined;
      if (!transid || !statusCode) {
        res.status(400).json({ error: 'transid and status_code are required.' });
        return;
      }

      const mappedStatus = DLR_STATUS_MAP[statusCode];
      if (mappedStatus) {
        await this.deps.smsReminderRepository.updateDeliveryStatus(transid, mappedStatus, new Date());
      }

      res.status(200).json({ received: true });
    } catch (error) {
      next(error);
    }
  };
}
