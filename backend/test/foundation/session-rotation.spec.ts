import {
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';

import { SessionService } from '../../src/modules/auth/session.service';

const sessionId = '11111111-1111-4111-8111-111111111111';
const oldRefreshToken = `${sessionId}.old-secret`;

const durableSession = (refreshTokenHash: string, id = sessionId) => ({
  id,
  userId: 'user-1',
  refreshTokenHash,
  securityVersion: 1,
  authorizationSnapshot: {
    roles: ['EMPLOYEE'],
    permissions: ['dashboard.read'],
    scopeLevel: 'COMPANY',
    isGlobal: false,
    activeCompanyGroupId: 'group-a',
    activeCompanyId: 'company-a',
    availableScopes: [],
  },
  lastActivityAt: new Date(),
  idleExpiresAt: new Date(Date.now() + 60_000),
  absoluteExpiresAt: new Date(Date.now() + 120_000),
  revokedAt: null,
  user: {
    username: 'employee',
    displayName: 'Employee User',
    email: 'employee@example.com',
    employeeId: 'employee-1',
    mustChangePassword: false,
    status: 'ACTIVE',
    securityVersion: 1,
  },
});

const config = {
  getOrThrow: jest.fn((key: string) => {
    const values: Record<string, number> = {
      AUTH_SESSION_IDLE_TTL_SECONDS: 1_800,
      AUTH_SESSION_ABSOLUTE_TTL_SECONDS: 43_200,
      AUTH_SESSION_ACTIVITY_WRITE_INTERVAL_SECONDS: 300,
    };

    return values[key];
  }),
};

const createDeferred = <T>() => {
  let resolvePromise: (value: T | PromiseLike<T>) => void = () => undefined;
  let rejectPromise: (reason?: unknown) => void = () => undefined;
  const promise = new Promise<T>((resolve, reject) => {
    resolvePromise = resolve;
    rejectPromise = reject;
  });

  return {
    promise,
    resolve: resolvePromise,
    reject: rejectPromise,
  };
};

describe('SessionService refresh rotation', () => {
  it('persists the active Company Group in the durable session', async () => {
    const authorization = durableSession('hash-new')
      .authorizationSnapshot as never;
    const user = {
      id: 'user-1',
      username: 'employee',
      displayName: 'Employee User',
      email: 'employee@example.com',
      employeeId: 'employee-1',
      mustChangePassword: false,
      status: 'ACTIVE',
      securityVersion: 1,
    };
    const createSession = jest.fn(
      ({ data }: { data: Record<string, unknown> }) =>
        Promise.resolve({
          ...data,
          createdAt: new Date(),
          updatedAt: new Date(),
          user,
        }),
    );
    const prisma = {
      authSession: {
        create: createSession,
      },
    };
    const redis = {
      set: jest.fn().mockResolvedValue(undefined),
    };
    const passwords = {
      generateRefreshSecret: jest.fn().mockReturnValue('new-secret'),
      hashToken: jest.fn().mockReturnValue('refresh-hash'),
      hashMetadata: jest.fn().mockReturnValue('metadata-hash'),
    };
    const service = new SessionService(
      prisma as never,
      redis as never,
      passwords as never,
      config as never,
    );

    const result = await service.create(user, authorization, {
      ip: '127.0.0.1',
    });

    expect(createSession.mock.calls[0]?.[0].data).toMatchObject({
      activeCompanyGroupId: 'group-a',
      activeCompanyId: 'company-a',
    });
    expect(result.session.authorization.activeCompanyGroupId).toBe('group-a');
  });

  it('revokes the session when an old or invalid refresh token is reused', async () => {
    const prisma = {
      authSession: {
        findUnique: jest.fn().mockResolvedValue(durableSession('stored-hash')),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
    };
    const redis = {
      delete: jest.fn().mockResolvedValue(undefined),
    };
    const passwords = {
      hashToken: jest.fn().mockReturnValue('supplied-hash'),
    };
    const service = new SessionService(
      prisma as never,
      redis as never,
      passwords as never,
      config as never,
    );

    await expect(
      service.rotateRefreshToken(oldRefreshToken),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(prisma.authSession.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        // Jest asymmetric matchers are typed as any by @types/jest.
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        data: expect.objectContaining({
          revocationReason: 'REFRESH_TOKEN_REUSE',
        }),
      }),
    );
    expect(redis.delete).toHaveBeenCalledWith(`auth:session:${sessionId}`);
  });

  it('atomically replaces a valid refresh token', async () => {
    const updated = durableSession('hash-new');
    const prisma = {
      authSession: {
        findUnique: jest
          .fn()
          .mockResolvedValueOnce(durableSession('hash-old'))
          .mockResolvedValueOnce(updated),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
    };
    const redis = {
      set: jest.fn().mockResolvedValue(undefined),
    };
    const passwords = {
      generateRefreshSecret: jest.fn().mockReturnValue('new-secret'),
      hashToken: jest.fn((value: string) =>
        value === oldRefreshToken ? 'hash-old' : 'hash-new',
      ),
    };
    const service = new SessionService(
      prisma as never,
      redis as never,
      passwords as never,
      config as never,
    );

    const result = await service.rotateRefreshToken(oldRefreshToken);

    expect(result.refreshToken).toBe(`${sessionId}.new-secret`);
    expect(prisma.authSession.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        where: expect.objectContaining({
          id: sessionId,
          refreshTokenHash: 'hash-old',
          revokedAt: null,
        }),
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        data: expect.objectContaining({
          refreshTokenHash: 'hash-new',
        }),
      }),
    );
    expect(redis.set).toHaveBeenCalledWith(
      `auth:session:${sessionId}`,
      expect.any(String),
    );
  });
});

