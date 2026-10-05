/* eslint-disable @typescript-eslint/no-unsafe-argument */

import {
  BadRequestException,
  ConflictException,
  Controller,
  Get,
  Logger,
  Post,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import { Prisma } from '@prisma/client';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';

import {
  ApplicationLogger,
  HttpExceptionFilter,
  requestContextMiddleware,
  ResponseInterceptor,
} from '../../src/common';

@Controller('foundation-fixture')
class FoundationFixtureController {
  private readonly logger = new Logger(FoundationFixtureController.name);

  @Get('success')
  getSuccess() {
    return {
      value: 'ok',
    };
  }

  @Post('log-safety')
  logSafety() {
    this.logger.log({
      event: 'foundation.sensitive_log',
      password: 'logged-password',
      otp: '654321',
      developmentVerificationCode: '112233',
      platformSetupToken: 'platform-setup-secret',
      zohoSmtpPassword: 'zeptomail-send-token',
      email: 'employee@example.test',
      salary: 123_456,
      documentContent: 'private-document-content',
      databaseUrl:
        'postgresql://database-user:database-password@database-host:5432/hr',
      safeCount: 1,
    });

    return {
      accepted: true,
    };
  }

  @Get('validation-error')
  getValidationError(): never {
    throw new BadRequestException({
      error: 'Bad Request',
      message: ['name is required', 'code must be a string'],
    });
  }

  @Get('scope-selection-required')
  getScopeSelectionRequired(): never {
    throw new ConflictException({
      code: 'ORGANIZATION_SCOPE_SELECTION_REQUIRED',
      message: 'Select an organization scope to continue.',
      availableScopes: [
        { scope: 'COMPANY', companyId: 'company-a' },
        { scope: 'COMPANY', companyId: 'company-b' },
      ],
    });
  }

  @Get('prisma-conflict')
  getPrismaConflict(): never {
    throw new Prisma.PrismaClientKnownRequestError(
      'query contained sensitive-value',
      {
        code: 'P2002',
        clientVersion: '7.8.0',
      },
    );
  }

  @Get('unexpected-error')
  getUnexpectedError(): never {
    throw new Error('internal secret must not be returned');
  }

  @Get('pool-timeout')
  getPoolTimeout(): never {
    throw new Error('timeout exceeded when trying to connect');
  }
}

describe('HTTP foundation', () => {
  let app: INestApplication;
  let consoleLogSpy: jest.SpyInstance;
  let consoleErrorSpy: jest.SpyInstance;
  let consoleWarnSpy: jest.SpyInstance;

  beforeAll(async () => {
    consoleLogSpy = jest
      .spyOn(console, 'log')
      .mockImplementation(() => undefined);
    consoleErrorSpy = jest
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
    consoleWarnSpy = jest
      .spyOn(console, 'warn')
      .mockImplementation(() => undefined);

    const moduleReference = await Test.createTestingModule({
      controllers: [FoundationFixtureController],
    }).compile();
    const logger = new ApplicationLogger({
      context: 'FoundationTest',
      json: true,
      colors: false,
      compact: true,
      forceConsole: true,
    });

    app = moduleReference.createNestApplication({
      logger,
    });
    app.use(requestContextMiddleware);
    app.useGlobalInterceptors(new ResponseInterceptor(app.get(Reflector)));
    app.useGlobalFilters(new HttpExceptionFilter());

    await app.init();

    consoleLogSpy.mockClear();
    consoleErrorSpy.mockClear();
    consoleWarnSpy.mockClear();
  });

  afterAll(async () => {
    await app.close();
    consoleLogSpy.mockRestore();
    consoleErrorSpy.mockRestore();
    consoleWarnSpy.mockRestore();
  });

  it('preserves a valid request ID and the success envelope', async () => {
    const response = await request(app.getHttpServer())
      .get('/foundation-fixture/success')
      .set('X-Request-ID', 'client-request-123')
      .expect(200);

    expect(response.headers['x-request-id']).toBe('client-request-123');
    expect(response.body).toEqual({
      success: true,
      data: {
        value: 'ok',
      },
    });
  });

  it('replaces an invalid incoming request ID', async () => {
    const response = await request(app.getHttpServer())
      .get('/foundation-fixture/success')
      .set('X-Request-ID', 'invalid request id')
      .expect(200);

    expect(response.headers['x-request-id']).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
  });

  it('returns a compatible validation error with safe details', async () => {
    const response = await request(app.getHttpServer())
      .get('/foundation-fixture/validation-error')
      .set('X-Request-ID', 'validation-request')
      .expect(400);

    expect(response.body).toMatchObject({
      success: false,
      statusCode: 400,
      error: 'Bad Request',
      code: 'VALIDATION_ERROR',
      message: ['name is required', 'code must be a string'],
      requestId: 'validation-request',
      path: '/foundation-fixture/validation-error',
      method: 'GET',
      details: [
        { message: 'name is required' },
        { message: 'code must be a string' },
      ],
    });
  });

  it('returns organization choices for an explicit scope-selection conflict', async () => {
    const response = await request(app.getHttpServer())
      .get('/foundation-fixture/scope-selection-required')
      .expect(409);

    expect(response.body).toMatchObject({
      success: false,
      code: 'ORGANIZATION_SCOPE_SELECTION_REQUIRED',
      availableScopes: [
        { scope: 'COMPANY', companyId: 'company-a' },
        { scope: 'COMPANY', companyId: 'company-b' },
      ],
    });
  });

  it('maps Prisma conflicts without exposing database details', async () => {
    const response = await request(app.getHttpServer())
      .get('/foundation-fixture/prisma-conflict')
      .expect(409);

    expect(response.body).toMatchObject({
      success: false,
      statusCode: 409,
      code: 'CONFLICT',
      message: 'A record with the same unique value already exists.',
    });
    expect(JSON.stringify(response.body)).not.toContain('sensitive-value');
  });

  it('hides unexpected error details and query values', async () => {
    consoleErrorSpy.mockClear();

    const response = await request(app.getHttpServer())
      .get('/foundation-fixture/unexpected-error?token=query-secret')
      .expect(500);

    expect(response.body).toMatchObject({
      success: false,
      statusCode: 500,
      code: 'INTERNAL_ERROR',
      message: 'An unexpected error occurred.',
      path: '/foundation-fixture/unexpected-error',
    });
    expect(JSON.stringify(response.body)).not.toContain('internal secret');
    expect(JSON.stringify(response.body)).not.toContain('query-secret');

    await new Promise((resolvePromise) => setImmediate(resolvePromise));

    const logOutput = JSON.stringify(consoleErrorSpy.mock.calls);

    expect(logOutput).not.toContain('internal secret');
    expect(logOutput).not.toContain('query-secret');
  });

  it('maps pg-pool connection timeouts without exposing driver text', async () => {
    const response = await request(app.getHttpServer())
      .get('/foundation-fixture/pool-timeout')
      .expect(503);

    expect(response.body).toMatchObject({
      success: false,
      statusCode: 503,
      code: 'DATABASE_UNAVAILABLE',
      message: 'The service is temporarily unavailable.',
    });
    expect(JSON.stringify(response.body)).not.toContain(
      'timeout exceeded when trying to connect',
    );
  });

  it('removes query values from framework-generated route errors', async () => {
    const response = await request(app.getHttpServer())
      .get('/missing-route?token=query-secret')
      .set('X-Request-ID', 'missing-route-request')
      .expect(404);

    expect(response.body).toMatchObject({
      success: false,
      statusCode: 404,
      code: 'NOT_FOUND',
      requestId: 'missing-route-request',
      path: '/missing-route',
      message: 'Cannot GET /missing-route',
    });
    expect(JSON.stringify(response.body)).not.toContain('query-secret');
  });

  it('writes structured, correlated logs with sensitive values redacted', async () => {
    consoleLogSpy.mockClear();

    await request(app.getHttpServer())
      .post('/foundation-fixture/log-safety?token=query-secret')
      .set('X-Request-ID', 'safe-log-request')
      .send({
        password: 'body-secret',
      })
      .expect(201);

    await new Promise((resolvePromise) => setImmediate(resolvePromise));

    const logOutput = JSON.stringify(consoleLogSpy.mock.calls);

    expect(logOutput).toContain('http.request.completed');
    expect(logOutput).toContain('foundation.sensitive_log');
    expect(logOutput).toContain('safe-log-request');
    expect(logOutput).toContain('[REDACTED]');
    expect(logOutput).not.toContain('body-secret');
    expect(logOutput).not.toContain('query-secret');
    expect(logOutput).not.toContain('logged-password');
    expect(logOutput).not.toContain('654321');
    expect(logOutput).not.toContain('112233');
    expect(logOutput).not.toContain('platform-setup-secret');
    expect(logOutput).not.toContain('zeptomail-send-token');
    expect(logOutput).not.toContain('employee@example.test');
    expect(logOutput).not.toContain('123456');
    expect(logOutput).not.toContain('private-document-content');
    expect(logOutput).not.toContain('database-password');

    const structuredLine = consoleLogSpy.mock.calls
      .flat()
      .find(
        (value): value is string =>
          typeof value === 'string' &&
          value.includes('foundation.sensitive_log'),
      );

    expect(structuredLine).toBeDefined();
    expect(() => {
      JSON.parse(structuredLine ?? '');
    }).not.toThrow();
  });
});
