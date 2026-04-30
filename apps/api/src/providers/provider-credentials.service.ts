import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from 'crypto';

@Injectable()
export class ProviderCredentialsService {
  constructor(private readonly config: ConfigService) {}

  encrypt(value: string): string {
    const normalized = value.trim();
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', this.getKey(), iv);
    const encrypted = Buffer.concat([
      cipher.update(normalized, 'utf8'),
      cipher.final(),
    ]);
    const tag = cipher.getAuthTag();

    return [
      iv.toString('base64'),
      tag.toString('base64'),
      encrypted.toString('base64'),
    ].join(':');
  }

  decrypt(value: string): string {
    const [ivBase64, tagBase64, payloadBase64] = value.split(':');

    if (!ivBase64 || !tagBase64 || !payloadBase64) {
      throw new Error('Invalid encrypted provider credential payload.');
    }

    const decipher = createDecipheriv(
      'aes-256-gcm',
      this.getKey(),
      Buffer.from(ivBase64, 'base64'),
    );
    decipher.setAuthTag(Buffer.from(tagBase64, 'base64'));

    const decrypted = Buffer.concat([
      decipher.update(Buffer.from(payloadBase64, 'base64')),
      decipher.final(),
    ]);

    return decrypted.toString('utf8');
  }

  mask(value: string): string {
    const normalized = value.trim();

    if (normalized.length <= 4) {
      return normalized;
    }

    return normalized.slice(-4);
  }

  private getKey(): Buffer {
    const secret =
      this.config.get<string>('APP_ENCRYPTION_KEY') ||
      this.config.get<string>('JWT_ACCESS_SECRET') ||
      'zendocx-provider-fallback-key';

    return createHash('sha256').update(secret).digest();
  }
}
