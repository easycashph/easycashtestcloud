import { afterEach, describe, expect, it, vi } from 'vitest';
import { M360SmsGateway } from '@modules/sms-reminder/infrastructure/M360SmsGateway';
import { SmsGatewayError } from '@modules/sms-reminder/application/ports/ISmsGateway';

const config = { apiUrl: 'https://api.m360.com.ph/v3/api/broadcast', username: 'easycash', password: 'secret', shortcodeMask: 'EASYCASH' };

describe('M360SmsGateway', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('posts the payload M360 expects and returns the transid on a 201 response', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      json: () => Promise.resolve({ code: 201, name: 'Created', transid: 'M360-abc', timestamp: '20260718080000', msgcount: 1, telco_id: 1 }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const gateway = new M360SmsGateway(config);
    const result = await gateway.send('0917 123-4567', 'Hello');

    expect(result).toEqual({ providerTransId: 'M360-abc' });
    const [url, options] = fetchMock.mock.calls[0]!;
    expect(url).toBe(config.apiUrl);
    const body = JSON.parse(options.body);
    expect(body).toEqual({
      username: 'easycash',
      password: 'secret',
      msisdn: '09171234567', // whitespace/dashes stripped, M360 accepts this form as-is
      content: 'Hello',
      shortcode_mask: 'EASYCASH',
      is_intl: false,
    });
  });

  it('throws SmsGatewayError with M360s own message on a non-201 response', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        json: () => Promise.resolve({ code: 401, name: 'Unauthorized', message: 'Account used is not authorized to use the broadcast API.' }),
      }),
    );

    const gateway = new M360SmsGateway(config);

    await expect(gateway.send('09171234567', 'Hello')).rejects.toThrow(SmsGatewayError);
    await expect(gateway.send('09171234567', 'Hello')).rejects.toThrow(/Unauthorized/);
  });
});
