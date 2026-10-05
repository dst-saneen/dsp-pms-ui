import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { Environment } from '../../../config';
import { RedisService } from '../../auth/redis.service';
import { PasswordService } from '../../auth/password.service';

const HONEYPOT_SUCCESS = {
  applicationCode: 'RECEIVED',
  status: 'RECEIVED',
  message:
    'If your details match our records, your application has been received.',
};

@Injectable()
export class PublicCareersAbuseService {
  constructor(
    private readonly configService: ConfigService<Environment, true>,
    private readonly redisService: RedisService,
    private readonly passwordService: PasswordService,
  ) {}

  parseHoneypot(body: Record<string, unknown>): string | undefined {
    const value = body.honeypot ?? body.website;
    return typeof value === 'string' && value.trim() ? value : undefined;
  }

  isHoneypotTriggered(value?: string): boolean {
    return Boolean(value?.trim());
  }

  honeypotResponse(now = new Date()) {
    return {
      ...HONEYPOT_SUCCESS,
      submittedAt: now,
    };
  }

  async verifyTurnstile(token: string | undefined, ip?: string): Promise<void> {
    const nodeEnv = this.configService.getOrThrow('NODE_ENV', { infer: true });
    const secret = this.configService.get('TURNSTILE_SECRET_KEY', {
      infer: true,
    });

    if (nodeEnv !== 'production' && !secret) {
      return;
    }

    if (!secret) {
      throw new BadRequestException({
        code: 'TURNSTILE_UNAVAILABLE',
        message: 'Application verification is unavailable.',
      });
    }

    if (!token?.trim()) {
      throw new BadRequestException({
        code: 'TURNSTILE_REQUIRED',
        message: 'Verification is required.',
      });
    }

    const response = await fetch(
      'https://challenges.cloudflare.com/turnstile/v0/siteverify',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          secret,
          response: token,
          remoteip: ip,
        }),
      },
    );

    const payload = (await response.json()) as { success?: boolean };

    if (!payload.success) {
      throw new BadRequestException({
        code: 'TURNSTILE_INVALID',
        message: 'Verification failed. Please try again.',
      });
    }
  }

  async enforceRateLimit(input: {
    ip?: string;
    email: string;
    openingId: string;
  }): Promise<void> {
    const limit = this.configService.getOrThrow(
      'PUBLIC_CAREERS_RATE_LIMIT_PER_HOUR',
      { infer: true },
    );
    const ipKey = `recruitment:careers:ip:${this.passwordService.hashMetadata(input.ip) ?? 'unknown'}`;
    const emailKey = `recruitment:careers:email:${input.openingId}:${input.email.trim().toLowerCase()}`;

    const [ipCount, emailCount] = await Promise.all([
      this.redisService.incrementWithExpiry(ipKey, 3_600),
      this.redisService.incrementWithExpiry(emailKey, 3_600),
    ]);

    if ((ipCount && ipCount > limit) || (emailCount && emailCount > 3)) {
      throw new HttpException(
        {
          code: 'RATE_LIMITED',
          message: 'Too many applications. Please try again later.',
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }

  /**
   * Upload-session creation allocates a presigned object-storage write. It is
   * separately rate-limited because it happens before an applicant email is
   * collected, while still sharing the deployment-owned careers limit.
   */
  async enforceUploadSessionRateLimit(input: {
    ip?: string;
    openingId: string;
  }): Promise<void> {
    const limit = this.configService.getOrThrow(
      'PUBLIC_CAREERS_RATE_LIMIT_PER_HOUR',
      { infer: true },
    );
    const ipHash = this.passwordService.hashMetadata(input.ip) ?? 'unknown';
    const key = `recruitment:careers:upload-session:${input.openingId}:${ipHash}`;
    const count = await this.redisService.incrementWithExpiry(key, 3_600);

    if (count && count > limit) {
      throw new HttpException(
        {
          code: 'RATE_LIMITED',
          message: 'Too many upload attempts. Please try again later.',
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }
}
