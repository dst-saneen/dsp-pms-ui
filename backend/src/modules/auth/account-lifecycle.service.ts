import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SecurityEventType, UserStatus } from '@prisma/client';
import { randomBytes } from 'node:crypto';

import { getRequestId } from '../../common';
import { Environment } from '../../config';
import { TransactionalMailService } from '../mail/transactional-mail.service';
import { PrismaService } from '../../prisma/prisma.service';
import { PasswordService } from './password.service';
import { RedisService } from './redis.service';
import type { RequestSecurityMetadata } from './auth.types';
import type { OrganizationScopeSelection } from './auth.types';
import { SessionService } from './session.service';
import { AuthService } from './auth.service';
import { AuthorizationService } from './authorization.service';

export interface PreparedInvitation {
  token: string;
  tokenHash: string;
  expiresAt: Date;
  resendAvailableAt: Date;
}

@Injectable()
export class AccountLifecycleService {
  private readonly frontendUrl: string;
  private readonly nodeEnvironment: Environment['NODE_ENV'];
  private readonly invitationTtlSeconds: number;
  private readonly resetTtlSeconds: number;
  private readonly resendCooldownSeconds: number;

  constructor(
    private readonly prisma: PrismaService,
    private readonly passwordService: PasswordService,
    private readonly mailService: TransactionalMailService,
    private readonly redisService: RedisService,
    private readonly sessionService: SessionService,
    private readonly authService: AuthService,
    private readonly authorizationService: AuthorizationService,
    configService: ConfigService<Environment, true>,
  ) {
    this.frontendUrl = configService.getOrThrow('FRONTEND_URL', {
      infer: true,
    });
    this.nodeEnvironment = configService.getOrThrow('NODE_ENV', {
      infer: true,
    });
    this.invitationTtlSeconds = configService.getOrThrow(
      'AUTH_INVITATION_TTL_SECONDS',
      { infer: true },
    );
    this.resetTtlSeconds = configService.getOrThrow(
      'AUTH_PASSWORD_RESET_TTL_SECONDS',
      { infer: true },
    );
    this.resendCooldownSeconds = configService.getOrThrow(
      'AUTH_ACTION_RESEND_COOLDOWN_SECONDS',
      { infer: true },
    );
  }

  prepareInvitation(now = new Date()): PreparedInvitation {
    const token = randomBytes(32).toString('base64url');

    return {
      token,
      tokenHash: this.hashInvitationToken(token),
      expiresAt: new Date(now.getTime() + this.invitationTtlSeconds * 1_000),
      resendAvailableAt: new Date(
        now.getTime() + this.resendCooldownSeconds * 1_000,
      ),
    };
  }

  async deliverInvitation(input: {
    invitationId: string;
    email: string;
    displayName: string;
    token: string;
    expiresAt: Date;
    resendAvailableAt: Date;
  }) {
    const deliveryStatus = await this.mailService.sendInvitationLink({
      to: input.email,
      displayName: input.displayName,
      invitationUrl: this.actionUrl('/accept-invitation', input.token),
      expiresInHours: Math.ceil(this.invitationTtlSeconds / 3_600),
      clientReference: input.invitationId,
    });

    await this.prisma.userInvitation.update({
      where: { id: input.invitationId },
      data: { sentAt: new Date() },
    });

    return {
      deliveryStatus,
      expiresAt: input.expiresAt,
      resendAvailableAt: input.resendAvailableAt,
      ...(this.canExposeDevelopmentToken()
        ? {
            developmentActionUrl: this.actionUrl(
              '/accept-invitation',
              input.token,
            ),
          }
        : {}),
    };
  }

  async inspectInvitation(token: string) {
    const invitation = await this.findValidInvitation(token);
    const availableScopes = await this.authorizationService.getAvailableScopes(
      invitation.userId,
    );
    const hasUsableDefault = availableScopes.some((scope) => {
      if (invitation.user.defaultBranchId) {
        return scope.branchId === invitation.user.defaultBranchId;
      }

      if (invitation.user.defaultCompanyId) {
        return (
          scope.companyId === invitation.user.defaultCompanyId &&
          (!invitation.user.defaultCompanyGroupId ||
            scope.companyGroupId === invitation.user.defaultCompanyGroupId)
        );
      }

      return Boolean(
        invitation.user.defaultCompanyGroupId &&
        scope.scope === 'COMPANY_GROUP' &&
        scope.companyGroupId === invitation.user.defaultCompanyGroupId,
      );
    });
    const scopeSelectionRequired =
      !hasUsableDefault &&
      !availableScopes.some((scope) => scope.scope === 'GLOBAL') &&
      availableScopes.length > 1;

    return {
      status: 'VALID' as const,
      displayName: invitation.user.displayName ?? invitation.user.username,
      maskedEmail: this.maskEmail(invitation.email),
      expiresAt: invitation.expiresAt,
      passwordPolicy: {
        minimumLength: 12,
        maximumLength: 128,
        mustDifferFromEmailOrUsername: true,
      },
      ...(scopeSelectionRequired
        ? {
            scopeSelectionRequired: true as const,
            availableScopes,
          }
        : {}),
    };
  }

