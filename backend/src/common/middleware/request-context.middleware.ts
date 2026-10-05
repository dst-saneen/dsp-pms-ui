import { Logger } from '@nestjs/common';
import { NextFunction, Request, Response } from 'express';
import { randomUUID } from 'node:crypto';
import { performance } from 'node:perf_hooks';

import { requestContextStorage } from '../context';

const REQUEST_ID_HEADER = 'x-request-id';
const REQUEST_ID_PATTERN = /^[A-Za-z0-9._-]{1,64}$/;
const logger = new Logger('HttpRequest');

export type RequestWithId = Request & {
  requestId: string;
};

function resolveRequestId(request: Request): string {
  const incomingRequestId = request.get(REQUEST_ID_HEADER)?.trim();

  if (incomingRequestId && REQUEST_ID_PATTERN.test(incomingRequestId)) {
    return incomingRequestId;
  }

  return randomUUID();
}

export function requestContextMiddleware(
  request: Request,
  response: Response,
  next: NextFunction,
): void {
  const requestId = resolveRequestId(request);
  const startedAt = performance.now();
  const requestWithId = request as RequestWithId;

  requestWithId.requestId = requestId;
  response.setHeader('X-Request-ID', requestId);

  requestContextStorage.run({ requestId }, () => {
    response.once('finish', () => {
      const statusCode = response.statusCode;
      const isSuccessfulHealthProbe =
        request.path.startsWith('/health/') && statusCode < 400;

      if (isSuccessfulHealthProbe) {
        return;
      }

      const event = {
        event: 'http.request.completed',
        method: request.method,
        path: request.path,
        statusCode,
        durationMs: Math.round((performance.now() - startedAt) * 100) / 100,
      };

      if (statusCode >= 500) {
        logger.error(event);
      } else if (statusCode >= 400) {
        logger.warn(event);
      } else {
        logger.log(event);
      }
    });

    next();
  });
}
