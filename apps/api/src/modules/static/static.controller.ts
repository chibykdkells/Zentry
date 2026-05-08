import * as fs from 'fs';
import * as path from 'path';
import {
  Controller,
  Get,
  NotFoundException,
  Req,
  Res,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { Public } from '../../common/decorators/public.decorator';
import { DiskStorageProvider } from '../../providers/storage/disk.provider';

const MIME_MAP: Record<string, string> = {
  '.pdf':  'application/pdf',
  '.png':  'image/png',
  '.jpg':  'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif':  'image/gif',
  '.webp': 'image/webp',
  '.bmp':  'image/bmp',
  '.svg':  'image/svg+xml',
};

@Controller('static')
export class StaticController {
  private readonly uploadsDir: string;

  constructor(private readonly disk: DiskStorageProvider) {
    this.uploadsDir = disk.uploadsDir;
  }

  @Public()
  @Get('*')
  serve(@Req() req: Request, @Res() res: Response): void {
    // Strip global prefix + controller prefix to get the file sub-path
    const filePath = decodeURIComponent(
      req.path.replace(/^\/api\/v1\/static\/?/, ''),
    );

    if (!filePath) {
      throw new NotFoundException('File not found');
    }

    const fullPath = path.resolve(this.uploadsDir, filePath);

    // Path traversal guard — resolved path must stay inside uploads dir
    if (!fullPath.startsWith(this.uploadsDir + path.sep) && fullPath !== this.uploadsDir) {
      throw new NotFoundException('File not found');
    }

    if (!fs.existsSync(fullPath)) {
      throw new NotFoundException('File not found');
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_MAP[ext] ?? 'application/octet-stream';
    res.setHeader('Content-Type', contentType);

    const dl = (req.query as Record<string, string>)['dl'];
    if (dl === '1') {
      const filename = path.basename(filePath);
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    }

    res.sendFile(fullPath);
  }
}