  async acceptInvitation(
    token: string,
    password: string,
    metadata: RequestSecurityMetadata,
    scope?: OrganizationScopeSelection,
  ) {
    const invitation = await this.findValidInvitation(token);
    const selectedScope = this.normalizeScopeSelection(scope);
    await this.authorizationService.buildSnapshot(
      invitation.userId,
      selectedScope?.companyId,
      selectedScope?.branchId,
      selectedScope?.companyGroupId,
    );
    const passwordHash = await this.passwordService.hashPassword(password, {
      email: invitation.email,
      username: invitation.user.username,
    });
    const now = new Date();

    const sessionIds = await this.prisma.$transaction(async (transaction) => {
      const consumed = await transaction.userInvitation.updateMany({
        where: {
          id: invitation.id,
          tokenHash: invitation.tokenHash,
          consumedAt: null,
          revokedAt: null,
          expiresAt: { gt: now },
        },
        data: { consumedAt: now, tokenCiphertext: null },
      });

      if (consumed.count !== 1) {
        throw new BadRequestException({
          code: 'INVITATION_CONSUMED',
          message:
            'This invitation is no longer valid. Request a new invitation.',
        });
      }

      const activated = await transaction.user.updateMany({
        where: {
          id: invitation.userId,
          status: UserStatus.INVITED,
        },
        data: {
          passwordHash,
          status: UserStatus.ACTIVE,
          mustChangePassword: false,
          emailVerifiedAt: now,
          passwordChangedAt: now,
          failedLoginAttempts: 0,
          lockedUntil: null,
          securityVersion: { increment: 1 },
        },
      });

      if (activated.count !== 1) {
        throw new BadRequestException({
          code: 'INVITATION_CONSUMED',
          message:
            'This invitation is no longer valid. Request a new invitation.',
        });
      }

      await transaction.userInvitation.updateMany({
        where: {
          userId: invitation.userId,
          id: { not: invitation.id },
          consumedAt: null,
          revokedAt: null,
        },
        data: { revokedAt: now },
      });

      await transaction.securityEvent.create({
        data: {
          userId: invitation.userId,
          type: SecurityEventType.INVITATION_ACCEPTED,
          requestId: getRequestId(),
          ipHash: this.passwordService.hashMetadata(metadata.ip),
          metadata: {
            invitationId: invitation.id,
          },
        },
      });
      return this.sessionService.revokeAllInTransaction(
        transaction,
        invitation.userId,
        'INVITATION_ACCEPTED',
      );
    });

    await this.sessionService.invalidateSessionIds(sessionIds);

    return selectedScope
      ? this.authService.createAuthenticatedSession(
          invitation.userId,
          metadata,
          selectedScope,
        )
      : this.authService.createAuthenticatedSession(
          invitation.userId,
          metadata,
        );
  }

