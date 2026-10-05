import type { ConfigService } from '@nestjs/config';
import type { Request, Response } from 'express';

import type { Environment } from '../../src/config';
import type { AccountLifecycleService } from '../../src/modules/auth/account-lifecycle.service';
import { AuthController } from '../../src/modules/auth/auth.controller';
import type { AuthService } from '../../src/modules/auth/auth.service';
import type { RegistrationService } from '../../src/modules/auth/registration.service';
import type { SessionService } from '../../src/modules/auth/session.service';

describe('AuthController refresh cookie', () => {
  it('scopes the cookie to the frontend /api auth proxy', async () => {
    const authService = {
      login: jest.fn().mockResolvedValue({
        refreshToken: 'opaque-refresh-token',
        accessToken: 'access-token',
        user: { id: 'user-id' },
      }),
    };
    const configService = {
      getOrThrow: jest.fn((key: keyof Environment) => {
        if (key === 'AUTH_REFRESH_COOKIE_NAME') return 'dsp_refresh';
        if (key === 'AUTH_SESSION_ABSOLUTE_TTL_SECONDS') return 86_400;
        if (key === 'NODE_ENV') return 'development';
        throw new Error(`Unexpected configuration key ${key}.`);
      }),
    };
    const response = { cookie: jest.fn() };
    const request = {
      ip: '127.0.0.1',
      get: jest.fn().mockReturnValue('QA browser'),
    };
    const controller = new AuthController(
      authService as unknown as AuthService,
      {} as AccountLifecycleService,
      {} as RegistrationService,
      {} as SessionService,
      configService as unknown as ConfigService<Environment, true>,
    );

    await controller.login(
      {
        identifier: 'qa+india-owner@dsp-reference.invalid',
        password: 'not-recorded-by-the-test',
      },
      request as unknown as Request,
      response as unknown as Response,
    );

    expect(response.cookie).toHaveBeenCalledWith(
      'dsp_refresh',
      'opaque-refresh-token',
      expect.objectContaining({
        httpOnly: true,
        sameSite: 'strict',
        secure: false,
        path: '/api/auth',
      }),
    );
  });

  it('clears the refresh cookie with the same proxy scope on logout', async () => {
    const authService = {
      logout: jest.fn().mockResolvedValue(undefined),
    };
    const configService = {
      getOrThrow: jest.fn((key: keyof Environment) => {
        if (key === 'AUTH_REFRESH_COOKIE_NAME') return 'dsp_refresh';
        if (key === 'AUTH_SESSION_ABSOLUTE_TTL_SECONDS') return 86_400;
        if (key === 'NODE_ENV') return 'development';
        throw new Error(`Unexpected configuration key ${key}.`);
      }),
    };
    const response = { clearCookie: jest.fn() };
    const request = {
      ip: '127.0.0.1',
      get: jest.fn().mockReturnValue('QA browser'),
      user: { id: 'user-id', sessionId: 'session-id' },
    };
    const controller = new AuthController(
      authService as unknown as AuthService,
      {} as AccountLifecycleService,
      {} as RegistrationService,
      {} as SessionService,
      configService as unknown as ConfigService<Environment, true>,
    );

    await controller.logout(
      request as unknown as Parameters<AuthController['logout']>[0],
      response as unknown as Response,
    );

    expect(response.clearCookie).toHaveBeenCalledWith(
      'dsp_refresh',
      expect.objectContaining({
        httpOnly: true,
        sameSite: 'strict',
        secure: false,
        path: '/api/auth',
      }),
    );
  });

  it('marks the refresh cookie secure in production', async () => {
    const authService = {
      login: jest.fn().mockResolvedValue({
        refreshToken: 'opaque-refresh-token',
        accessToken: 'access-token',
        user: { id: 'user-id' },
      }),
    };
    const configService = {
      getOrThrow: jest.fn((key: keyof Environment) => {
        if (key === 'AUTH_REFRESH_COOKIE_NAME') return 'dsp_refresh';
        if (key === 'AUTH_SESSION_ABSOLUTE_TTL_SECONDS') return 86_400;
        if (key === 'NODE_ENV') return 'production';
        throw new Error(`Unexpected configuration key ${key}.`);
      }),
    };
    const response = { cookie: jest.fn() };
    const request = {
      ip: '127.0.0.1',
      get: jest.fn().mockReturnValue('QA browser'),
    };
    const controller = new AuthController(
      authService as unknown as AuthService,
      {} as AccountLifecycleService,
      {} as RegistrationService,
      {} as SessionService,
      configService as unknown as ConfigService<Environment, true>,
    );

    await controller.login(
      {
        identifier: 'qa+india-owner@dsp-reference.invalid',
        password: 'not-recorded-by-the-test',
      },
      request as unknown as Request,
      response as unknown as Response,
    );

    expect(response.cookie).toHaveBeenCalledWith(
      'dsp_refresh',
      'opaque-refresh-token',
      expect.objectContaining({
        secure: true,
        path: '/api/auth',
      }),
    );
  });
});
