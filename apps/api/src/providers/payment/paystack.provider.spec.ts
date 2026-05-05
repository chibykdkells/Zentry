import * as crypto from 'crypto';
import { PaystackProvider } from './paystack.provider';

describe('PaystackProvider', () => {
  const payload = Buffer.from(
    JSON.stringify({
      event: 'charge.success',
      data: {
        reference: 'ZDX-TXN-TEST-123',
        amount: 10000,
        id: 6111392934,
      },
    }),
  );

  it('prefers PAYSTACK_SECRET_KEY for webhook signature validation', () => {
    const provider = new PaystackProvider({
      get: (key: string, fallback = '') => {
        if (key === 'PAYSTACK_SECRET_KEY') {
          return 'sk_live_actual_secret_key';
        }

        if (key === 'PAYSTACK_WEBHOOK_SECRET') {
          return 'ssk_live_wrong_webhook_value';
        }

        return fallback;
      },
    } as never);

    const signature = crypto
      .createHmac('sha512', 'sk_live_actual_secret_key')
      .update(payload)
      .digest('hex');

    const result = provider.parseWebhook(payload, signature);

    expect(result.isValid).toBe(true);
    expect(result.reference).toBe('ZDX-TXN-TEST-123');
    expect(result.amountKobo).toBe(10000n);
    expect(result.gatewayRef).toBe('6111392934');
  });

  it('falls back to PAYSTACK_WEBHOOK_SECRET when the secret key is unavailable', () => {
    const provider = new PaystackProvider({
      get: (key: string, fallback = '') => {
        if (key === 'PAYSTACK_SECRET_KEY') {
          return '';
        }

        if (key === 'PAYSTACK_WEBHOOK_SECRET') {
          return 'ssk_live_webhook_only';
        }

        return fallback;
      },
    } as never);

    const signature = crypto
      .createHmac('sha512', 'ssk_live_webhook_only')
      .update(payload)
      .digest('hex');

    const result = provider.parseWebhook(payload, signature);

    expect(result.isValid).toBe(true);
    expect(result.event).toBe('charge.success');
  });
});
