import { BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import type { Environment } from '../../src/config';
import { PasswordService } from '../../src/modules/auth/password.service';

describe('PasswordService policy', () => {
  const service = new PasswordService({
    getOrThrow: (key: string) => {
      if (key === 'NODE_ENV') return 'test';
      if (key === 'AUTH_HASH_SECRET_PATH') return 'certs/auth-hash-secret';
      if (key === 'AUTH_ACTION_TOKEN_SECRET_PATH') {
        return 'certs/auth-action-token-secret';
      }
      throw new Error(`Unexpected config key ${key}`);
    },
  } as unknown as ConfigService<Environment, true>);

  it('rejects passwords shorter than 12 characters', () => {
    expect(() => service.validatePassword('short-pass')).toThrow(
      BadRequestException,
    );
  });

  it('rejects password identical to email (case-insensitive)', () => {
    expect(() =>
      service.validatePassword('Owner@Example.Com', {
        email: 'owner@example.com',
      }),
    ).toThrow(BadRequestException);
  });

  it('rejects password identical to username', () => {
    expect(() =>
      service.validatePassword('same-username', {
        username: 'same-username',
      }),
    ).toThrow(BadRequestException);
  });

  it('accepts a distinct password that meets length policy', () => {
    expect(() =>
      service.validatePassword('DistinctPass!234', {
        email: 'owner@example.com',
        username: 'owner',
      }),
    ).not.toThrow();
  });
});
