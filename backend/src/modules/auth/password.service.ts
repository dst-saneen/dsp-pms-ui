import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { hash, verify } from 'argon2';
import { createHmac, randomBytes } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { Environment } from '../../config';

export type PasswordIdentityContext = {
  email?: string | null;
  username?: string | null;
};

@Injectable()
export class PasswordService {
  private readonly metadataSecret: Buffer;
  private readonly actionTokenSecret: Buffer;

  constructor(configService: ConfigService<Environment, true>) {
    const secretPath = resolve(
      process.cwd(),
      configService.getOrThrow('AUTH_HASH_SECRET_PATH', { infer: true }),
    );
    this.metadataSecret =
      configService.getOrThrow('NODE_ENV', { infer: true }) === 'test' &&
      !existsSync(secretPath)
        ? Buffer.from('test-only-authentication-metadata-secret')
        : readFileSync(secretPath);
    const actionTokenSecretPath = resolve(
      process.cwd(),
      configService.getOrThrow('AUTH_ACTION_TOKEN_SECRET_PATH', {
        infer: true,
      }),
    );
    this.actionTokenSecret =
      configService.getOrThrow('NODE_ENV', { infer: true }) === 'test' &&
      !existsSync(actionTokenSecretPath)
        ? Buffer.from('test-only-action-token-secret-value')
        : readFileSync(actionTokenSecretPath);

    if (this.metadataSecret.length < 32 || this.actionTokenSecret.length < 32) {
      throw new Error('Authentication secrets must contain at least 32 bytes.');
    }
  }

  async hashPassword(
    password: string,
    identity?: PasswordIdentityContext,
  ): Promise<string> {
    this.validatePassword(password, identity);

    return hash(password, {
      type: 2,
      memoryCost: 19_456,
      timeCost: 2,
      parallelism: 1,
    });
  }

  async verifyPassword(hashValue: string, password: string): Promise<boolean> {
    try {
      return await verify(hashValue, password);
    } catch {
      return false;
    }
  }

  validatePassword(password: string, identity?: PasswordIdentityContext): void {
    if (password.length < 12 || password.length > 128) {
      throw new BadRequestException({
        code: 'PASSWORD_POLICY_FAILED',
        message: 'Password must contain between 12 and 128 characters.',
      });
    }

    const normalizedPassword = password.trim().toLowerCase();
    const blockedIdentities = [identity?.email, identity?.username]
      .map((value) => value?.trim().toLowerCase())
      .filter((value): value is string => Boolean(value));

    if (blockedIdentities.some((value) => value === normalizedPassword)) {
      throw new BadRequestException({
        code: 'PASSWORD_POLICY_FAILED',
        message: 'Password must not be the same as your email or username.',
      });
    }
  }

  generateTemporaryPassword(): string {
    const alphabet =
      'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%';
    const random = randomBytes(20);

    return Array.from(
      random,
      (value) => alphabet[value % alphabet.length],
    ).join('');
  }

  generateRefreshSecret(): string {
    return randomBytes(32).toString('base64url');
  }

  hashToken(value: string): string {
    return createHmac('sha256', this.metadataSecret)
      .update(value)
      .digest('base64url');
  }

  hashActionToken(
    purpose:
      | 'invitation'
      | 'password-reset'
      | 'offer-response'
      | 'offer-signature-resubmission',
    value: string,
  ) {
    return createHmac('sha256', this.actionTokenSecret)
      .update(`${purpose}:${value}`)
      .digest('base64url');
  }

  hashMetadata(value?: string): string | undefined {
    if (!value) {
      return undefined;
    }

    return createHmac('sha256', this.metadataSecret)
      .update(value)
      .digest('base64url');
  }
}
