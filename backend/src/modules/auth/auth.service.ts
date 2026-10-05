import {
  Injectable,
  HttpException,
  HttpStatus,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Prisma, SecurityEventType, UserStatus } from '@prisma/client';

import { getRequestId } from '../../common';
import { Environment } from '../../config';
import { PrismaService } from '../../prisma/prisma.service';
import {
  AccessTokenPayload,
  CachedSession,
  OrganizationScopeSelection,
  RequestSecurityMetadata,
} from './auth.types';
import { AuthorizationService } from './authorization.service';
import { PasswordService } from './password.service';
import { RedisService } from './redis.service';
import { SessionService } from './session.service';

@Injectable()
export class AuthService {
  private readonly accessTokenTtlSeconds: number;
  private dummyHash?: Promise<string>;

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly authorizationService: AuthorizationService,
    private readonly passwordService: PasswordService,
    private readonly redisService: RedisService,
    private readonly sessionService: SessionService,
    configService: ConfigService<Environment, true>,
  ) {
    this.accessTokenTtlSeconds = configService.getOrThrow(
      'AUTH_ACCESS_TOKEN_TTL_SECONDS',
      { infer: true },
    );
  }

  async login(
    identifier: string,
    password: string,
    metadata: RequestSecurityMetadata,
    scope?: OrganizationScopeSelection,
  ) {
    const normalizedIdentifier = this.normalizeIdentifier(identifier);
    await this.enforceLoginRateLimit(normalizedIdentifier, metadata);

    const user = await this.prisma.user.findFirst({
      where: {
        OR: [
          { normalizedUsername: normalizedIdentifier },
          { normalizedEmail: normalizedIdentifier },
        ],
      },
    });

    if (!user) {
      await this.passwordService.verifyPassword(
        await this.getDummyHash(),
        password,
      );
      await this.recordSecurityEvent(
        SecurityEventType.LOGIN_FAILED,
        metadata,
        undefined,
        { reason: 'INVALID_CREDENTIALS' },
      );
      throw this.invalidCredentials();
    }

    if (
      user.status === UserStatus.INVITED ||
      user.status === UserStatus.LOCKED ||
      user.status === UserStatus.DISABLED ||
      !user.passwordHash ||
      (user.lockedUntil && user.lockedUntil.getTime() > Date.now())
    ) {
      await this.recordSecurityEvent(
        SecurityEventType.LOGIN_FAILED,
        metadata,
        user.id,
        { reason: 'ACCOUNT_UNAVAILABLE' },
      );
      throw this.invalidCredentials();
    }

    const passwordMatches = await this.passwordService.verifyPassword(
      user.passwordHash,
      password,
    );

    if (!passwordMatches) {
      await this.handleFailedLogin(user.id, user.failedLoginAttempts, metadata);
      throw this.invalidCredentials();
    }

    const authorization = await this.authorizationService.buildSnapshot(
      user.id,
      scope?.companyId,
      scope?.branchId,
      scope?.companyGroupId,
    );
    const activeUser = await this.prisma.user.update({
      where: { id: user.id },
      data: {
        failedLoginAttempts: 0,
        lockedUntil: null,
        status: UserStatus.ACTIVE,
        lastLoginAt: new Date(),
      },
    });
    const { session, refreshToken } = await this.sessionService.create(
      activeUser,
      authorization,
      metadata,
    );

    await this.recordSecurityEvent(
      SecurityEventType.LOGIN_SUCCEEDED,
      metadata,
      user.id,
      undefined,
      session.id,
    );

    return {
      ...this.buildAuthResponse(session),
      refreshToken,
    };
  }

  async refresh(refreshToken: string, metadata: RequestSecurityMetadata) {
    const rotated = await this.sessionService.rotateRefreshToken(refreshToken);
    await this.recordSecurityEvent(
      SecurityEventType.SESSION_REFRESHED,
      metadata,
      rotated.session.userId,
      undefined,
      rotated.session.id,
    );

    return {
      ...this.buildAuthResponse(rotated.session),
      refreshToken: rotated.refreshToken,
    };
  }

  async createAuthenticatedSession(
    userId: string,
    metadata: RequestSecurityMetadata,
    scope?: OrganizationScopeSelection,
  ) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user || user.status !== UserStatus.ACTIVE) {
      throw new UnauthorizedException('The account is unavailable.');
    }

    const authorization = await this.authorizationService.buildSnapshot(
      user.id,
      scope?.companyId,
      scope?.branchId,
      scope?.companyGroupId,
    );
    const { session, refreshToken } = await this.sessionService.create(
      user,
      authorization,
      metadata,
    );

    return {
      ...this.buildAuthResponse(session),
      refreshToken,
    };
  }

  async changePassword(
    session: CachedSession,
    currentPassword: string,
    newPassword: string,
    metadata: RequestSecurityMetadata,
  ) {
    const user = await this.prisma.user.findUnique({
      where: { id: session.userId },
    });

    if (
      !user ||
      !user.passwordHash ||
      !(await this.passwordService.verifyPassword(
        user.passwordHash,
        currentPassword,
      ))
    ) {
      throw new UnauthorizedException('The current password is incorrect.');
    }

    const passwordHash = await this.passwordService.hashPassword(newPassword, {
      email: user.email,
      username: user.username,
    });
    const updatedUser = await this.prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash,
        mustChangePassword: false,
        passwordChangedAt: new Date(),
        securityVersion: { increment: 1 },
      },
    });
    await this.sessionService.revokeAll(user.id, 'PASSWORD_CHANGED');
    const authorization = await this.authorizationService.buildSnapshot(
      user.id,
      session.authorization.activeCompanyId,
      session.authorization.activeBranchId,
      session.authorization.activeCompanyGroupId,
    );
    const replacement = await this.sessionService.create(
      updatedUser,
      authorization,
      metadata,
    );

    await this.recordSecurityEvent(
      SecurityEventType.PASSWORD_CHANGED,
      metadata,
      user.id,
      undefined,
      replacement.session.id,
    );

    return {
      ...this.buildAuthResponse(replacement.session),
      refreshToken: replacement.refreshToken,
    };
  }

  async changeContext(
    session: CachedSession,
    companyId: string | undefined,
    branchId: string | undefined,
    companyGroupId: string | undefined,
    metadata: RequestSecurityMetadata,
  ) {
    const authorization = await this.authorizationService.buildSnapshot(
      session.userId,
      companyId,
      branchId,
      companyGroupId,
    );
    const updated = await this.sessionService.changeContext(
      session.id,
      authorization,
    );

    await this.recordSecurityEvent(
      SecurityEventType.CONTEXT_CHANGED,
      metadata,
      session.userId,
      {
        companyGroupId: authorization.activeCompanyGroupId ?? null,
        companyId: authorization.activeCompanyId ?? null,
        branchId: authorization.activeBranchId ?? null,
      },
      session.id,
    );

    return this.buildAuthResponse(updated);
  }

  async logout(
    userId: string,
    sessionId: string,
    metadata: RequestSecurityMetadata,
  ): Promise<void> {
    await this.sessionService.revokeOwned(userId, sessionId, 'USER_LOGOUT');
    await this.recordSecurityEvent(
      SecurityEventType.SESSION_REVOKED,
      metadata,
      userId,
      { reason: 'USER_LOGOUT' },
      sessionId,
    );
  }

  async logoutAll(
    userId: string,
    metadata: RequestSecurityMetadata,
  ): Promise<void> {
    await this.sessionService.revokeAll(userId, 'USER_LOGOUT_ALL');
    await this.recordSecurityEvent(
      SecurityEventType.SESSION_REVOKED,
      metadata,
      userId,
      { reason: 'USER_LOGOUT_ALL' },
    );
  }

  async revokeOwnSession(
    userId: string,
    sessionId: string,
    metadata: RequestSecurityMetadata,
  ): Promise<void> {
    const revoked = await this.sessionService.revokeOwned(
      userId,
      sessionId,
      'USER_REVOKED',
    );

    if (!revoked) {
      throw new NotFoundException('Session not found.');
    }

    await this.recordSecurityEvent(
      SecurityEventType.SESSION_REVOKED,
      metadata,
      userId,
      { reason: 'USER_REVOKED' },
      sessionId,
    );
  }

  private async handleFailedLogin(
    userId: string,
    previousAttempts: number,
    metadata: RequestSecurityMetadata,
  ): Promise<void> {
    const attempts = previousAttempts + 1;
    const shouldLock = attempts >= 5;

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        failedLoginAttempts: attempts,
        ...(shouldLock
          ? {
              status: UserStatus.LOCKED,
              lockedUntil: new Date(Date.now() + 15 * 60 * 1_000),
            }
          : {}),
      },
    });
    await this.recordSecurityEvent(
      shouldLock
        ? SecurityEventType.ACCOUNT_LOCKED
        : SecurityEventType.LOGIN_FAILED,
      metadata,
      userId,
      { attempts },
    );
  }

  private async enforceLoginRateLimit(
    identifier: string,
    metadata: RequestSecurityMetadata,
  ): Promise<void> {
    const identityHash = this.passwordService.hashToken(identifier);
    const ipHash = this.passwordService.hashMetadata(metadata.ip) ?? 'unknown';
    const attempts = await this.redisService.incrementWithExpiry(
      `auth:login:${identityHash}:${ipHash}`,
      15 * 60,
    );

    if (attempts && attempts > 10) {
      throw new HttpException(
        'Too many sign-in attempts. Please try again later.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }

  private buildAuthResponse(session: CachedSession) {
    const payload: AccessTokenPayload = {
      sub: session.userId,
      sid: session.id,
      ver: session.securityVersion,
      type: 'access',
    };

    return {
      accessToken: this.jwtService.sign(payload, {
        expiresIn: this.accessTokenTtlSeconds,
      }),
      expiresIn: this.accessTokenTtlSeconds,
      user: {
        id: session.userId,
        username: session.username,
        displayName: session.displayName,
        email: session.email,
        employeeId: session.employeeId,
        mustChangePassword: session.mustChangePassword,
        sessionId: session.id,
        authorization: session.authorization,
      },
    };
  }

  private async recordSecurityEvent(
    type: SecurityEventType,
    metadata: RequestSecurityMetadata,
    userId?: string,
    eventMetadata?: Record<string, unknown>,
    sessionId?: string,
  ): Promise<void> {
    await this.prisma.securityEvent.create({
      data: {
        type,
        userId,
        sessionId,
        requestId: getRequestId(),
        ipHash: this.passwordService.hashMetadata(metadata.ip),
        metadata: eventMetadata as unknown as Prisma.InputJsonValue | undefined,
      },
    });
  }

  private normalizeIdentifier(value: string): string {
    return value.trim().toLocaleLowerCase('en-US');
  }

  private invalidCredentials(): UnauthorizedException {
    return new UnauthorizedException('Invalid username, email, or password.');
  }

  private getDummyHash(): Promise<string> {
    this.dummyHash ??= this.passwordService.hashPassword(
      'Invalid-login-value-2026!',
    );
    return this.dummyHash;
  }
}
