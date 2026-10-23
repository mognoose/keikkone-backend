import {
  ArgumentsHost,
  Catch,
  ConflictException,
  ExceptionFilter,
  HttpException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { BaseExceptionFilter } from '@nestjs/core';
import { Prisma } from '../generated/prisma/client.js';

/**
 * Translates well-known Prisma errors into HTTP errors so a unique-constraint
 * violation becomes a 409 instead of a generic 500.
 */
@Catch(Prisma.PrismaClientKnownRequestError)
export class PrismaExceptionFilter
  extends BaseExceptionFilter
  implements ExceptionFilter
{
  catch(error: Prisma.PrismaClientKnownRequestError, host: ArgumentsHost) {
    super.catch(this.toHttp(error) ?? error, host);
  }

  private toHttp(
    error: Prisma.PrismaClientKnownRequestError,
  ): HttpException | null {
    switch (error.code) {
      case 'P2002':
        return new ConflictException('Resource already exists');
      case 'P2003':
        return new BadRequestException('Referenced resource does not exist');
      case 'P2025':
        return new NotFoundException('Resource not found');
      default:
        return null;
    }
  }
}
