import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { v2 as cloudinary } from 'cloudinary';
import {
  IStorageProvider,
  UploadFileInput,
  UploadFileResult,
} from '../interfaces';

@Injectable()
export class CloudinaryStorageProvider implements IStorageProvider {
  readonly providerName = 'CLOUDINARY';
  private readonly logger = new Logger(CloudinaryStorageProvider.name);
  private readonly cloudName: string;
  private readonly apiKey: string;
  private readonly apiSecret: string;
  private readonly configured: boolean;

  constructor(private readonly config: ConfigService) {
    this.cloudName = config.get<string>('CLOUDINARY_CLOUD_NAME', 'demo');
    this.apiKey = config.get<string>('CLOUDINARY_API_KEY', '');
    this.apiSecret = config.get<string>('CLOUDINARY_API_SECRET', '');
    this.configured = !!(
      this.apiKey &&
      this.apiSecret &&
      this.cloudName !== 'demo'
    );

    if (this.configured) {
      cloudinary.config({
        cloud_name: this.cloudName,
        api_key: this.apiKey,
        api_secret: this.apiSecret,
        secure: true,
      });
    }
  }

  async uploadFile(input: UploadFileInput): Promise<UploadFileResult> {
    const normalizedFolder = input.folder.replace(/^\/+|\/+$/g, '');
    const safeFilename = input.filename.replace(/[^a-zA-Z0-9._-]/g, '_');
    const publicId = `${normalizedFolder}/${Date.now()}-${safeFilename}`;

    if (!this.configured) {
      this.logger.warn(
        `Cloudinary not configured — mocked upload for ${input.filename}`,
      );
      return {
        publicId,
        url: `https://res.cloudinary.com/${this.cloudName}/raw/upload/${publicId}`,
      };
    }

    const dataUri = `data:${input.mimeType};base64,${input.data.toString('base64')}`;

    const result = await cloudinary.uploader.upload(dataUri, {
      resource_type: 'raw',
      type: 'authenticated',
      public_id: publicId,
      overwrite: false,
    });

    return {
      publicId: result.public_id,
      url: result.secure_url,
    };
  }

  async deleteFile(publicId: string): Promise<void> {
    if (!this.configured) {
      this.logger.warn(
        `Cloudinary not configured — mocked delete for ${publicId}`,
      );
      return;
    }

    await cloudinary.uploader.destroy(publicId, {
      resource_type: 'raw',
      type: 'authenticated',
      invalidate: true,
    });
  }

  getSignedUrl(publicId: string, expiresInSeconds: number): string {
    if (!this.configured) {
      return `https://res.cloudinary.com/${this.cloudName}/raw/upload/${publicId}`;
    }

    return cloudinary.url(publicId, {
      resource_type: 'raw',
      type: 'authenticated',
      sign_url: true,
      expires_at: Math.floor(Date.now() / 1000) + expiresInSeconds,
      secure: true,
    });
  }
}
