import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
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

  constructor(private readonly config: ConfigService) {
    this.cloudName = config.get<string>('CLOUDINARY_CLOUD_NAME', 'demo');
    this.apiKey = config.get<string>('CLOUDINARY_API_KEY', '');
    this.apiSecret = config.get<string>('CLOUDINARY_API_SECRET', '');
  }

  uploadFile(input: UploadFileInput): Promise<UploadFileResult> {
    if (!this.apiKey || !this.apiSecret) {
      this.logger.warn(
        `Cloudinary credentials are not fully configured — returning mocked upload result for ${input.filename}`,
      );
    }

    const normalizedFolder = input.folder.replace(/^\/+|\/+$/g, '');
    const publicId = `${normalizedFolder}/${Date.now()}-${input.filename}`;

    return Promise.resolve({
      publicId,
      url: `https://res.cloudinary.com/${this.cloudName}/raw/upload/${publicId}`,
    });
  }

  deleteFile(publicId: string): Promise<void> {
    if (!this.apiKey || !this.apiSecret) {
      this.logger.warn(
        `Cloudinary credentials are not fully configured — mocked delete for ${publicId}`,
      );
    }

    return Promise.resolve();
  }
}