  async resendInvitation(
    userId: string,
    invitedByUserId: string,
    metadata: RequestSecurityMetadata,
  ) {
    await this.enforceRateLimit(
      `auth:invitation:resend:${userId}:${this.metadataRateKey(metadata)}`,
      10,
      3_600,
    );

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        status: true,
        email: true,
        normalizedEmail: true,
        displayName: true,
        username: true,
        defaultCompanyGroupId: true,
        defaultCompany: {
          select: { companyGroupId: true },
        },
        invitations: {
          where: { consumedAt: null, revokedAt: null },
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: { resendAvailableAt: true },
        },
      },
    });

    if (
      !user ||
      user.status !== UserStatus.INVITED ||
      !user.email ||
      !user.normalizedEmail
    ) {
      throw new BadRequestException(
        'Only a pending invited user can receive another invitation.',
      );
    }

    const now = new Date();
    const latest = user.invitations[0];

    if (latest && latest.resendAvailableAt.getTime() > now.getTime()) {
      this.throwResendCooldown(latest.resendAvailableAt);
    }

    const prepared = this.prepareInvitation(now);
    const companyGroupId =
      user.defaultCompanyGroupId ??
      user.defaultCompany?.companyGroupId ??
      undefined;
    const invitation = await this.prisma.$transaction(async (transaction) => {
      await transaction.userInvitation.updateMany({
        where: {
          userId,
          consumedAt: null,
          revokedAt: null,
        },
        data: { revokedAt: now },
      });

      const created = await transaction.userInvitation.create({
        data: {
          userId,
          companyGroupId,
          invitedByUserId,
          email: user.email!,
          normalizedEmail: user.normalizedEmail!,
          tokenHash: prepared.tokenHash,
          expiresAt: prepared.expiresAt,
          resendAvailableAt: prepared.resendAvailableAt,
          ipHash: this.passwordService.hashMetadata(metadata.ip),
          userAgentHash: this.passwordService.hashMetadata(metadata.userAgent),
        },
      });

      await transaction.securityEvent.create({
        data: {
          userId,
          type: SecurityEventType.INVITATION_RESENT,
          requestId: getRequestId(),
          ipHash: this.passwordService.hashMetadata(metadata.ip),
          metadata: { invitationId: created.id },
        },
      });

      return created;
    });

    return this.deliverInvitation({
      invitationId: invitation.id,
      email: user.email,
      displayName: user.displayName ?? user.username,
      token: prepared.token,
      expiresAt: prepared.expiresAt,
      resendAvailableAt: prepared.resendAvailableAt,
    });
  }

  async requestPasswordReset(email: string, metadata: RequestSecurityMetadata) {
    const normalizedEmail = this.normalize(email);
    await this.enforceRateLimit(
      `auth:password:forgot:${this.passwordService.hashToken(
        normalizedEmail,
      )}:${this.metadataRateKey(metadata)}`,
      5,
      15 * 60,
    );

    const user = await this.prisma.user.findUnique({
      where: { normalizedEmail },
      select: {
        id: true,
        email: true,
        displayName: true,
        username: true,
        status: true,
        passwordHash: true,
      },
    });

    if (
      !user ||
      !user.email ||
      !user.passwordHash ||
      (user.status !== UserStatus.ACTIVE && user.status !== UserStatus.LOCKED)
    ) {
      return this.passwordResetAccepted();
    }

    const token = randomBytes(32).toString('base64url');
    const now = new Date();
    const challenge = await this.prisma.$transaction(async (transaction) => {
      await transaction.passwordResetChallenge.updateMany({
        where: {
          userId: user.id,
          consumedAt: null,
          revokedAt: null,
        },
        data: { revokedAt: now },
      });

      const created = await transaction.passwordResetChallenge.create({
        data: {
          userId: user.id,
          tokenHash: this.hashResetToken(token),
          expiresAt: new Date(now.getTime() + this.resetTtlSeconds * 1_000),
          ipHash: this.passwordService.hashMetadata(metadata.ip),
          userAgentHash: this.passwordService.hashMetadata(metadata.userAgent),
        },
      });

      await transaction.securityEvent.create({
        data: {
          userId: user.id,
          type: SecurityEventType.PASSWORD_RESET_REQUESTED,
          requestId: getRequestId(),
          ipHash: this.passwordService.hashMetadata(metadata.ip),
          metadata: { challengeId: created.id },
        },
      });

      return created;
    });

    try {
      await this.mailService.sendPasswordResetLink({
        to: user.email,
        displayName: user.displayName ?? user.username,
        resetUrl: this.actionUrl('/reset-password', token),
        expiresInMinutes: Math.ceil(this.resetTtlSeconds / 60),
        clientReference: challenge.id,
      });
    } catch {
      // Keep the public response enumeration-safe. A retry creates a new token.
    }

    return {
      ...this.passwordResetAccepted(),
      ...(this.canExposeDevelopmentToken()
        ? {
            developmentActionUrl: this.actionUrl('/reset-password', token),
          }
        : {}),
    };
  }

  async resetPassword(
    token: string,
    password: string,
    metadata: RequestSecurityMetadata,
  ) {
    const tokenHash = this.hashResetToken(token);
    const challenge = await this.prisma.passwordResetChallenge.findUnique({
      where: { tokenHash },
      select: {
        id: true,
        userId: true,
        expiresAt: true,
        consumedAt: true,
        revokedAt: true,
      },
    });
    const now = new Date();

    if (!challenge || challenge.revokedAt) {
      throw new BadRequestException({
        code: 'RESET_TOKEN_INVALID',
        message: 'This password reset link is invalid.',
      });
    }

    if (challenge.consumedAt) {
      throw new BadRequestException({
        code: 'RESET_TOKEN_CONSUMED',
        message: 'This password reset link has already been used.',
      });
    }

    if (challenge.expiresAt.getTime() <= now.getTime()) {
      throw new BadRequestException({
        code: 'RESET_TOKEN_EXPIRED',
        message: 'This password reset link has expired.',
      });
    }

    const user = await this.prisma.user.findUnique({
      where: { id: challenge.userId },
      select: { email: true, username: true },
    });

    const passwordHash = await this.passwordService.hashPassword(password, {
      email: user?.email,
      username: user?.username,
    });

    const sessionIds = await this.prisma.$transaction(async (transaction) => {
      const consumed = await transaction.passwordResetChallenge.updateMany({
        where: {
          id: challenge.id,
          tokenHash,
          consumedAt: null,
          revokedAt: null,
          expiresAt: { gt: now },
        },
        data: { consumedAt: now },
      });

      if (consumed.count !== 1) {
        throw new BadRequestException({
          code: 'RESET_TOKEN_CONSUMED',
          message: 'This password reset link has already been used.',
        });
      }

      await transaction.user.update({
        where: { id: challenge.userId },
        data: {
          passwordHash,
          status: UserStatus.ACTIVE,
          mustChangePassword: false,
          failedLoginAttempts: 0,
          lockedUntil: null,
          passwordChangedAt: now,
          securityVersion: { increment: 1 },
        },
      });

      await transaction.passwordResetChallenge.updateMany({
        where: {
          userId: challenge.userId,
          id: { not: challenge.id },
          consumedAt: null,
          revokedAt: null,
        },
        data: { revokedAt: now },
      });

      await transaction.securityEvent.create({
        data: {
          userId: challenge.userId,
          type: SecurityEventType.PASSWORD_RESET_COMPLETED,
          requestId: getRequestId(),
          ipHash: this.passwordService.hashMetadata(metadata.ip),
          metadata: { challengeId: challenge.id },
        },
      });
      return this.sessionService.revokeAllInTransaction(
        transaction,
        challenge.userId,
        'PASSWORD_RESET_COMPLETED',
      );
    });

    await this.sessionService.invalidateSessionIds(sessionIds);

    return { reset: true };
  }

  private async findValidInvitation(token: string) {
    const invitation = await this.prisma.userInvitation.findUnique({
      where: { tokenHash: this.hashInvitationToken(token) },
      include: {
        user: {
          select: {
            username: true,
            displayName: true,
            status: true,
            defaultCompanyGroupId: true,
            defaultCompanyId: true,
            defaultBranchId: true,
          },
        },
      },
    });

    if (
      !invitation ||
      invitation.revokedAt ||
      invitation.user.status !== UserStatus.INVITED
    ) {
      throw new NotFoundException({
        code: 'INVITATION_INVALID',
        message: 'This invitation is invalid.',
      });
    }

    if (invitation.consumedAt) {
      throw new BadRequestException({
        code: 'INVITATION_CONSUMED',
        message: 'This invitation has already been used.',
      });
    }

    if (invitation.expiresAt.getTime() <= Date.now()) {
      throw new BadRequestException({
        code: 'INVITATION_EXPIRED',
        message: 'This invitation has expired. Request a new invitation.',
      });
    }

    return invitation;
  }

  private hashInvitationToken(token: string): string {
    return this.passwordService.hashActionToken('invitation', token);
  }

  private normalizeScopeSelection(
    scope?: OrganizationScopeSelection,
  ): OrganizationScopeSelection | undefined {
    if (!scope?.companyGroupId && !scope?.companyId && !scope?.branchId) {
      return undefined;
    }

    return scope;
  }

  private hashResetToken(token: string): string {
    return this.passwordService.hashActionToken('password-reset', token);
  }

  private actionUrl(path: string, token: string): string {
    const url = new URL(path, this.frontendUrl);
    url.searchParams.set('token', token);
    return url.toString();
  }

  private passwordResetAccepted() {
    return {
      accepted: true,
      message:
        'If an eligible account exists, password reset instructions will be sent.',
    };
  }

  private canExposeDevelopmentToken(): boolean {
    return (
      this.nodeEnvironment !== 'production' &&
      this.mailService.isDevelopmentBypass()
    );
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
        code: 'INVITATION_RESEND_COOLDOWN',
        message: 'Please wait before requesting another invitation.',
        retryAfterSeconds,
      },
      HttpStatus.TOO_MANY_REQUESTS,
    );
  }

  private metadataRateKey(metadata: RequestSecurityMetadata): string {
    return this.passwordService.hashMetadata(metadata.ip) ?? 'unknown';
  }

  private normalize(value: string): string {
    return value.trim().toLocaleLowerCase('en-US');
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
