import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  PendingRegistration,
  Prisma,
  RegistrationType,
  RoleScope,
  SecurityEventType,
  UserStatus,
} from '@prisma/client';
import { randomBytes, randomInt, timingSafeEqual } from 'node:crypto';

import { getRequestId } from '../../common';
import { Environment } from '../../config';
import { TransactionalMailService } from '../mail/transactional-mail.service';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthService } from './auth.service';
import { RequestSecurityMetadata } from './auth.types';
import { PasswordService } from './password.service';
import { RedisService } from './redis.service';

export type DeliveryStatus = 'SENT' | 'BYPASSED' | 'FAILED';

interface StartRegistrationInput {
  type: RegistrationType;
  organizationName?: string;
  legalCountryCode?: string;
  displayName: string;
  email: string;
  password: string;
}

export interface RegistrationStartResponse {
  registrationId: string;
  maskedEmail: string;
  expiresAt: string;
  resendAvailableAt: string;
  deliveryStatus: DeliveryStatus;
  developmentVerificationCode?: string;
}

@Injectable()
export class RegistrationService {
  private readonly selfRegistrationEnabled: boolean;
  private readonly publicCareersEnabled: boolean;
  private readonly codeTtlSeconds: number;
  private readonly maximumAttempts: number;
  private readonly resendCooldownSeconds: number;

  constructor(
    private readonly prisma: PrismaService,
    private readonly authService: AuthService,
    private readonly mailService: TransactionalMailService,
    private readonly passwordService: PasswordService,
    private readonly redisService: RedisService,
    configService: ConfigService<Environment, true>,
  ) {
    this.selfRegistrationEnabled = configService.getOrThrow(
      'SAAS_SELF_REGISTRATION_ENABLED',
      { infer: true },
    );
    this.publicCareersEnabled = configService.getOrThrow(
      'PUBLIC_CAREERS_ENABLED',
      { infer: true },
    );
    this.codeTtlSeconds = configService.getOrThrow(
      'EMAIL_VERIFICATION_CODE_TTL_SECONDS',
      { infer: true },
    );
    this.maximumAttempts = configService.getOrThrow(
      'EMAIL_VERIFICATION_MAX_ATTEMPTS',
      { infer: true },
    );
    this.resendCooldownSeconds = configService.getOrThrow(
      'EMAIL_VERIFICATION_RESEND_COOLDOWN_SECONDS',
      { infer: true },
    );
  }

  capabilities() {
    const emailAvailable = this.mailService.isAvailable();

    return {
      selfRegistrationEnabled: this.selfRegistrationEnabled && emailAvailable,
      // Public recruitment availability is Company-owned and is checked after
      // the public company code resolves. This remains only the deployment
      // safety switch for exposing public-careers routes at all.
      publicCareersEnabled: this.publicCareersEnabled,
      platformSetupAvailable: false,
    };
  }

  async startOrganization(
    input: {
      organizationName: string;
      legalCountryCode: string;
      displayName: string;
      email: string;
      password: string;
    },
    metadata: RequestSecurityMetadata,
  ): Promise<RegistrationStartResponse> {
    if (!this.selfRegistrationEnabled) {
      throw new ForbiddenException(
        'Organization self-registration is not available.',
      );
    }

    return this.startRegistration(
      {
        type: RegistrationType.ORGANIZATION_OWNER,
        organizationName: input.organizationName.trim(),
        legalCountryCode: input.legalCountryCode.trim().toUpperCase(),
        displayName: input.displayName.trim(),
        email: input.email.trim(),
        password: input.password,
      },
      metadata,
    );
  }

  async verifyOrganization(
    registrationId: string,
    code: string,
    metadata: RequestSecurityMetadata,
  ) {
    if (!this.selfRegistrationEnabled) {
      throw new ForbiddenException(
        'Organization self-registration is not available.',
      );
    }

    return this.verify(
      registrationId,
      code,
      RegistrationType.ORGANIZATION_OWNER,
      metadata,
    );
  }

