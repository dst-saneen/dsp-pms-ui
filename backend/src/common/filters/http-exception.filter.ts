import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Request, Response } from 'express';
import { randomUUID } from 'node:crypto';

import {
  BusinessRuleException,
  DependencyExistsException,
  DuplicateEntityException,
  EntityNotFoundException,
  InvalidOperationException,
  ValidationException,
} from '../exceptions';
import { ErrorDetailDto, ErrorResponseDto } from '../dto/error-response.dto';
import { RequestWithId } from '../middleware';

interface NormalizedError {
  statusCode: number;
  error: string;
  code: string;
  message: string | string[];
  details?: ErrorDetailDto[];
  databaseCode?: string;
  availableScopes?: unknown[];
}

interface HttpExceptionBody {
  error?: string;
  code?: string;
  message?: string | string[];
  availableScopes?: unknown[];
}

interface DriverError {
  code?: unknown;
}

const logger = new Logger('HttpExceptionFilter');

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  constructor(private readonly isProduction = true) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const context = host.switchToHttp();
    const request = context.getRequest<RequestWithId>();
    const response = context.getResponse<Response>();
    const requestId = request.requestId || randomUUID();
    const normalizedError = this.normalizeException(exception);

    response.setHeader('X-Request-ID', requestId);

    this.logException(exception, normalizedError, request, requestId);

    if (response.headersSent) {
      return;
    }

    const body: ErrorResponseDto = {
      success: false,
      statusCode: normalizedError.statusCode,
      error: normalizedError.error,
      code: normalizedError.code,
      message: normalizedError.message,
      requestId,
      timestamp: new Date().toISOString(),
      path: request.path,
      method: request.method,
      ...(normalizedError.details ? { details: normalizedError.details } : {}),
      ...(normalizedError.availableScopes
        ? { availableScopes: normalizedError.availableScopes }
        : {}),
    };

    response.status(normalizedError.statusCode).json(body);
  }

  private normalizeException(exception: unknown): NormalizedError {
    const prismaError = this.normalizePrismaError(exception);

    if (prismaError) {
      return prismaError;
    }

    const driverError = this.normalizeDriverError(exception);

    if (driverError) {
      return driverError;
    }

    const adapterError = this.normalizeDriverAdapterError(exception);

    if (adapterError) {
      return adapterError;
    }

    const poolError = this.normalizePoolError(exception);

    if (poolError) {
      return poolError;
    }

    if (exception instanceof HttpException) {
      return this.normalizeHttpException(exception);
    }

    return {
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      error: 'Internal Server Error',
      code: 'INTERNAL_ERROR',
      message: 'An unexpected error occurred.',
    };
  }

  private normalizePrismaError(
    exception: unknown,
  ): NormalizedError | undefined {
    if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      switch (exception.code) {
        case 'P2002':
          return {
            statusCode: HttpStatus.CONFLICT,
            error: 'Conflict',
            code: 'CONFLICT',
            message: 'A record with the same unique value already exists.',
            databaseCode: exception.code,
          };
        case 'P2003':
          return {
            statusCode: HttpStatus.CONFLICT,
            error: 'Conflict',
            code: 'DEPENDENCY_CONFLICT',
            message: 'The operation is blocked by related records.',
            databaseCode: exception.code,
          };
        case 'P2025':
          return {
            statusCode: HttpStatus.NOT_FOUND,
            error: 'Not Found',
            code: 'NOT_FOUND',
            message: 'The requested record was not found.',
            databaseCode: exception.code,
          };
        case 'P2024':
          return {
            statusCode: HttpStatus.SERVICE_UNAVAILABLE,
            error: 'Service Unavailable',
            code: 'DATABASE_TIMEOUT',
            message: 'The service is temporarily busy. Please try again.',
            databaseCode: exception.code,
          };
        case 'P2034':
          return {
            statusCode: HttpStatus.CONFLICT,
            error: 'Conflict',
            code: 'TRANSACTION_CONFLICT',
            message:
              'The operation conflicted with another update. Please try again.',
            databaseCode: exception.code,
          };
        default:
          return {
            statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
            error: 'Internal Server Error',
            code: 'DATABASE_ERROR',
            message: 'The database operation could not be completed.',
            databaseCode: exception.code,
          };
      }
    }

    if (exception instanceof Prisma.PrismaClientInitializationError) {
      return {
        statusCode: HttpStatus.SERVICE_UNAVAILABLE,
        error: 'Service Unavailable',
        code: 'DATABASE_UNAVAILABLE',
        message: 'The service is temporarily unavailable.',
      };
    }

    if (exception instanceof Prisma.PrismaClientValidationError) {
      return {
        statusCode: HttpStatus.BAD_REQUEST,
        error: 'Bad Request',
        code: 'VALIDATION_ERROR',
        message: 'The request contains invalid data.',
      };
    }

    if (
      exception instanceof Prisma.PrismaClientUnknownRequestError ||
      exception instanceof Prisma.PrismaClientRustPanicError
    ) {
      return {
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
        error: 'Internal Server Error',
        code: 'DATABASE_ERROR',
        message: 'The database operation could not be completed.',
      };
    }

    return undefined;
  }

  private normalizeDriverError(
    exception: unknown,
  ): NormalizedError | undefined {
    if (typeof exception !== 'object' || exception === null) {
      return undefined;
    }

    const driverCode = (exception as DriverError).code;

    if (typeof driverCode !== 'string') {
      return undefined;
    }

    if (driverCode === '23505') {
      return {
        statusCode: HttpStatus.CONFLICT,
        error: 'Conflict',
        code: 'CONFLICT',
        message: 'A record with the same unique value already exists.',
        databaseCode: driverCode,
      };
    }

    if (driverCode === '23503') {
      return {
        statusCode: HttpStatus.CONFLICT,
        error: 'Conflict',
        code: 'DEPENDENCY_CONFLICT',
        message: 'The operation is blocked by related records.',
        databaseCode: driverCode,
      };
    }

    if (driverCode === '40P01' || driverCode === '40001') {
      return {
        statusCode: HttpStatus.CONFLICT,
        error: 'Conflict',
        code: 'TRANSACTION_CONFLICT',
        message:
          'The operation conflicted with another update. Please try again.',
        databaseCode: driverCode,
      };
    }

    if (driverCode === '55P03' || driverCode === '57014') {
      return {
        statusCode: HttpStatus.SERVICE_UNAVAILABLE,
        error: 'Service Unavailable',
        code: 'DATABASE_TIMEOUT',
        message: 'The service is temporarily busy. Please try again.',
        databaseCode: driverCode,
      };
    }

    if (
      driverCode === '53300' ||
      driverCode === '57P01' ||
      driverCode === '57P02' ||
      driverCode === '57P03' ||
      driverCode.startsWith('08') ||
      driverCode === 'ECONNREFUSED' ||
      driverCode === 'ENOTFOUND' ||
      driverCode === 'ETIMEDOUT' ||
      driverCode === 'ECONNRESET' ||
      driverCode === 'EHOSTUNREACH' ||
      driverCode === 'ENETUNREACH'
    ) {
      return {
        statusCode: HttpStatus.SERVICE_UNAVAILABLE,
        error: 'Service Unavailable',
        code: 'DATABASE_UNAVAILABLE',
        message: 'The service is temporarily unavailable.',
        databaseCode: driverCode,
      };
    }

    return undefined;
  }

  private normalizePoolError(exception: unknown): NormalizedError | undefined {
    if (!this.isPoolTimeoutError(exception)) {
      return undefined;
    }

    return {
      statusCode: HttpStatus.SERVICE_UNAVAILABLE,
      error: 'Service Unavailable',
      code: 'DATABASE_UNAVAILABLE',
      message: 'The service is temporarily unavailable.',
    };
  }

  private isPoolTimeoutError(exception: unknown): boolean {
    let current: unknown = exception;

    for (
      let depth = 0;
      depth < 6 && current && typeof current === 'object';
      depth += 1
    ) {
      const message =
        current instanceof Error
          ? current.message
          : typeof (current as { message?: unknown }).message === 'string'
            ? (current as { message: string }).message
            : '';

      if (
        message === 'timeout exceeded when trying to connect' ||
        message === 'Connection terminated due to connection timeout'
      ) {
        return true;
      }

      current = (current as { cause?: unknown }).cause;
    }

    return false;
  }

  private normalizeDriverAdapterError(
    exception: unknown,
  ): NormalizedError | undefined {
    const kind = this.getDriverAdapterKind(exception);
    if (!kind) {
      return undefined;
    }

    if (kind === 'UniqueConstraintViolation') {
      return {
        statusCode: HttpStatus.CONFLICT,
        error: 'Conflict',
        code: 'CONFLICT',
        message: 'A record with the same unique value already exists.',
        databaseCode: '23505',
      };
    }

    if (kind === 'TransactionWriteConflict') {
      return {
        statusCode: HttpStatus.CONFLICT,
        error: 'Conflict',
        code: 'TRANSACTION_CONFLICT',
        message:
          'The operation conflicted with another update. Please try again.',
        databaseCode: '40001',
      };
    }

    if (kind === 'ForeignKeyConstraintViolation') {
      return {
        statusCode: HttpStatus.CONFLICT,
        error: 'Conflict',
        code: 'DEPENDENCY_CONFLICT',
        message: 'The operation is blocked by related records.',
        databaseCode: '23503',
      };
    }

    if (kind === 'NullConstraintViolation') {
      return {
        statusCode: HttpStatus.BAD_REQUEST,
        error: 'Bad Request',
        code: 'VALIDATION_ERROR',
        message: 'A required value was missing.',
        databaseCode: '23502',
      };
    }

    const meta = this.getDriverAdapterMeta(exception);
    if (meta.originalCode === '23514') {
      return {
        statusCode: HttpStatus.CONFLICT,
        error: 'Conflict',
        code: 'CONSTRAINT_CONFLICT',
        message: 'The operation violated a database rule.',
        databaseCode: '23514',
      };
    }

    return undefined;
  }

  private getDriverAdapterKind(exception: unknown): string | undefined {
    return this.getDriverAdapterMeta(exception).kind;
  }

  private getDriverAdapterMeta(exception: unknown): {
    kind?: string;
    originalCode?: string;
    originalMessage?: string;
    detail?: string;
  } {
    const meta: {
      kind?: string;
      originalCode?: string;
      originalMessage?: string;
      detail?: string;
    } = {};
    let current: unknown = exception;

    for (
      let depth = 0;
      depth < 6 && current && typeof current === 'object';
      depth += 1
    ) {
      const record = current as {
        kind?: unknown;
        cause?: unknown;
        originalCode?: unknown;
        originalMessage?: unknown;
        code?: unknown;
        detail?: unknown;
      };

      if (!meta.kind && typeof record.kind === 'string') {
        meta.kind = record.kind;
      }
      if (!meta.originalCode && typeof record.originalCode === 'string') {
        meta.originalCode = record.originalCode;
      }
      if (
        !meta.originalCode &&
        typeof record.code === 'string' &&
        /^[0-9A-Z]{5}$/.test(record.code)
      ) {
        meta.originalCode = record.code;
      }
      if (!meta.originalMessage && typeof record.originalMessage === 'string') {
        meta.originalMessage = record.originalMessage;
      }
      if (!meta.detail && typeof record.detail === 'string') {
        meta.detail = record.detail;
      }

      current = record.cause;
    }

    return meta;
  }

  private normalizeHttpException(exception: HttpException): NormalizedError {
    const statusCode = exception.getStatus();
    const exceptionResponse = exception.getResponse();
    const responseBody: HttpExceptionBody =
      typeof exceptionResponse === 'object' && exceptionResponse !== null
        ? exceptionResponse
        : { message: String(exceptionResponse) };
    const rawMessages = Array.isArray(responseBody.message)
      ? responseBody.message
      : responseBody.message
        ? [responseBody.message]
        : [exception.message];
    const messages = rawMessages.map((message) =>
      this.sanitizeHttpMessage(message, statusCode),
    );
    const validationError =
      exception instanceof ValidationException ||
      (statusCode === 400 && Array.isArray(responseBody.message));

    return {
      statusCode,
      error: responseBody.error ?? this.getHttpErrorLabel(statusCode),
      code:
        this.readSafeErrorCode(responseBody.code) ??
        this.getHttpErrorCode(exception, statusCode, validationError),
      message: validationError
        ? messages
        : messages[0] || this.getDefaultMessage(statusCode),
      ...(validationError
        ? {
            details: messages.map((message) => ({
              message,
            })),
          }
        : {}),
      ...(statusCode === 409 &&
      responseBody.code === 'ORGANIZATION_SCOPE_SELECTION_REQUIRED' &&
      Array.isArray(responseBody.availableScopes)
        ? { availableScopes: responseBody.availableScopes }
        : {}),
    };
  }

  private getHttpErrorCode(
    exception: HttpException,
    statusCode: number,
    validationError: boolean,
  ): string {
    if (validationError) {
      return 'VALIDATION_ERROR';
    }

    if (exception instanceof EntityNotFoundException) {
      return 'NOT_FOUND';
    }

    if (exception instanceof DuplicateEntityException) {
      return 'CONFLICT';
    }

    if (exception instanceof DependencyExistsException) {
      return 'DEPENDENCY_CONFLICT';
    }

    if (exception instanceof BusinessRuleException) {
      return 'BUSINESS_RULE_VIOLATION';
    }

    if (exception instanceof InvalidOperationException) {
      return 'INVALID_OPERATION';
    }

    const statusCodes: Record<number, string> = {
      [HttpStatus.BAD_REQUEST]: 'BAD_REQUEST',
      [HttpStatus.UNAUTHORIZED]: 'UNAUTHORIZED',
      [HttpStatus.FORBIDDEN]: 'FORBIDDEN',
      [HttpStatus.NOT_FOUND]: 'NOT_FOUND',
      [HttpStatus.CONFLICT]: 'CONFLICT',
      [HttpStatus.UNPROCESSABLE_ENTITY]: 'VALIDATION_ERROR',
      [HttpStatus.TOO_MANY_REQUESTS]: 'RATE_LIMITED',
      [HttpStatus.SERVICE_UNAVAILABLE]: 'SERVICE_UNAVAILABLE',
    };

    return statusCodes[statusCode] ?? 'HTTP_ERROR';
  }

  private readSafeErrorCode(value: string | undefined): string | undefined {
    return value && /^[A-Z][A-Z0-9_]{1,63}$/.test(value) ? value : undefined;
  }

  private getHttpErrorLabel(statusCode: number): string {
    const labels: Record<number, string> = {
      [HttpStatus.BAD_REQUEST]: 'Bad Request',
      [HttpStatus.UNAUTHORIZED]: 'Unauthorized',
      [HttpStatus.FORBIDDEN]: 'Forbidden',
      [HttpStatus.NOT_FOUND]: 'Not Found',
      [HttpStatus.CONFLICT]: 'Conflict',
      [HttpStatus.UNPROCESSABLE_ENTITY]: 'Unprocessable Entity',
      [HttpStatus.TOO_MANY_REQUESTS]: 'Too Many Requests',
      [HttpStatus.SERVICE_UNAVAILABLE]: 'Service Unavailable',
    };

    return labels[statusCode] ?? 'Request Error';
  }

  private getDefaultMessage(statusCode: number): string {
    return statusCode >= 500
      ? 'An unexpected error occurred.'
      : 'The request could not be completed.';
  }

  private sanitizeHttpMessage(message: string, statusCode: number): string {
    if (statusCode >= 500) {
      return this.getDefaultMessage(statusCode);
    }

    return message.replace(/^(Cannot\s+[A-Z]+\s+[^?\s]+)\?[^\s]*$/i, '$1');
  }

  private logException(
    exception: unknown,
    normalizedError: NormalizedError,
    request: Request,
    requestId: string,
  ): void {
    const driverMeta = this.getDriverAdapterMeta(exception);
    const event = {
      event: 'http.request.failed',
      requestId,
      method: request.method,
      path: request.path,
      statusCode: normalizedError.statusCode,
      code: normalizedError.code,
      errorName: exception instanceof Error ? exception.name : 'UnknownError',
      databaseCode: normalizedError.databaseCode ?? driverMeta.originalCode,
      driverKind: driverMeta.kind,
      driverMessage: driverMeta.originalMessage,
      driverDetail: driverMeta.detail,
      failureClass: this.isPoolTimeoutError(exception)
        ? 'PG_POOL_TIMEOUT'
        : undefined,
    };

    if (normalizedError.statusCode >= 500) {
      const includeStack =
        !this.isProduction &&
        exception instanceof Error &&
        !normalizedError.databaseCode;

      logger.error(event, includeStack ? exception.stack : undefined);
      return;
    }

    logger.warn(event);
  }
}