describe('SessionService PostgreSQL fallback', () => {
  it('coalesces more than five concurrent cache misses for the same session', async () => {
    const postgresLoad = createDeferred<ReturnType<typeof durableSession>>();
    const loadStarted = createDeferred<void>();
    const findUnique = jest.fn(() => {
      loadStarted.resolve();
      return postgresLoad.promise;
    });
    const redis = {
      get: jest.fn().mockResolvedValue(undefined),
      set: jest.fn().mockResolvedValue(undefined),
    };
    const service = new SessionService(
      { authSession: { findUnique } } as never,
      redis as never,
      {} as never,
      config as never,
    );

    const requests = Array.from({ length: 6 }, () =>
      service.getActive(sessionId),
    );

    await loadStarted.promise;
    expect(findUnique).toHaveBeenCalledTimes(1);

    postgresLoad.resolve(durableSession('stored-hash'));

    const sessions = await Promise.all(requests);

    expect(sessions).toHaveLength(6);
    for (const session of sessions) {
      expect(session).toMatchObject({ id: sessionId, userId: 'user-1' });
    }
    expect(redis.set).toHaveBeenCalledTimes(1);
  });

  it('keeps the fallback guard for concurrent cache misses from distinct sessions', async () => {
    const sessionIds = Array.from(
      { length: 6 },
      (_, index) => `session-${index + 1}`,
    );
    const postgresLoads = new Map(
      sessionIds.map((id) => [
        id,
        createDeferred<ReturnType<typeof durableSession>>(),
      ]),
    );
    const fiveFallbacksStarted = createDeferred<void>();
    let fallbackStarts = 0;
    const findUnique = jest.fn(({ where }: { where: { id: string } }) => {
      const postgresLoad = postgresLoads.get(where.id);

      if (!postgresLoad) {
        throw new Error(`Unexpected PostgreSQL fallback for ${where.id}.`);
      }

      fallbackStarts += 1;
      if (fallbackStarts === 5) {
        fiveFallbacksStarted.resolve();
      }

      return postgresLoad.promise;
    });
    const redis = {
      get: jest.fn().mockResolvedValue(undefined),
      set: jest.fn().mockResolvedValue(undefined),
    };
    const service = new SessionService(
      { authSession: { findUnique } } as never,
      redis as never,
      {} as never,
      config as never,
    );

    const firstFiveRequests = sessionIds
      .slice(0, 5)
      .map((id) => service.getActive(id));

    await fiveFallbacksStarted.promise;

    await expect(service.getActive(sessionIds[5])).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
    expect(findUnique).toHaveBeenCalledTimes(5);

    for (const id of sessionIds.slice(0, 5)) {
      postgresLoads.get(id)?.resolve(durableSession('stored-hash', id));
    }

    await expect(Promise.all(firstFiveRequests)).resolves.toHaveLength(5);
  });

  it('cleans up a failed fallback so the same session can retry', async () => {
    const firstPostgresLoad =
      createDeferred<ReturnType<typeof durableSession>>();
    const firstLoadStarted = createDeferred<void>();
    const retryLoadStarted = createDeferred<void>();
    const retryPostgresLoad =
      createDeferred<ReturnType<typeof durableSession>>();
    const failure = new Error('PostgreSQL unavailable');
    const findUnique = jest
      .fn()
      .mockImplementationOnce(() => {
        firstLoadStarted.resolve();
        return firstPostgresLoad.promise;
      })
      .mockImplementationOnce(() => {
        retryLoadStarted.resolve();
        return retryPostgresLoad.promise;
      });
    const redis = {
      get: jest.fn().mockResolvedValue(undefined),
      set: jest.fn().mockResolvedValue(undefined),
    };
    const service = new SessionService(
      { authSession: { findUnique } } as never,
      redis as never,
      {} as never,
      config as never,
    );

    const firstAttempt = service.getActive(sessionId);
    await firstLoadStarted.promise;
    firstPostgresLoad.reject(failure);

    await expect(firstAttempt).rejects.toBe(failure);

    const retry = service.getActive(sessionId);
    await retryLoadStarted.promise;
    retryPostgresLoad.resolve(durableSession('stored-hash'));

    await expect(retry).resolves.toMatchObject({ id: sessionId });
    expect(findUnique).toHaveBeenCalledTimes(2);
  });

  it('continues to serve active cache hits without a PostgreSQL fallback', async () => {
    const now = new Date();
    const cachedSession = {
      id: sessionId,
      userId: 'user-1',
      username: 'employee',
      displayName: 'Employee User',
      email: 'employee@example.com',
      employeeId: 'employee-1',
      mustChangePassword: false,
      userStatus: 'ACTIVE',
      securityVersion: 1,
      refreshTokenHash: 'stored-hash',
      authorization: durableSession('stored-hash').authorizationSnapshot,
      lastActivityAt: now.toISOString(),
      idleExpiresAt: new Date(now.getTime() + 60_000).toISOString(),
      absoluteExpiresAt: new Date(now.getTime() + 120_000).toISOString(),
    };
    const findUnique = jest.fn();
    const redis = {
      get: jest.fn().mockResolvedValue(JSON.stringify(cachedSession)),
      set: jest.fn().mockResolvedValue(undefined),
    };
    const service = new SessionService(
      { authSession: { findUnique } } as never,
      redis as never,
      {} as never,
      config as never,
    );

    await expect(service.getActive(sessionId)).resolves.toMatchObject({
      id: sessionId,
      userId: 'user-1',
    });
    expect(findUnique).not.toHaveBeenCalled();
    expect(redis.set).not.toHaveBeenCalled();
  });
});
