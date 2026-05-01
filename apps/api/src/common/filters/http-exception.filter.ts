import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Response } from 'express';
import * as Sentry from '@sentry/nestjs';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'An unexpected error occurred. Please try again.';

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse();
      if (typeof exceptionResponse === 'string') {
        message = exceptionResponse;
      } else if (
        typeof exceptionResponse === 'object' &&
        exceptionResponse !== null
      ) {
        const resp = exceptionResponse as Record<string, unknown>;
        if (typeof resp['message'] === 'string') {
          message = resp['message'];
        } else if (Array.isArray(resp['message'])) {
          message = (resp['message'] as string[]).join(', ');
        }
      }
    } else {
      // Log the full error internally but never expose it
      this.logger.error('Unhandled exception', exception);
      Sentry.captureException(exception);
    }

    response.status(status).json({
      success: false,
      message,
      data: null,
      timestamp: new Date().toISOString(),
    });
  }
}
