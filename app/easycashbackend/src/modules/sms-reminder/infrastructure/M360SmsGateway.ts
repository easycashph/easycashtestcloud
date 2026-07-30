import type { ISmsGateway, SmsSendResult } from '../application/ports/ISmsGateway';
import { SmsGatewayError } from '../application/ports/ISmsGateway';

interface M360SuccessResponse {
  code: 201;
  name: string;
  transid: string;
  timestamp: string;
  msgcount: number;
  telco_id: number;
}

interface M360FailureResponse {
  code: number;
  name: string;
  message: string;
}

/**
 * M360 Broadcast API (legacy/reports/M360 SMS API and Passthru Version 3.3.4.pdf) - the same
 * Globe-provisioned gateway the legacy SDevTech system already used, per user confirmation
 * (2026-07-18). Only the Outbound SMS half of that document is implemented here - Passthru
 * (inbound MO routing / two-way reply) is out of scope, this feature is one-way reminders only.
 *
 * Accepts msisdn in +639.../639.../09.../9... form as-is (M360's own documented supported
 * formats) - only light normalization (strip whitespace/dashes) is needed, no forced E.164.
 */
export class M360SmsGateway implements ISmsGateway {
  constructor(
    private readonly config: {
      apiUrl: string;
      username: string;
      password: string;
      shortcodeMask: string;
    },
  ) {}

  async send(phoneNumber: string, message: string): Promise<SmsSendResult> {
    const msisdn = normalizeMsisdn(phoneNumber);

    const response = await fetch(this.config.apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: this.config.username,
        password: this.config.password,
        msisdn,
        content: message,
        shortcode_mask: this.config.shortcodeMask,
        is_intl: false,
      }),
    });

    const body = (await response.json()) as M360SuccessResponse | M360FailureResponse;

    if (body.code !== 201) {
      throw new SmsGatewayError(`M360 rejected the send (code ${body.code} ${body.name}): ${(body as M360FailureResponse).message}`);
    }

    return { providerTransId: (body as M360SuccessResponse).transid };
  }
}

function normalizeMsisdn(phoneNumber: string): string {
  return phoneNumber.replace(/[\s\-()]/g, '');
}
