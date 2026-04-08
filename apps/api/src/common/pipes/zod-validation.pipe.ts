import {
  ArgumentMetadata,
  BadRequestException,
  Injectable,
  PipeTransform,
} from '@nestjs/common';
import { ZodError, ZodSchema } from 'zod';

type ZodBackedMetatype = ArgumentMetadata['metatype'] & {
  schema?: ZodSchema;
};

@Injectable()
export class ZodValidationPipe implements PipeTransform {
  transform(value: unknown, metadata: ArgumentMetadata) {
    const schema = (metadata.metatype as ZodBackedMetatype | undefined)?.schema;

    if (!schema) {
      return value;
    }

    try {
      const parsedValue: unknown = schema.parse(value);
      return parsedValue;
    } catch (error) {
      if (error instanceof ZodError) {
        const firstIssue = error.issues[0];

        throw new BadRequestException({
          message: firstIssue?.message ?? 'Validation failed',
          errors: error.issues.map((issue) => ({
            path: issue.path.join('.'),
            message: issue.message,
          })),
        });
      }

      throw error;
    }
  }
}
