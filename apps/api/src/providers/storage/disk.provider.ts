import * as fs from 'fs';
import * as path from 'path';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type {
  IStorageProvider,
  UploadFileInput,
  UploadFileResult,
} from '../interfaces';

@Injectable()
export class DiskStorageProvider implements IStorageProvider {
  readonly providerName = 'DISK';
  private readonly logger = new Logger(DiskStorageProvider.name);
  readonly uploadsDir: string;
  private readonly baseUrl: string;

  constructor(private readonly config: ConfigService) {
    this.uploadsDir = path.join(process.cwd(), 'uploads');
    this.baseUrl = config
      .get<string>('API_URL', 'http://localhost:4000')
      .replace(/\/+$/, '');

    fs.mkdirSync(this.uploadsDir, { recursive: true });
    this.logger.warn(
      'DiskStorageProvider active — files stored on local disk. ' +
        'Configure CLOUDINARY_* env vars to switch to cloud storage.',
    );
  }

  uploadFile(input: UploadFileInput): Promise<UploadFileResult> {
    const safeFilename = input.filename.replace(/[^a-zA-Z0-9._-]/g, '_');
    const folder = input.folder.replace(/^\/+|\/+$/g, '');
    const publicId = `${folder}/${Date.now()}-${safeFilename}`;
    const filePath = path.join(this.uploadsDir, publicId);

    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, input.data);

    return Promise.resolve({
      publicId,
      url: `${this.baseUrl}/api/v1/static/${publicId}`,
    });
  }

  deleteFile(publicId: string): Promise<void> {
    const filePath = path.join(this.uploadsDir, publicId);
    try {
      fs.unlinkSync(filePath);
    } catch {
      // file may not exist — ignore
    }
    return Promise.resolve();
  }

  getSignedUrl(publicId: string, _expiresInSeconds: number): string {
    return `${this.baseUrl}/api/v1/static/${publicId}`;
  }

  getSignedDownloadUrl(publicId: string, _expiresInSeconds: number): string {
    return `${this.baseUrl}/api/v1/static/${publicId}?dl=1`;
  }
}
