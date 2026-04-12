import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { createPrivateKey, createSign } from 'crypto';

type StoredPushSubscription = {
  id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
};

@Injectable()
export class PushDeliveryService {
  private readonly logger = new Logger(PushDeliveryService.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  getPublicKey() {
    return this.configService
      .get<string>('WEB_PUSH_VAPID_PUBLIC_KEY', '')
      .trim();
  }

  private getPrivateKey() {
    return this.configService
      .get<string>('WEB_PUSH_VAPID_PRIVATE_KEY', '')
      .trim();
  }

  private getSubject() {
    return this.configService.get<string>(
      'WEB_PUSH_VAPID_SUBJECT',
      'mailto:support@zentry.ng',
    );
  }

  isConfigured() {
    return Boolean(this.getPublicKey() && this.getPrivateKey());
  }

  getConfig() {
    return {
      enabled: this.isConfigured(),
      publicKey: this.getPublicKey() || null,
    };
  }

  private base64UrlEncode(input: Buffer | string) {
    const buffer = Buffer.isBuffer(input) ? input : Buffer.from(input);
    return buffer
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/g, '');
  }

  private base64UrlDecode(value: string) {
    const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
    const padding = '='.repeat((4 - (normalized.length % 4)) % 4);
    return Buffer.from(normalized + padding, 'base64');
  }

  private createVapidJwt(endpoint: string) {
    const publicKey = this.getPublicKey();
    const privateKey = this.getPrivateKey();

    if (!publicKey || !privateKey) {
      throw new Error('Web push VAPID keys are not configured.');
    }

    const audience = new URL(endpoint).origin;
    const publicKeyBytes = this.base64UrlDecode(publicKey);
    const privateKeyBytes = this.base64UrlDecode(privateKey);

    if (publicKeyBytes.length !== 65 || publicKeyBytes[0] !== 0x04) {
      throw new Error(
        'WEB_PUSH_VAPID_PUBLIC_KEY must be an uncompressed P-256 public key.',
      );
    }

    if (privateKeyBytes.length !== 32) {
      throw new Error(
        'WEB_PUSH_VAPID_PRIVATE_KEY must be a 32-byte P-256 private key.',
      );
    }

    const x = this.base64UrlEncode(publicKeyBytes.subarray(1, 33));
    const y = this.base64UrlEncode(publicKeyBytes.subarray(33, 65));
    const d = this.base64UrlEncode(privateKeyBytes);

    const keyObject = createPrivateKey({
      key: {
        kty: 'EC',
        crv: 'P-256',
        x,
        y,
        d,
      },
      format: 'jwk',
    });

    const header = this.base64UrlEncode(
      JSON.stringify({ typ: 'JWT', alg: 'ES256' }),
    );
    const payload = this.base64UrlEncode(
      JSON.stringify({
        aud: audience,
        exp: Math.floor(Date.now() / 1000) + 12 * 60 * 60,
        sub: this.getSubject(),
      }),
    );
    const signer = createSign('SHA256');
    signer.update(`${header}.${payload}`);
    signer.end();
    const signature = signer.sign({
      key: keyObject,
      dsaEncoding: 'ieee-p1363',
    });

    return {
      jwt: `${header}.${payload}.${this.base64UrlEncode(signature)}`,
      publicKey,
    };
  }

  async sendToSubscription(subscription: StoredPushSubscription) {
    if (!this.isConfigured()) {
      return { delivered: false as const, reason: 'not_configured' as const };
    }

    const { jwt, publicKey } = this.createVapidJwt(subscription.endpoint);

    const response = await fetch(subscription.endpoint, {
      method: 'POST',
      headers: {
        TTL: '60',
        Authorization: `vapid t=${jwt}, k=${publicKey}`,
        'Crypto-Key': `p256ecdsa=${publicKey}`,
      },
    }).catch((error) => {
      this.logger.warn(
        `Push delivery failed for ${subscription.id}: ${String(error)}`,
      );
      return null;
    });

    if (!response) {
      return { delivered: false as const, reason: 'network' as const };
    }

    if (response.status === 404 || response.status === 410) {
      await this.prisma.pushSubscription
        .delete({ where: { id: subscription.id } })
        .catch(() => undefined);

      return { delivered: false as const, reason: 'expired' as const };
    }

    if (!response.ok) {
      this.logger.warn(
        `Push delivery returned ${response.status} for subscription ${subscription.id}`,
      );
      return { delivered: false as const, reason: 'response' as const };
    }

    await this.prisma.pushSubscription.update({
      where: { id: subscription.id },
      data: { lastUsedAt: new Date() },
    });

    return { delivered: true as const };
  }

  async sendToUser(userId: string) {
    const subscriptions = await this.prisma.pushSubscription.findMany({
      where: { userId },
      select: {
        id: true,
        endpoint: true,
        p256dh: true,
        auth: true,
      },
    });

    for (const subscription of subscriptions) {
      await this.sendToSubscription(subscription);
    }
  }
}
