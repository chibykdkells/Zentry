import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

export interface ApiResponse<T> {
  success: boolean;
  message: string;
  data: T;
  timestamp: string;
}

@Injectable()
export class TransformInterceptor<T> implements NestInterceptor<
  T,
  ApiResponse<T>
> {
  intercept(
    _context: ExecutionContext,
    next: CallHandler,
  ): Observable<ApiResponse<T>> {
    return next.handle().pipe(
      map((data: { message?: string; data?: T } | T) => {
        // Allow services to pass { message, data } or just data
        if (
          data !== null &&
          typeof data === 'object' &&
          'message' in data &&
          'data' in data
        ) {
          const shaped = data as { message: string; data: T };
          return {
            success: true,
            message: shaped.message,
            data: shaped.data,
            timestamp: new Date().toISOString(),
          };
        }

        return {
          success: true,
          message: 'Request successful',
          data: data as T,
          timestamp: new Date().toISOString(),
        };
      }),
    );
  }
}