  async resend(
    registrationId: string,
    metadata: RequestSecurityMetadata,
  ): Promise<RegistrationStartResponse> {
    const pending = await this.loadPending(registrationId);

    if (pending.type !== RegistrationType.ORGANIZATION_OWNER) {
      throw new NotFoundException('Registration challenge not found.');
    }

    if (!this.selfRegistrationEnabled) {
      throw new ForbiddenException(
        'Organization self-registration is not available.',
      );
    }

    this.assertMailAvailable();
    await this.enforceRateLimit(
      `auth:registration:resend:${registrationId}:${this.metadataRateKey(metadata)}`,
      10,
      3_600,
    );

    const now = new Date();

    if (pending.resendAvailableAt.getTime() > now.getTime()) {
      this.throwResendCooldown(pending.resendAvailableAt);
    }

    const code = this.generateCode();
    const expiresAt = new Date(now.getTime() + this.codeTtlSeconds * 1_000);
    const resendAvailableAt = new Date(
      now.getTime() + this.resendCooldownSeconds * 1_000,
    );
    const result = await this.prisma.pendingRegistration.updateMany({
      where: {
        id: pending.id,
        consumedAt: null,
        resendAvailableAt: { lte: now },
      },
      data: {
        otpHash: this.hashCode(pending.type, pending.normalizedEmail, code),
        otpExpiresAt: expiresAt,
        failedAttempts: 0,
        resendAvailableAt,
        ipHash: this.passwordService.hashMetadata(metadata.ip),
        userAgentHash: this.passwordService.hashMetadata(metadata.userAgent),
      },
    });

    if (result.count !== 1) {
      const current = await this.loadPending(registrationId);
      this.throwResendCooldown(current.resendAvailableAt);
    }

    const refreshed = {
      ...pending,
      otpExpiresAt: expiresAt,
      resendAvailableAt,
    };

    return this.deliverCode(refreshed, code, metadata);
  }

  private async startRegistration(
    input: StartRegistrationInput,
    metadata: RequestSecurityMetadata,
  ): Promise<RegistrationStartResponse> {
    this.assertMailAvailable();

    const normalizedEmail = this.normalizeEmail(input.email);
    await this.enforceRateLimit(
      `auth:registration:start:${input.type}:${this.passwordService.hashToken(
        normalizedEmail,
      )}:${this.metadataRateKey(metadata)}`,
      5,
      15 * 60,
    );

    const existingUser = await this.prisma.user.findFirst({
      where: {
        OR: [{ normalizedEmail }, { normalizedUsername: normalizedEmail }],
      },
      select: { id: true },
    });

    if (existingUser) {
      throw new ConflictException(
        'An account already exists for this email address.',
      );
    }

    const existing = await this.prisma.pendingRegistration.findUnique({
      where: {
        type_normalizedEmail: {
          type: input.type,
          normalizedEmail,
        },
      },
    });
    const now = new Date();

    if (existing?.consumedAt) {
      throw new ConflictException(
        'An account already exists for this email address.',
      );
    }

    if (existing && existing.resendAvailableAt.getTime() > now.getTime()) {
      this.throwResendCooldown(existing.resendAvailableAt);
    }

    const [passwordHash, code] = await Promise.all([
      this.passwordService.hashPassword(input.password, {
        email: input.email,
      }),
      Promise.resolve(this.generateCode()),
    ]);
    const expiresAt = new Date(now.getTime() + this.codeTtlSeconds * 1_000);
    const resendAvailableAt = new Date(
      now.getTime() + this.resendCooldownSeconds * 1_000,
    );
    const commonData = {
      organizationName: input.organizationName ?? null,
      legalCountryCode: input.legalCountryCode ?? null,
      displayName: input.displayName,
      email: input.email,
      normalizedEmail,
      passwordHash,
      otpHash: this.hashCode(input.type, normalizedEmail, code),
      otpExpiresAt: expiresAt,
      failedAttempts: 0,
      resendAvailableAt,
      consumedAt: null,
      ipHash: this.passwordService.hashMetadata(metadata.ip) ?? null,
      userAgentHash:
        this.passwordService.hashMetadata(metadata.userAgent) ?? null,
    };

    let pending: PendingRegistration;

    if (existing) {
      const update = await this.prisma.pendingRegistration.updateMany({
        where: {
          id: existing.id,
          consumedAt: null,
          resendAvailableAt: { lte: now },
        },
        data: commonData,
      });

      if (update.count !== 1) {
        const current = await this.loadPending(existing.id);
        this.throwResendCooldown(current.resendAvailableAt);
      }

      pending = {
        ...existing,
        ...commonData,
        updatedAt: now,
      };
    } else {
      try {
        pending = await this.prisma.pendingRegistration.create({
          data: {
            type: input.type,
            ...commonData,
          },
        });
      } catch (error) {
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === 'P2002'
        ) {
          throw new HttpException(
            'A verification code was requested recently. Please wait before trying again.',
            HttpStatus.TOO_MANY_REQUESTS,
          );
        }

        throw error;
      }
    }

