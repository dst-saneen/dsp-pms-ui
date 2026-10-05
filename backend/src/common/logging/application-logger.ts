import { ConsoleLogger } from '@nestjs/common';
import type { ConsoleLoggerOptions } from '@nestjs/common';

import { getRequestId } from '../context';
import { sanitizeLogValue } from './log-sanitizer';

export class ApplicationLogger extends ConsoleLogger {
  constructor(options: ConsoleLoggerOptions) {
    super(options);
  }

  override log(message: unknown, ...optionalParams: unknown[]): void {
    super.log(
      this.withRequestContext(sanitizeLogValue(message)),
      ...optionalParams.map((parameter) => sanitizeLogValue(parameter)),
    );
  }

  override error(message: unknown, ...optionalParams: unknown[]): void {
    super.error(
      this.withRequestContext(sanitizeLogValue(message)),
      ...optionalParams.map((parameter) => sanitizeLogValue(parameter)),
    );
  }

  override warn(message: unknown, ...optionalParams: unknown[]): void {
    super.warn(
      this.withRequestContext(sanitizeLogValue(message)),
      ...optionalParams.map((parameter) => sanitizeLogValue(parameter)),
    );
  }

  override debug(message: unknown, ...optionalParams: unknown[]): void {
    super.debug(
      this.withRequestContext(sanitizeLogValue(message)),
      ...optionalParams.map((parameter) => sanitizeLogValue(parameter)),
    );
  }

  override verbose(message: unknown, ...optionalParams: unknown[]): void {
    super.verbose(
      this.withRequestContext(sanitizeLogValue(message)),
      ...optionalParams.map((parameter) => sanitizeLogValue(parameter)),
    );
  }

  override fatal(message: unknown, ...optionalParams: unknown[]): void {
    super.fatal(
      this.withRequestContext(sanitizeLogValue(message)),
      ...optionalParams.map((parameter) => sanitizeLogValue(parameter)),
    );
  }

  private withRequestContext(message: unknown): unknown {
    const requestId = getRequestId();

    if (!requestId) {
      return message;
    }

    if (
      typeof message === 'object' &&
      message !== null &&
      !Array.isArray(message)
    ) {
      return {
        ...message,
        requestId,
      };
    }

    return {
      message,
      requestId,
    };
  }
}
