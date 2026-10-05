import {
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import { randomUUID, timingSafeEqual } from 'node:crypto';

import { Environment } from '../../config';
import { PrismaService } from '../../prisma/prisma.service';
import {
  AuthorizationSnapshot,
  CachedSession,
  RequestSecurityMetadata,
} from './auth.types';
import { PasswordService } from './password.service';
import { RedisService } from './redis.service';

@Injectable()
export class SessionService {
  private static readonly maxConcurrentPostgresFallbacks = 5;

  private readonly idleTtlSeconds: number;
  private readonly absoluteTtlSeconds: number;
  private readonly activityWriteIntervalSeconds: number;
  private postgresFallbacks = 0;
  private readonly postgresFallbackLoads = new Map<
    string,
    Promise<CachedSession>
  >();

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly passwordService: PasswordService,
    configService: ConfigService<Environment, true>,
  ) {
    this.idleTtlSeconds = configService.getOrThrow(
      'AUTH_SESSION_IDLE_TTL_SECONDS',
      { infer: true },
    );
    this.absoluteTtlSeconds = configService.getOrThrow(
      'AUTH_SESSION_ABSOLUTE_TTL_SECONDS',
      { infer: true },
    );
    this.activityWriteIntervalSeconds = configService.getOrThrow(
      'AUTH_SESSION_ACTIVITY_WRITE_INTERVAL_SECONDS',
      { infer: true },
    );
  }

  async create(
    user: {
      id: string;
      username: string;
      displayName: string | null;
      email: string | null;
      employeeId: string | null;
      mustChangePassword: boolean;
      status: string;
      securityVersion: number;
    },
    authorization: AuthorizationSnapshot,
    metadata: RequestSecurityMetadata,
  ): Promise<{ session: CachedSession; refreshToken: string }> {
    const now = new Date();
    const sessionId = randomUUID();
    const refreshToken = `${sessionId}.${this.passwordService.generateRefreshSecret()}`;
    const idleExpiresAt = new Date(now.getTime() + this.idleTtlSeconds * 1_000);
    const absoluteExpiresAt = new Date(
      now.getTime() + this.absoluteTtlSeconds * 1_000,
    );
    const created = await this.prisma.authSession.create({
      data: {
        id: sessionId,
        userId: user.id,
        refreshTokenHash: this.passwordService.hashToken(refreshToken),
        securityVersion: user.securityVersion,
        activeCompanyGroupId: authorization.activeCompanyGroupId,
        activeCompanyId: authorization.activeCompanyId,
        activeBranchId: authorization.activeBranchId,
        authorizationSnapshot:
          authorization as unknown as Prisma.InputJsonValue,
        lastActivityAt: now,
        idleExpiresAt,
        absoluteExpiresAt,
        ipHash: this.passwordService.hashMetadata(metadata.ip),
        userAgentHash: this.passwordService.hashMetadata(metadata.userAgent),
      },
      include: {
        user: true,
      },
    });
    const session = this.toCachedSession(created);

    await this.cache(session);

    return { session, refreshToken };
  }

  async getActive(sessionId: string): Promise<CachedSession> {
    const cachedValue = await this.redis.get(this.cacheKey(sessionId));
    let session: CachedSession | undefined;

    if (cachedValue) {
      try {
        session = JSON.parse(cachedValue) as CachedSession;
      } catch {
        await this.redis.delete(this.cacheKey(sessionId));
      }
    }

    if (!session) {
      session = await this.loadFromPostgres(sessionId);
    }

    this.assertActive(session);
    await this.touchIfRequired(session);

    return session;
  }

  async rotateRefreshToken(
    refreshToken: string,
  ): Promise<{ session: CachedSession; refreshToken: string }> {
    const sessionId = this.readSessionId(refreshToken);
    const suppliedHash = this.passwordService.hashToken(refreshToken);
    const durableRecord = await this.prisma.authSession.findUnique({
      where: { id: sessionId },
      include: { user: true },
    });

    if (!durableRecord) {
      throw new UnauthorizedException('The session is no longer valid.');
    }

    const session = this.toCachedSession(durableRecord);
    this.assertActive(session);

    if (!this.hashesMatch(suppliedHash, session.refreshTokenHash)) {
      await this.revoke(sessionId, 'REFRESH_TOKEN_REUSE');
      throw new UnauthorizedException('The session is no longer valid.');
    }

    const nextRefreshToken = `${sessionId}.${this.passwordService.generateRefreshSecret()}`;
    const nextRefreshTokenHash =
      this.passwordService.hashToken(nextRefreshToken);
    const now = new Date();
    const nextIdleExpiry = new Date(
      Math.min(
        now.getTime() + this.idleTtlSeconds * 1_000,
        new Date(session.absoluteExpiresAt).getTime(),
      ),
    );
    const updateResult = await this.prisma.authSession.updateMany({
      where: {
        id: sessionId,
        refreshTokenHash: suppliedHash,
        revokedAt: null,
        idleExpiresAt: { gt: now },
        absoluteExpiresAt: { gt: now },
      },
      data: {
        refreshTokenHash: nextRefreshTokenHash,
        lastActivityAt: now,
        idleExpiresAt: nextIdleExpiry,
      },
    });

    if (updateResult.count !== 1) {
      await this.revoke(sessionId, 'REFRESH_TOKEN_REUSE');
      throw new UnauthorizedException('The session is no longer valid.');
    }

    const updated = await this.prisma.authSession.findUnique({
      where: { id: sessionId },
      include: { user: true },
    });

    if (!updated) {
      throw new UnauthorizedException('The session is no longer valid.');
    }

    const cached = this.toCachedSession(updated);

    await this.cache(cached);

    return {
      session: cached,
      refreshToken: nextRefreshToken,
    };
  }

  async changeContext(
    sessionId: string,
    authorization: AuthorizationSnapshot,
  ): Promise<CachedSession> {
    const updated = await this.prisma.authSession.update({
      where: { id: sessionId },
      data: {
        activeCompanyGroupId: authorization.activeCompanyGroupId,
        activeCompanyId: authorization.activeCompanyId,
        activeBranchId: authorization.activeBranchId,
        authorizationSnapshot:
          authorization as unknown as Prisma.InputJsonValue,
      },
      include: {
        user: true,
      },
    });
    const session = this.toCachedSession(updated);

    await this.cache(session);

    return session;
  }

  async revoke(sessionId: string, reason: string): Promise<void> {
    await this.prisma.authSession.updateMany({
      where: {
        id: sessionId,
        revokedAt: null,
      },
      data: {
        revokedAt: new Date(),
        revocationReason: reason,
      },
    });
    await this.redis.delete(this.cacheKey(sessionId));
  }

  async revokeOwned(
    userId: string,
    sessionId: string,
    reason: string,
  ): Promise<boolean> {
    const result = await this.prisma.authSession.updateMany({
      where: {
        id: sessionId,
        userId,
        revokedAt: null,
      },
      data: {
        revokedAt: new Date(),
        revocationReason: reason,
      },
    });

    if (result.count > 0) {
      await this.redis.delete(this.cacheKey(sessionId));
      return true;
    }

    return false;
  }

  async revokeAll(userId: string, reason: string): Promise<void> {
    const sessionIds = await this.prisma.$transaction((tx) =>
      this.revokeAllInTransaction(tx, userId, reason),
    );

    await this.invalidateSessionIds(sessionIds);
  }

  async revokeAllInTransaction(
    tx: Prisma.TransactionClient,
    userId: string,
    reason: string,
  ): Promise<string[]> {
    const sessions = await tx.authSession.findMany({
      where: {
        userId,
        revokedAt: null,
      },
      select: { id: true },
    });

    await tx.authSession.updateMany({
      where: {
        userId,
        revokedAt: null,
      },
      data: {
        revokedAt: new Date(),
        revocationReason: reason,
      },
    });

    return sessions.map((session) => session.id);
  }

  async invalidateSessionIds(sessionIds: readonly string[]): Promise<void> {
    await Promise.all(
      sessionIds.map((sessionId) =>
        this.redis.delete(this.cacheKey(sessionId)),
      ),
    );
  }

  list(userId: string) {
    return this.prisma.authSession.findMany({
      where: {
        userId,
        revokedAt: null,
        idleExpiresAt: { gt: new Date() },
        absoluteExpiresAt: { gt: new Date() },
      },
      select: {
        id: true,
        activeCompanyGroupId: true,
        activeCompanyId: true,
        activeBranchId: true,
        lastActivityAt: true,
        idleExpiresAt: true,
        absoluteExpiresAt: true,
        revokedAt: true,
        revocationReason: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  private loadFromPostgres(sessionId: string): Promise<CachedSession> {
    const inFlightLoad = this.postgresFallbackLoads.get(sessionId);

    if (inFlightLoad) {
      return inFlightLoad;
    }

    if (
      this.postgresFallbacks >= SessionService.maxConcurrentPostgresFallbacks
    ) {
      return Promise.reject(
        new ServiceUnavailableException(
          'Authentication is temporarily busy. Please try again.',
        ),
      );
    }

    this.postgresFallbacks += 1;
    const load = this.fetchAndCacheFromPostgres(sessionId).finally(() => {
      this.postgresFallbackLoads.delete(sessionId);
      this.postgresFallbacks -= 1;
    });
    this.postgresFallbackLoads.set(sessionId, load);

    return load;
  }

  private async fetchAndCacheFromPostgres(
    sessionId: string,
  ): Promise<CachedSession> {
    const record = await this.prisma.authSession.findUnique({
      where: { id: sessionId },
      include: { user: true },
    });

    if (!record) {
      throw new UnauthorizedException('The session is no longer valid.');
    }

    const session = this.toCachedSession(record);
    await this.cache(session);
    return session;
  }

  private async touchIfRequired(session: CachedSession): Promise<void> {
    const now = Date.now();
    const lastActivity = new Date(session.lastActivityAt).getTime();

    if (now - lastActivity < this.activityWriteIntervalSeconds * 1_000) {
      return;
    }

    const nextIdleExpiry = new Date(
      Math.min(
        now + this.idleTtlSeconds * 1_000,
        new Date(session.absoluteExpiresAt).getTime(),
      ),
    );
    const updated = await this.prisma.authSession.update({
      where: { id: session.id },
      data: {
        lastActivityAt: new Date(now),
        idleExpiresAt: nextIdleExpiry,
      },
      include: { user: true },
    });

    await this.cache(this.toCachedSession(updated));
  }

  private assertActive(session: CachedSession): void {
    const now = Date.now();

    if (
      session.revokedAt ||
      session.userStatus !== 'ACTIVE' ||
      new Date(session.idleExpiresAt).getTime() <= now ||
      new Date(session.absoluteExpiresAt).getTime() <= now
    ) {
      throw new UnauthorizedException('The session is no longer valid.');
    }
  }

  private readSessionId(refreshToken: string): string {
    const separator = refreshToken.indexOf('.');
    const sessionId = separator > 0 ? refreshToken.slice(0, separator) : '';

    if (!/^[0-9a-f-]{36}$/i.test(sessionId)) {
      throw new UnauthorizedException('The session is no longer valid.');
    }

    return sessionId;
  }

  private hashesMatch(left: string, right: string): boolean {
    const leftBuffer = Buffer.from(left);
    const rightBuffer = Buffer.from(right);

    return (
      leftBuffer.length === rightBuffer.length &&
      timingSafeEqual(leftBuffer, rightBuffer)
    );
  }

  private cache(session: CachedSession): Promise<void> {
    return this.redis.set(this.cacheKey(session.id), JSON.stringify(session));
  }

  private cacheKey(sessionId: string): string {
    return `auth:session:${sessionId}`;
  }

  private toCachedSession(record: {
    id: string;
    userId: string;
    refreshTokenHash: string;
    securityVersion: number;
    authorizationSnapshot: Prisma.JsonValue;
    lastActivityAt: Date;
    idleExpiresAt: Date;
    absoluteExpiresAt: Date;
    revokedAt: Date | null;
    user: {
      username: string;
      displayName: string | null;
      email: string | null;
      employeeId: string | null;
      mustChangePassword: boolean;
      status: string;
      securityVersion: number;
    };
  }): CachedSession {
    if (record.securityVersion !== record.user.securityVersion) {
      throw new UnauthorizedException('The session is no longer valid.');
    }

    return {
      id: record.id,
      userId: record.userId,
      username: record.user.username,
      displayName: record.user.displayName ?? undefined,
      email: record.user.email ?? undefined,
      employeeId: record.user.employeeId ?? undefined,
      mustChangePassword: record.user.mustChangePassword,
      userStatus: record.user.status,
      securityVersion: record.securityVersion,
      refreshTokenHash: record.refreshTokenHash,
      authorization:
        record.authorizationSnapshot as unknown as AuthorizationSnapshot,
      lastActivityAt: record.lastActivityAt.toISOString(),
      idleExpiresAt: record.idleExpiresAt.toISOString(),
      absoluteExpiresAt: record.absoluteExpiresAt.toISOString(),
      revokedAt: record.revokedAt?.toISOString(),
    };
  }
}