    await this.recordSecurityEvent(
      SecurityEventType.REGISTRATION_STARTED,
      metadata,
      {
        registrationId: pending.id,
        registrationType: pending.type,
      },
    );

    return this.deliverCode(pending, code, metadata);
  }

  private async deliverCode(
    pending: PendingRegistration,
    code: string,
    metadata: RequestSecurityMetadata,
  ): Promise<RegistrationStartResponse> {
    let deliveryStatus: DeliveryStatus;

    try {
      deliveryStatus = await this.mailService.sendVerificationCode({
        to: pending.email,
        displayName: pending.displayName,
        code,
        expiresInMinutes: Math.ceil(this.codeTtlSeconds / 60),
        clientReference: pending.id,
      });

      await this.recordSecurityEvent(
        SecurityEventType.EMAIL_VERIFICATION_SENT,
        metadata,
        {
          registrationId: pending.id,
          registrationType: pending.type,
          deliveryStatus,
        },
      );
    } catch (error) {
      if (!(error instanceof ServiceUnavailableException)) {
        throw error;
      }

      deliveryStatus = 'FAILED';
    }

    return {
      registrationId: pending.id,
      maskedEmail: this.maskEmail(pending.email),
      expiresAt: pending.otpExpiresAt.toISOString(),
      resendAvailableAt: pending.resendAvailableAt.toISOString(),
      deliveryStatus,
      ...(this.mailService.isDevelopmentBypass()
        ? { developmentVerificationCode: code }
        : {}),
    };
  }

  private async verify(
    registrationId: string,
    code: string,
    expectedType: RegistrationType,
    metadata: RequestSecurityMetadata,
  ) {
    await this.enforceRateLimit(
      `auth:registration:verify:${registrationId}:${this.metadataRateKey(
        metadata,
      )}`,
      this.maximumAttempts + 5,
      this.codeTtlSeconds,
    );

    const pending = await this.loadPending(registrationId);
    const now = new Date();

    if (pending.type !== expectedType) {
      throw new NotFoundException('Registration challenge not found.');
    }

    if (pending.otpExpiresAt.getTime() <= now.getTime()) {
      throw new BadRequestException(
        'The verification code has expired. Request a new code.',
      );
    }

    if (pending.failedAttempts >= this.maximumAttempts) {
      throw new BadRequestException(
        'Maximum verification attempts reached. Request a new code.',
      );
    }

    const suppliedHash = this.hashCode(
      pending.type,
      pending.normalizedEmail,
      code,
    );

    if (!this.hashesMatch(suppliedHash, pending.otpHash)) {
      const incremented = await this.prisma.pendingRegistration.updateMany({
        where: {
          id: pending.id,
          consumedAt: null,
          otpHash: pending.otpHash,
          failedAttempts: { lt: this.maximumAttempts },
        },
        data: {
          failedAttempts: { increment: 1 },
        },
      });

      if (incremented.count !== 1) {
        throw new BadRequestException(
          'Maximum verification attempts reached. Request a new code.',
        );
      }

      const attemptsRemaining = Math.max(
        0,
        this.maximumAttempts - pending.failedAttempts - 1,
      );

      throw new BadRequestException({
        message: 'The verification code is invalid.',
        attemptsRemaining,
      });
    }

    const userId = await this.prisma.$transaction(async (transaction) => {
      const consumed = await transaction.pendingRegistration.updateMany({
        where: {
          id: pending.id,
          type: expectedType,
          consumedAt: null,
          otpHash: suppliedHash,
          otpExpiresAt: { gt: now },
          failedAttempts: { lt: this.maximumAttempts },
        },
        data: {
          consumedAt: now,
        },
      });

      if (consumed.count !== 1) {
        throw new ConflictException(
          'This registration challenge was already verified.',
        );
      }

      const provisionedUserId = await this.provisionOrganizationOwner(
        transaction,
        pending,
        now,
      );

      await transaction.securityEvent.create({
        data: {
          userId: provisionedUserId,
          type: SecurityEventType.EMAIL_VERIFICATION_SUCCEEDED,
          requestId: getRequestId(),
          ipHash: this.passwordService.hashMetadata(metadata.ip),
          metadata: {
            registrationId: pending.id,
            registrationType: pending.type,
          },
        },
      });

      return provisionedUserId;
    });

    return this.authService.createAuthenticatedSession(userId, metadata);
  }

  private async provisionOrganizationOwner(
    transaction: Prisma.TransactionClient,
    pending: PendingRegistration,
    now: Date,
  ): Promise<string> {
    if (!pending.organizationName || !pending.legalCountryCode) {
      throw new ServiceUnavailableException(
        'Organization registration data is incomplete.',
      );
    }

    const role = await transaction.role.findUnique({
      where: { code: 'ORGANIZATION_OWNER' },
      select: { id: true, isActive: true },
    });

    if (!role?.isActive) {
      throw new ServiceUnavailableException(
        'Organization registration is not ready.',
      );
    }

    const organizationPrefix =
      pending.organizationName
        .normalize('NFKD')
        .replace(/[^A-Za-z0-9]/g, '')
        .slice(0, 6)
        .toUpperCase() || 'ORG';
    const companyGroup = await transaction.companyGroup.create({
      data: {
        groupCode: `${organizationPrefix}-${this.randomSuffix(4)}`,
        groupName: pending.organizationName,
      },
    });
    const company = await transaction.company.create({
      data: {
        companyGroupId: companyGroup.id,
        companyCode: `${organizationPrefix}-HQ-${this.randomSuffix(3)}`,
        companyName: pending.organizationName,
        legalCountryCode: pending.legalCountryCode,
      },
    });
    const username = this.generateUsername(
      pending.displayName,
      pending.normalizedEmail,
    );
    const user = await transaction.user.create({
      data: {
        username,
        normalizedUsername: username.toLocaleLowerCase('en-US'),
        displayName: pending.displayName,
        email: pending.email,
        normalizedEmail: pending.normalizedEmail,
        emailVerifiedAt: now,
        passwordHash: pending.passwordHash,
        status: UserStatus.ACTIVE,
        mustChangePassword: false,
        defaultCompanyGroupId: companyGroup.id,
        defaultCompanyId: company.id,
        passwordChangedAt: now,
        lastLoginAt: now,
      },
    });

    await transaction.userRoleAssignment.create({
      data: {
        userId: user.id,
        roleId: role.id,
        scope: RoleScope.COMPANY_GROUP,
        scopeKey: `COMPANY_GROUP:${companyGroup.id}`,
        companyGroupId: companyGroup.id,
      },
    });

    await transaction.organizationOnboarding.create({
      data: {
        companyGroupId: companyGroup.id,
        ownerUserId: user.id,
        status: 'IN_PROGRESS',
        currentStep: 'ORGANIZATION',
      },
    });

    return user.id;
  }

  private async loadPending(
    registrationId: string,
  ): Promise<PendingRegistration> {
    const pending = await this.prisma.pendingRegistration.findFirst({
      where: {
        id: registrationId,
        consumedAt: null,
      },
    });

    if (!pending) {
      throw new NotFoundException('Registration challenge not found.');
    }

    return pending;
  }

  private assertMailAvailable(): void {
    if (!this.mailService.isAvailable()) {
      throw new ServiceUnavailableException(
        'Email verification is temporarily unavailable.',
      );
    }
  }

  private async enforceRateLimit(
    key: string,
    maximum: number,
    ttlSeconds: number,
  ): Promise<void> {
    const attempts = await this.redisService.incrementWithExpiry(
      key,
      ttlSeconds,
    );

    if (attempts && attempts > maximum) {
      throw new HttpException(
        'Too many requests. Please try again later.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }

  private throwResendCooldown(availableAt: Date): never {
    const retryAfterSeconds = Math.max(
      1,
      Math.ceil((availableAt.getTime() - Date.now()) / 1_000),
    );

    throw new HttpException(
      {
        message: 'Please wait before requesting another verification code.',
        retryAfterSeconds,
      },
      HttpStatus.TOO_MANY_REQUESTS,
    );
  }

  private recordSecurityEvent(
    type: SecurityEventType,
    metadata: RequestSecurityMetadata,
    eventMetadata: Record<string, unknown>,
  ): Promise<unknown> {
    return this.prisma.securityEvent.create({
      data: {
        type,
        requestId: getRequestId(),
        ipHash: this.passwordService.hashMetadata(metadata.ip),
        metadata: eventMetadata as Prisma.InputJsonValue,
      },
    });
  }

  private normalizeEmail(value: string): string {
    return value.trim().toLocaleLowerCase('en-US');
  }

  private generateCode(): string {
    return randomInt(0, 1_000_000).toString().padStart(6, '0');
  }

  private hashCode(
    type: RegistrationType,
    normalizedEmail: string,
    code: string,
  ): string {
    return this.passwordService.hashToken(
      `email-verification:${type}:${normalizedEmail}:${code}`,
    );
  }

  private hashesMatch(left: string, right: string): boolean {
    const leftBuffer = Buffer.from(left);
    const rightBuffer = Buffer.from(right);

    return (
      leftBuffer.length === rightBuffer.length &&
      timingSafeEqual(leftBuffer, rightBuffer)
    );
  }

  private generateUsername(displayName: string, normalizedEmail: string) {
    const base =
      displayName
        .normalize('NFKD')
        .toLocaleLowerCase('en-US')
        .replace(/[^a-z0-9]/g, '')
        .slice(0, 16) ||
      normalizedEmail
        .split('@')[0]
        .replace(/[^a-z0-9]/g, '')
        .slice(0, 16) ||
      'user';

    return `${base}.${randomBytes(4).toString('hex')}`;
  }

  private randomSuffix(bytes: number): string {
    return randomBytes(bytes).toString('hex').toUpperCase();
  }

  private metadataRateKey(metadata: RequestSecurityMetadata): string {
    return this.passwordService.hashMetadata(metadata.ip) ?? 'unknown';
  }

  private maskEmail(email: string): string {
    const [localPart, domain] = email.split('@');

    if (!domain) {
      return '***';
    }

    const visible = localPart.slice(0, Math.min(2, localPart.length));
    return `${visible}${'*'.repeat(Math.max(3, localPart.length - visible.length))}@${domain}`;
  }
}
