import { describe, expect, it, vi } from 'vitest';
import type { Request, Response } from 'express';

vi.mock('@shared/config/env', () => ({ env: { SMS_REMINDER_DLR_SECRET: 'shared-secret-123' } }));

const { SmsReminderDlrController } = await import('@modules/sms-reminder/interface/http/smsReminderDlrController');

function buildResponse() {
  const res = { status: vi.fn().mockReturnThis(), json: vi.fn().mockReturnThis() };
  return res as unknown as Response & { status: ReturnType<typeof vi.fn>; json: ReturnType<typeof vi.fn> };
}

function buildRequest(query: Record<string, string>) {
  return { query } as unknown as Request;
}

describe('SmsReminderDlrController', () => {
  it('rejects a request with a missing or wrong key (401) - M360s own webhook has no auth scheme, this is our only guard', async () => {
    const smsReminderRepository = { updateDeliveryStatus: vi.fn() };
    const controller = new SmsReminderDlrController({ smsReminderRepository });
    const res = buildResponse();

    await controller.receive(buildRequest({ transid: 't-1', status_code: '1', key: 'wrong' }), res, vi.fn());

    expect(res.status).toHaveBeenCalledWith(401);
    expect(smsReminderRepository.updateDeliveryStatus).not.toHaveBeenCalled();
  });

  it('maps DLR status_code 1 to DELIVERED', async () => {
    const smsReminderRepository = { updateDeliveryStatus: vi.fn() };
    const controller = new SmsReminderDlrController({ smsReminderRepository });
    const res = buildResponse();

    await controller.receive(buildRequest({ transid: 't-1', status_code: '1', key: 'shared-secret-123' }), res, vi.fn());

    expect(smsReminderRepository.updateDeliveryStatus).toHaveBeenCalledWith('t-1', 'DELIVERED', expect.any(Date));
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it('maps DLR status_code 16 to REJECTED and 2 to UNDELIVERED', async () => {
    const smsReminderRepository = { updateDeliveryStatus: vi.fn() };
    const controller = new SmsReminderDlrController({ smsReminderRepository });

    await controller.receive(buildRequest({ transid: 't-2', status_code: '16', key: 'shared-secret-123' }), buildResponse(), vi.fn());
    await controller.receive(buildRequest({ transid: 't-3', status_code: '2', key: 'shared-secret-123' }), buildResponse(), vi.fn());

    expect(smsReminderRepository.updateDeliveryStatus).toHaveBeenNthCalledWith(1, 't-2', 'REJECTED', expect.any(Date));
    expect(smsReminderRepository.updateDeliveryStatus).toHaveBeenNthCalledWith(2, 't-3', 'UNDELIVERED', expect.any(Date));
  });

  it('ignores an unmapped status_code (e.g. 8/Acknowledged) without erroring', async () => {
    const smsReminderRepository = { updateDeliveryStatus: vi.fn() };
    const controller = new SmsReminderDlrController({ smsReminderRepository });
    const res = buildResponse();

    await controller.receive(buildRequest({ transid: 't-4', status_code: '8', key: 'shared-secret-123' }), res, vi.fn());

    expect(smsReminderRepository.updateDeliveryStatus).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
  });
});
